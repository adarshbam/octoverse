import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// The platform's routes, router and shell (platform Task 14; spec 7.8, 7.9, 2.4): every route loads by deep link, an unknown path is the
// not-found page with working links, the browser's Back and Forward walk landing -> Explore -> profile, a bad `?view=` is replaced in the
// URL, the navigation bar is never on a world or the create preview, the 250 ms fade runs between pages (and is an instant cut with
// reduced motion, and is never left behind), and a route change to a cached page is interactive well inside 500 ms.
// The landing is a live host (WebGL): the session has seen the entrance, as in platform-landing.spec.ts. Run with --workers=1.
// Further down (platform Task 15): a world visit's history (spec 7.9), the exit control, the entrance once per session, Back during
// the entrance, and a world through the platform against the same world at ?world=<id>.

test.setTimeout(120_000);

async function seeEntrance(page: Page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('octoverse.octoverse.entranceSeen', '1');
    } catch {
      /* no storage: the entrance would play, and the specs below would time out saying so */
    }
  });
}

/** The landing is up once the host has drawn and the intro's button is in. */
async function landingReady(page: Page) {
  await page.waitForFunction(() => (window as unknown as { __octoverse?: { ready?: boolean } }).__octoverse?.ready === true, null, { timeout: 90_000 });
  await expect(page.getByRole('button', { name: 'See how it works' })).toBeVisible();
}

/** A world's page is up once its host has drawn (the ready flag) and its exit control is in. */
async function worldUp(page: Page, world: string) {
  await page.waitForFunction(() => (window as unknown as { __octoverse?: { ready?: boolean } }).__octoverse?.ready === true, null, { timeout: 90_000 });
  await expect(page.locator(`[data-world="${world}"] .exit-link`)).toBeVisible();
}

const pathNow = (page: Page) => new URL(page.url()).pathname + new URL(page.url()).search;

test.describe('deep links', () => {
  test('/ is the landing and /how-it-works is How It Works', async ({ page }) => {
    await seeEntrance(page);
    await page.goto('/');
    await landingReady(page);
    await expect(page.getByRole('navigation', { name: 'OctoVerse' })).toBeVisible();
    await page.goto('/how-it-works');
    await page.waitForFunction(() => (window as unknown as { __octoverse?: { ready?: boolean } }).__octoverse?.ready === true, null, { timeout: 90_000 });
    await expect(page.getByRole('button', { name: /^Veyra, / })).toBeVisible();
  });

  test('/explore, a profile and /create load', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('[data-tile]')).toHaveCount(5);
    await expect(page).toHaveTitle('Explore · OctoVerse');
    await page.goto('/@veyra');
    await expect(page.getByRole('tab', { name: /^Projects/ })).toBeVisible();
    await expect(page).toHaveTitle('Veyra · OctoVerse');
    await page.goto('/create');
    await expect(page.locator('[data-slot="preview"]')).toBeVisible();
    await expect(page).toHaveTitle('Create · OctoVerse');
  });

  test('a world route loads its own bundle and shows the world, with no navigation bar', async ({ page }) => {
    const loaded: string[] = [];
    page.on('request', request => {
      const url = request.url();
      if (/\/worlds\/(nox|veyra|flux|aether)\/bundle/.test(url) || /bundle-[\w-]+\.js/.test(url)) loaded.push(url);
    });
    await page.goto('/@veyra/vault-os');
    await worldUp(page, 'veyra');
    await expect(page.locator('.oct-nav')).toHaveCount(0);
    // Only Veyra's bundle was asked for.
    expect(loaded.filter(u => /nox|flux|aether/.test(u))).toEqual([]);
    expect(loaded.some(u => /veyra/.test(u) || /bundle-/.test(u))).toBe(true);
    await page.goto('/@flux/github-pipeline-engine?view=detail');
    await worldUp(page, 'flux');
    expect(pathNow(page)).toBe('/@flux/github-pipeline-engine?view=detail');
  });

  test('/create/preview has no navigation bar', async ({ page }) => {
    await seeEntrance(page);
    await page.goto('/create/preview');
    // The draft's full world (the sample draft here) with its exit control: the only platform affordance.
    await expect(page.locator('[data-preview="draft"] .exit-link')).toHaveText('Back to the creator', { timeout: 90_000 });
    await expect(page.locator('.oct-nav')).toHaveCount(0);
  });

  test('a review address mounts the engine page, as before (no platform navigation bar)', async ({ page }) => {
    await page.goto('/?world=veyra&freeze');
    await page.waitForFunction(() => (window as unknown as { __octoverse?: { ready?: boolean } }).__octoverse?.ready === true, null, { timeout: 90_000 });
    await expect(page.locator('.oct-nav')).toHaveCount(0);
    await expect(page).toHaveTitle(/Veyra/);
  });

  test('the navigation bar is on every platform page', async ({ page }) => {
    for (const path of ['/explore', '/@nox', '/not-a-real-handle', '/create', '/@nobody', '/@veyra/not-a-project']) {
      await page.goto(path);
      await expect(page.locator('.oct-nav'), path).toBeVisible();
    }
  });
});

test.describe('not found', () => {
  for (const path of ['/not-a-real-handle', '/explore//', '/@Nox', '/@explore', '/@veyra/NOPE', '/@nobody', '/@veyra/not-a-project']) {
    test(`${path} shows the not-found page with the status in the title`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'This part of the ocean is unexplored' })).toBeVisible();
      await expect(page).toHaveTitle('Not found (404) · OctoVerse');
    });
  }

  test('its links go home and to Explore', async ({ page }) => {
    await seeEntrance(page);
    await page.goto('/not-a-real-handle');
    await page.getByRole('link', { name: 'Explore', exact: true }).last().click();
    await expect(page).toHaveURL(/\/explore$/);
    await expect(page.locator('[data-tile]')).toHaveCount(5);
    await page.goBack();
    await expect(page).toHaveURL(/\/not-a-real-handle$/);
    await page.getByRole('link', { name: 'Back to OctoVerse' }).click();
    await expect(page).toHaveURL(/\/$/);
    await landingReady(page);
  });
});

test('Back and Forward walk landing -> Explore -> profile', async ({ page }) => {
  await seeEntrance(page);
  await page.goto('/');
  await landingReady(page);
  await page.getByRole('link', { name: 'Explore', exact: true }).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.locator('[data-tile]')).toHaveCount(5);
  await page.locator('[data-tile="veyra"] a[href="/@veyra"]').first().click();
  await expect(page).toHaveURL(/\/@veyra$/);
  await expect(page.getByRole('tab', { name: /^Projects/ })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.locator('[data-tile]')).toHaveCount(5);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await landingReady(page);
  await page.goForward();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.locator('[data-tile]')).toHaveCount(5);
  await page.goForward();
  await expect(page).toHaveURL(/\/@veyra$/);
  await expect(page.getByRole('tab', { name: /^Projects/ })).toBeVisible();
});

test('a link to the page already shown adds no history entry', async ({ page }) => {
  await page.goto('/explore');
  await expect(page.locator('[data-tile]')).toHaveCount(5);
  const before = await page.evaluate(() => history.length);
  await page.getByRole('link', { name: 'Explore', exact: true }).click();
  await page.getByRole('link', { name: 'Explore', exact: true }).click();
  expect(await page.evaluate(() => history.length)).toBe(before);
});

test('a bad view is dropped from the URL, and the world opens at the intro', async ({ page }) => {
  await page.goto('/@veyra/vault-os?view=x');
  await worldUp(page, 'veyra');
  expect(pathNow(page)).toBe('/@veyra/vault-os');
  await expect(page.locator('[data-world]')).toHaveAttribute('data-view', 'intro');
  await page.goto('/@veyra/vault-os?view=techFocus&a=1');
  await worldUp(page, 'veyra');
  expect(pathNow(page)).toBe('/@veyra/vault-os?a=1');
  // The replacement is not a history entry: Back leaves the page, it does not return to the bad address.
  await page.goBack();
  expect(pathNow(page)).not.toContain('view=');
});

test.describe('the route fade (spec 7.9)', () => {
  /** Watches the DOM for the overlay: how many times it was added, and the longest it stayed. */
  async function watchFade(page: Page) {
    await page.evaluate(() => {
      const w = window as unknown as { __fade: { added: number; shown: number; removed: number; first: number; last: number } };
      w.__fade = { added: 0, shown: 0, removed: 0, first: 0, last: 0 };
      new MutationObserver(records => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof HTMLElement && node.classList.contains('oct-route-fade')) {
              w.__fade.added++;
              w.__fade.first = performance.now();
            }
          }
          for (const node of record.removedNodes) {
            if (node instanceof HTMLElement && node.classList.contains('oct-route-fade')) {
              w.__fade.removed++;
              w.__fade.last = performance.now();
            }
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    });
  }
  const fadeState = (page: Page) => page.evaluate(() => (window as unknown as { __fade: { added: number; removed: number; first: number; last: number } }).__fade);

  test('between two pages an indigo overlay covers and uncovers in about 250 ms, and none is left behind', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.locator('[data-tile]')).toHaveCount(5);
    await watchFade(page);
    await page.locator('[data-tile="veyra"] a[href="/@veyra"]').first().click();
    await expect(page.getByRole('tab', { name: /^Projects/ })).toBeVisible();
    await expect(page.locator('.oct-route-fade')).toHaveCount(0);
    const fade = await fadeState(page);
    expect(fade.added).toBe(1);
    expect(fade.removed).toBe(1);
    expect(fade.last - fade.first).toBeGreaterThan(200);
    expect(fade.last - fade.first).toBeLessThan(450);
  });

  test('the overlay is the reef indigo and does not take clicks', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.locator('[data-tile]')).toHaveCount(5);
    await page.evaluate(() => {
      document.querySelector('a[href="/@veyra"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    });
    const overlay = page.locator('.oct-route-fade');
    await expect(overlay).toHaveCount(1);
    const style = await overlay.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, events: getComputedStyle(el).pointerEvents, position: getComputedStyle(el).position }));
    expect(style).toEqual({ background: 'rgb(2, 22, 72)', events: 'none', position: 'fixed' });
    await expect(overlay).toHaveCount(0);
  });

  test('with reduced motion the route is an instant cut: no overlay at all', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/explore');
    await expect(page.locator('[data-tile]')).toHaveCount(5);
    await watchFade(page);
    await page.locator('[data-tile="veyra"] a[href="/@veyra"]').first().click();
    await expect(page.getByRole('tab', { name: /^Projects/ })).toBeVisible();
    await page.waitForTimeout(400);
    const fade = await fadeState(page);
    expect(fade.added).toBe(0);
  });

  test('a route that changes during the fade ends on the last route, with no overlay left', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.locator('[data-tile]')).toHaveCount(5);
    await page.evaluate(() => {
      document.querySelector<HTMLAnchorElement>('a[href="/@veyra"]')!.click();
      setTimeout(() => history.back(), 40);
    });
    await expect(page).toHaveURL(/\/explore$/);
    await expect(page.locator('[data-tile]')).toHaveCount(5);
    await expect(page.locator('.oct-route-fade')).toHaveCount(0);
    await page.waitForTimeout(500);
    await expect(page.locator('.oct-route-fade')).toHaveCount(0);
    await expect(page.locator('[data-tile]')).toHaveCount(5);
  });
});

test.describe('route changes', () => {
  test('to a cached platform page the page is interactive well inside 500 ms', async ({ page }, info) => {
    // Visit the creator once so its chunk is cached, then go to Explore and measure Explore -> creator and creator -> Explore -> profile.
    await page.goto('/create');
    await expect(page.locator('[data-slot="preview"]')).toBeVisible();
    await page.getByRole('link', { name: 'Explore', exact: true }).click();
    await expect(page.locator('[data-tile]')).toHaveCount(5);
    const time = (selector: string, ready: string) =>
      page.evaluate(
        ({ selector, ready }) =>
          new Promise<number>(resolve => {
            const t0 = performance.now();
            document.querySelector<HTMLAnchorElement>(selector)!.click();
            const poll = () => {
              const el = document.querySelector<HTMLElement>(ready);
              if (el && el.getBoundingClientRect().height > 0 && !document.querySelector('.oct-route-fade[data-phase="in"]')) {
                // Interactive: the new page's control takes focus.
                el.focus();
                if (document.activeElement === el) return resolve(performance.now() - t0);
              }
              requestAnimationFrame(poll);
            };
            poll();
          }),
        { selector, ready },
      );
    const toCreator = await time('.oct-nav-link[href="/create"]', '[role="tab"], .oct-creator button, .oct-creator summary');
    await page.getByRole('link', { name: 'Explore', exact: true }).click();
    await expect(page.locator('[data-tile]')).toHaveCount(5);
    const toProfile = await time('[data-tile="flux"] a[href="/@flux"]', '[role="tab"]');
    info.annotations.push({ type: 'route change ms', description: `explore->create (cached chunk) ${Math.round(toCreator)}; explore->profile ${Math.round(toProfile)}` });
    console.log(`route change to a cached page: explore->create ${Math.round(toCreator)} ms, explore->profile ${Math.round(toProfile)} ms`);
    expect(toCreator).toBeLessThan(500);
    expect(toProfile).toBeLessThan(500);
  });
});

// ---- A world visit's history (platform Task 15; spec 7.9) -----------------------------------------------------------------------

const WORLDS = [
  { handle: 'veyra', slug: 'vault-os', name: 'Veyra', title: 'Vault OS' },
  { handle: 'flux', slug: 'github-pipeline-engine', name: 'Flux', title: 'GitHub Pipeline Engine' },
  { handle: 'nox', slug: 'security-lab', name: 'Nox', title: 'Security Lab' },
] as const;
const veyra = WORLDS[0];

/** This session has seen the entrance of the landing and of the worlds given (an entrance plays once per session, by the world's id). */
async function seen(page: Page, ...worlds: string[]) {
  await page.addInitScript(ids => {
    try {
      for (const id of ids) sessionStorage.setItem(`octoverse.${id}.entranceSeen`, '1');
    } catch {
      /* no storage: the entrance would play */
    }
  }, ['octoverse', ...worlds]);
}

const profileReady = (page: Page) => expect(page.getByRole('tab', { name: /^Projects/ })).toBeVisible();
const enterLink = (page: Page, name = 'Veyra') => page.getByRole('link', { name: `Enter ${name}'s world` });
const overviewPanel = (page: Page, title = veyra.title) => page.getByRole('region', { name: `${title} overview` });
const detailPanel = (page: Page, title = veyra.title) => page.getByRole('region', { name: `${title} full project view` });
const introTitle = (page: Page, title = veyra.title) => page.getByRole('heading', { level: 1, name: title });
/** The world's own controls (the nameplate opens the overview, "View Project" the detail). They drift with the camera, so they are pressed by event, not at a point. */
const openOverview = (page: Page) => page.locator('button.nameplate-button').dispatchEvent('click');
const openDetail = (page: Page) => page.locator('button.overview-view').dispatchEvent('click');
const historyLength = (page: Page) => page.evaluate(() => history.length);
const scrollerTop = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>('.oct-page')?.scrollTop ?? -1);

/** Profile, then into the world: the walk every history check below starts from. */
async function enterFromProfile(page: Page, world: (typeof WORLDS)[number] = veyra) {
  await page.goto(`/@${world.handle}`);
  await profileReady(page);
  await enterLink(page, world.name).click();
  await expect(page).toHaveURL(new RegExp(`/@${world.handle}/${world.slug}$`));
  await worldUp(page, world.handle);
  // The intro's words are in: the nameplate is a live control (it is inert while the intro is not the stage).
  await expect(introTitle(page, world.title)).toBeVisible();
  await onlyTheWorld(page);
}

/** Entering a world unmounts the landing and every preview (spec 7.9): while it is up there is its one canvas, no landing, no navigation bar, no preview. */
async function onlyTheWorld(page: Page) {
  await expect(page.locator('.oct-landing, .oct-hostbox, .oct-nav, [data-slot="preview"], .oct-preview')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(1);
}

test.describe('Back and Forward inside a world (spec 7.9)', () => {
  test('profile, intro, overview, detail are four entries: three Backs return to the profile, scroll restored, focus on the control that opened the world', async ({ page }) => {
    await seen(page, 'veyra');
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto('/@veyra');
    await profileReady(page);
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('.oct-page')!.scrollTop = 220;
    });
    const scrolled = await scrollerTop(page);
    expect(scrolled).toBeGreaterThan(100);
    const before = await historyLength(page);
    await enterLink(page).click();
    await worldUp(page, 'veyra');
    await expect(introTitle(page)).toBeVisible();
    await openOverview(page);
    await expect(page).toHaveURL(/\/@veyra\/vault-os\?view=overview$/);
    await expect(overviewPanel(page)).toBeVisible();
    await openDetail(page);
    await expect(page).toHaveURL(/\/@veyra\/vault-os\?view=detail$/);
    await expect(detailPanel(page)).toBeVisible();
    // Four entries: the profile and the world's intro, overview and detail (the intro's was pushed by the link, the others by the stage).
    expect(await historyLength(page)).toBe(before + 3);

    const trace: string[] = [pathNow(page)];
    await page.goBack();
    await expect(page).toHaveURL(/\/@veyra\/vault-os\?view=overview$/);
    await expect(overviewPanel(page)).toBeVisible();
    await expect(detailPanel(page)).toBeHidden();
    trace.push(pathNow(page));
    await page.goBack();
    await expect(page).toHaveURL(/\/@veyra\/vault-os$/);
    await expect(overviewPanel(page)).toBeHidden();
    await expect(introTitle(page)).toBeVisible();
    trace.push(pathNow(page));
    await page.goBack();
    await expect(page).toHaveURL(/\/@veyra$/);
    await profileReady(page);
    trace.push(pathNow(page));
    console.log(`history walk (Backs): ${trace.join('  <-  ')}`);

    // The page is back as it was left: scrolled where it was, and focus on "Enter Veyra's world".
    await expect.poll(() => scrollerTop(page)).toBe(scrolled);
    await expect(enterLink(page)).toBeFocused();
    await expect(page.locator('.oct-route-fade')).toHaveCount(0);
    expect(await historyLength(page)).toBe(before + 3);
  });

  test('Forward walks it again: intro, overview, detail', async ({ page }) => {
    await seen(page, 'veyra');
    await enterFromProfile(page);
    await openOverview(page);
    await expect(overviewPanel(page)).toBeVisible();
    await openDetail(page);
    await expect(detailPanel(page)).toBeVisible();
    for (let i = 0; i < 3; i++) await page.goBack();
    await expect(page).toHaveURL(/\/@veyra$/);
    await profileReady(page);
    const trace: string[] = [];
    await page.goForward();
    await expect(page).toHaveURL(/\/@veyra\/vault-os$/);
    await worldUp(page, 'veyra');
    await expect(introTitle(page)).toBeVisible();
    trace.push(pathNow(page));
    await page.goForward();
    await expect(page).toHaveURL(/\/@veyra\/vault-os\?view=overview$/);
    await expect(overviewPanel(page)).toBeVisible();
    trace.push(pathNow(page));
    await page.goForward();
    await expect(page).toHaveURL(/\/@veyra\/vault-os\?view=detail$/);
    await expect(detailPanel(page)).toBeVisible();
    trace.push(pathNow(page));
    console.log(`history walk (Forwards): ${trace.join('  ->  ')}`);
    await expect(page.locator('.oct-route-fade')).toHaveCount(0);
  });

  test('a deep link to the detail opens on it with no entrance, and Back goes to the profile', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('octoverse.octoverse.entranceSeen', '1'));
    await page.goto('/@veyra/vault-os?view=detail');
    await worldUp(page, 'veyra');
    await expect(detailPanel(page)).toBeVisible();
    // No entrance: no skip control was ever offered, and the session now counts the world's entrance as seen.
    await expect(page.getByRole('button', { name: 'Skip intro' })).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem('octoverse.veyra.entranceSeen'))).toBe('1');
    await page.goBack();
    await expect(page).toHaveURL(/\/@veyra$/);
    await profileReady(page);
    expect(pathNow(page)).toBe('/@veyra');
    // And Forward is the detail again, as the page that was deep-linked.
    await page.goForward();
    await expect(page).toHaveURL(/\/@veyra\/vault-os\?view=detail$/);
    await worldUp(page, 'veyra');
    await expect(detailPanel(page)).toBeVisible();
  });

  // Spec 7.9 (ruling R20): when the ENGINE steps the stage down (Escape, its close controls) the page stays the world's, no entry is added, and
  // the address agrees with the stage: the matching entry before is popped to when it is this visit's, otherwise the entry is replaced.
  test('Escape in a deep-linked detail closes it, stays on the world, adds no entry, and the address says overview; one Back goes to the profile', async ({ page }) => {
    await seen(page, 'veyra');
    await page.goto('/@veyra/vault-os?view=detail');
    await worldUp(page, 'veyra');
    await expect(detailPanel(page)).toBeVisible();
    const before = await historyLength(page);
    await page.keyboard.press('Escape');
    await expect(overviewPanel(page)).toBeVisible();
    await expect(detailPanel(page)).toBeHidden();
    await expect(page).toHaveURL(/\/@veyra\/vault-os\?view=overview$/);
    await expect(page.locator('[data-world="veyra"] .exit-link')).toBeVisible();
    expect(await historyLength(page)).toBeLessThanOrEqual(before);
    // Another Escape closes the overview (the intro); the address follows again.
    await page.keyboard.press('Escape');
    await expect(overviewPanel(page)).toBeHidden();
    await expect(page).toHaveURL(/\/@veyra\/vault-os$/);
    expect(await historyLength(page)).toBeLessThanOrEqual(before);
    await page.goBack();
    await expect(page).toHaveURL(/\/@veyra$/);
    await profileReady(page);
  });

  test('Escape in a walked detail pops to the overview entry: the address matches, no dead Back step, one Back goes to the intro', async ({ page }) => {
    await seen(page, 'veyra');
    await enterFromProfile(page);
    await openOverview(page);
    await openDetail(page);
    await expect(detailPanel(page)).toBeVisible();
    await expect(page).toHaveURL(/\?view=detail$/);
    const before = await historyLength(page);
    await page.keyboard.press('Escape');
    await expect(overviewPanel(page)).toBeVisible();
    await expect(detailPanel(page)).toBeHidden();
    await expect(page).toHaveURL(/\/@veyra\/vault-os\?view=overview$/);
    expect(await historyLength(page)).toBeLessThanOrEqual(before);
    await page.goBack();
    await expect(page).toHaveURL(/\/@veyra\/vault-os$/);
    await expect(overviewPanel(page)).toBeHidden();
    await expect(introTitle(page)).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/@veyra$/);
    await profileReady(page);
  });

  test("the detail's own close control steps down the same way as Escape", async ({ page }) => {
    await seen(page, 'veyra');
    await enterFromProfile(page);
    await openOverview(page);
    await openDetail(page);
    await expect(detailPanel(page)).toBeVisible();
    const before = await historyLength(page);
    await page.getByRole('button', { name: 'Close project view' }).dispatchEvent('click');
    await expect(overviewPanel(page)).toBeVisible();
    await expect(page).toHaveURL(/\/@veyra\/vault-os\?view=overview$/);
    expect(await historyLength(page)).toBeLessThanOrEqual(before);
    await page.goBack();
    await expect(page).toHaveURL(/\/@veyra\/vault-os$/);
    await expect(introTitle(page)).toBeVisible();
  });

  test('overview to intro by the engine: Escape, and the overview close control on a phone, pop to the intro entry; one Back goes to the profile', async ({ page }) => {
    await seen(page, 'veyra');
    await enterFromProfile(page);
    await openOverview(page);
    await expect(overviewPanel(page)).toBeVisible();
    const before = await historyLength(page);
    await page.keyboard.press('Escape');
    await expect(overviewPanel(page)).toBeHidden();
    await expect(page).toHaveURL(/\/@veyra\/vault-os$/);
    await expect(introTitle(page)).toBeVisible();
    expect(await historyLength(page)).toBeLessThanOrEqual(before);
    await page.goBack();
    await expect(page).toHaveURL(/\/@veyra$/);
    await profileReady(page);
    // The overview's own close control (a sheet on a phone).
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goForward();
    await expect(page).toHaveURL(/\/@veyra\/vault-os$/);
    await worldUp(page, 'veyra');
    await openOverview(page);
    await expect(overviewPanel(page)).toBeVisible();
    const phoneBefore = await historyLength(page);
    await page.getByRole('button', { name: 'Close overview' }).dispatchEvent('click');
    await expect(overviewPanel(page)).toBeHidden();
    await expect(page).toHaveURL(/\/@veyra\/vault-os$/);
    expect(await historyLength(page)).toBeLessThanOrEqual(phoneBefore);
    await page.goBack();
    await expect(page).toHaveURL(/\/@veyra$/);
    await profileReady(page);
  });

  test('after an Escape the next Backs and a Forward still land on the views they name, and the stage follows', async ({ page }) => {
    await seen(page, 'veyra');
    await enterFromProfile(page);
    await openOverview(page);
    await openDetail(page);
    await expect(detailPanel(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\?view=overview$/);
    await page.goForward();
    await expect(page).toHaveURL(/\?view=detail$/);
    await expect(detailPanel(page)).toBeVisible();
    await page.goBack();
    await page.goBack();
    await expect(page).toHaveURL(/\/@veyra\/vault-os$/);
    await expect(overviewPanel(page)).toBeHidden();
    await expect(introTitle(page)).toBeVisible();
  });
});

test.describe('quick step-downs and a cold page (spec 7.9)', () => {
  test('two Escapes pressed back to back from a deep-linked detail end on the intro, and the address has no view', async ({ page }) => {
    await seen(page, 'veyra');
    await page.goto('/@veyra/vault-os?view=detail');
    await worldUp(page, 'veyra');
    await expect(detailPanel(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(overviewPanel(page)).toBeHidden();
    await expect(detailPanel(page)).toBeHidden();
    await expect(introTitle(page)).toBeVisible();
    await expect(page).toHaveURL(/\/@veyra\/vault-os$/);
    // Nothing reopened it a moment later.
    await page.waitForTimeout(1500);
    await expect(overviewPanel(page)).toBeHidden();
    expect(pathNow(page)).toBe('/@veyra/vault-os');
  });

  for (const rate of [1, 4]) {
    test(`two Escapes back to back from a walked detail end on the intro entry (CPU throttling x${rate})`, async ({ page }) => {
      test.setTimeout(240_000);
      await seen(page, 'veyra');
      await enterFromProfile(page);
      await openOverview(page);
      await openDetail(page);
      await expect(detailPanel(page)).toBeVisible();
      const before = await historyLength(page);
      if (rate > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate });
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await expect(introTitle(page)).toBeVisible({ timeout: 60_000 });
      await expect(overviewPanel(page)).toBeHidden();
      await expect(page).toHaveURL(/\/@veyra\/vault-os$/);
      await page.waitForTimeout(2000);
      await expect(overviewPanel(page)).toBeHidden();
      await expect(page).toHaveURL(/\/@veyra\/vault-os$/);
      expect(await historyLength(page)).toBeLessThanOrEqual(before);
      // Back is the profile: no entry is left that reopens the overview.
      await page.goBack();
      await expect(page).toHaveURL(/\/@veyra$/);
      await profileReady(page);
    });
  }

  test('a reload inside the world, then Back: the profile has its scroll and focus back, and nothing throws', async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await seen(page, 'veyra');
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto('/@veyra');
    await profileReady(page);
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('.oct-page')!.scrollTop = 220;
    });
    const scrolled = await scrollerTop(page);
    expect(scrolled).toBeGreaterThan(100);
    await enterLink(page).click();
    await worldUp(page, 'veyra');
    await page.reload();
    await worldUp(page, 'veyra');
    await page.goBack();
    await expect(page).toHaveURL(/\/@veyra$/);
    await profileReady(page);
    await expect.poll(() => scrollerTop(page), { timeout: 15_000 }).toBe(scrolled);
    await expect(enterLink(page)).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('a malformed history state (written by something else) does not take the app down', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await seen(page, 'veyra');
    await page.goto('/@veyra');
    await profileReady(page);
    await page.evaluate(() => history.replaceState({ platform: { scrollY: 'a', focusId: 7, opener: 3, prev: {} } }, ''));
    await enterLink(page).click();
    await worldUp(page, 'veyra');
    await page.evaluate(() => history.replaceState({ platform: 'x' }, ''));
    await openOverview(page);
    await expect(overviewPanel(page)).toBeVisible();
    await page.goBack();
    await page.goBack();
    await expect(page).toHaveURL(/\/@veyra$/);
    await profileReady(page);
    expect(errors).toEqual([]);
  });
});

test.describe("the world's exit control", () => {
  test('is the first focusable element, is named for the profile that opened the world, and is Back from the first entry', async ({ page }) => {
    await seen(page, 'veyra');
    await enterFromProfile(page);
    const first = await page.evaluate(() => {
      const tabbable = [...document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')].filter(
        el => !(el as HTMLButtonElement).disabled && el.tabIndex >= 0 && !el.closest('[inert], #boot-veil') && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0,
      );
      return { className: tabbable[0]?.className, text: tabbable[0]?.textContent };
    });
    expect(first).toEqual({ className: 'exit-link', text: "Back to Veyra's profile" });
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: "Back to Veyra's profile" })).toBeFocused();
    const before = await historyLength(page);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/@veyra$/);
    await profileReady(page);
    // Back from the first entry: the same entry count, the profile's own entry (scroll and focus come back with it).
    expect(await historyLength(page)).toBe(before);
    await expect(enterLink(page)).toBeFocused();
  });

  test('from the detail it pushes the profile (the page is three entries back): Back returns to the detail', async ({ page }) => {
    await seen(page, 'veyra');
    await enterFromProfile(page);
    await openOverview(page);
    await openDetail(page);
    await expect(detailPanel(page)).toBeVisible();
    const before = await historyLength(page);
    await page.getByRole('link', { name: "Back to Veyra's profile" }).click();
    await expect(page).toHaveURL(/\/@veyra$/);
    await profileReady(page);
    expect(await historyLength(page)).toBe(before + 1);
    await page.goBack();
    await expect(page).toHaveURL(/\/@veyra\/vault-os\?view=detail$/);
    await expect(detailPanel(page)).toBeVisible();
  });

  test('a deep link has the profile behind it, so its exit is Back to the profile; a plain link to the intro has none', async ({ page }) => {
    await seen(page, 'veyra');
    await page.goto('/@veyra/vault-os?view=overview');
    await worldUp(page, 'veyra');
    await expect(page.getByRole('link', { name: "Back to Veyra's profile" })).toBeVisible();
    const before = await historyLength(page);
    await page.getByRole('link', { name: "Back to Veyra's profile" }).click();
    await expect(page).toHaveURL(/\/@veyra$/);
    expect(await historyLength(page)).toBe(before);
    await page.goto('/@veyra/vault-os');
    await worldUp(page, 'veyra');
    await expect(page.getByRole('link', { name: 'Back to OctoVerse' })).toBeVisible();
  });
});

test.describe('leaving a world mid-entrance (spec 7.9)', () => {
  // The window's listeners are counted by the development build (`window.__listenerCount`, src/platform/devListenerCount.ts). Two things
  // the count must not be fooled by: Playwright's own hit-target listeners, which a `click()` leaves on the window (so the visit is entered
  // with the keyboard), and @theatre/core, which adds one `error` and one `unhandledrejection` listener when its module is first imported
  // (the engine imports it as the first world's entrance loads) and never removes them: a one-time cost of the module, not of a visit. So
  // the visit is made twice: the first may add those two, and the second must add nothing, and no other type may differ at all.
  const listeners = (page: Page, type = '*') => page.evaluate(t => (window as unknown as { __listenerCount: (type: string) => number }).__listenerCount(t), type);
  const ONCE = ['error', 'unhandledrejection'];
  const TYPES = ['keydown', 'pointerdown', 'pointermove', 'touchstart', 'scroll', 'resize', 'popstate', 'visibilitychange', 'blur', 'focus'];
  const snapshot = async (page: Page) => ({ total: await listeners(page), once: await Promise.all(ONCE.map(t => listeners(page, t))), types: await Promise.all(TYPES.map(t => listeners(page, t))) });
  /** The profile may start things of its own after it is up (its live hero preview loads and attaches listeners): the baseline is taken once the window's listeners have stopped changing. */
  const settledSnapshot = async (page: Page) => {
    let last = -1;
    let steady = 0;
    for (let i = 0; i < 60 && steady < 3; i++) {
      const now = await listeners(page);
      steady = now === last ? steady + 1 : 0;
      last = now;
      await page.waitForTimeout(500);
    }
    return snapshot(page);
  };
  const enterByKeyboard = async (page: Page) => {
    await enterLink(page).focus();
    await page.keyboard.press('Enter');
  };
  // The world's page instance and its canvas run the main thread hard while the entrance loads (tasks of several seconds on the shared GPU,
  // measured with the long-task observer), so the route's own 250 ms fade can take that long to finish: the waits below are for the page to
  // catch up, not time limits on the fade.
  const CATCH_UP = 90_000;

  /** The page after the world has gone: the profile, no overlay left, the world's canvas gone. */
  async function profileAfterLeaving(page: Page) {
    await expect(page).toHaveURL(/\/@veyra$/);
    await expect(page.getByRole('tab', { name: /^Projects/ })).toBeVisible({ timeout: CATCH_UP });
    await expect(page.locator('.oct-route-fade')).toHaveCount(0, { timeout: CATCH_UP });
    await page.waitForTimeout(700);
    await expect(page.locator('.oct-route-fade')).toHaveCount(0);
    expect(await page.locator('canvas').count()).toBeLessThanOrEqual(2);
  }

  test("Back during the world's entrance returns to the profile: no overlay, two canvases at most, the window's listeners as before", async ({ page }) => {
    test.setTimeout(360_000);
    await seen(page); // the landing's only: the world's entrance plays
    await page.goto('/@veyra');
    await profileReady(page);
    const before = await settledSnapshot(page);
    const canvasesBefore = await page.locator('canvas').count();
    const log: string[] = [];
    let afterFirst = before;
    for (const visit of [1, 2]) {
      await enterByKeyboard(page);
      await expect(page).toHaveURL(/\/@veyra\/vault-os$/);
      // The entrance is under way once the skip control is offered.
      await expect(page.getByRole('button', { name: 'Skip intro' })).toBeVisible({ timeout: 120_000 });
      const during = { listeners: await listeners(page), canvases: await page.locator('canvas').count() };
      expect(during.canvases).toBeGreaterThan(0);
      await page.goBack();
      await profileAfterLeaving(page);
      // The listeners settle (the world's canvas is let go of a moment after its page is).
      await expect.poll(() => listeners(page), { timeout: 15_000 }).toBeLessThanOrEqual(visit === 1 ? before.total + ONCE.length : afterFirst.total);
      const after = await snapshot(page);
      log.push(`visit ${visit}: window listeners ${before.total} (before) -> ${during.listeners} (during) -> ${after.total} (after); canvases ${canvasesBefore} -> ${during.canvases} -> ${await page.locator('canvas').count()}`);
      // Every type an instance listens for is exactly as it was; only the two one-time module listeners may have arrived, and only once.
      expect(after.types).toEqual(before.types);
      if (visit === 1) {
        afterFirst = after;
        expect(after.once.every((n, i) => n - before.once[i] <= 1)).toBe(true);
      } else {
        expect(after).toEqual(afterFirst);
      }
    }
    console.log(`Back during the entrance (once-only module listeners ${ONCE.join(', ')}: ${before.once} -> ${afterFirst.once}):\n  ${log.join('\n  ')}`);
    // The entrance was interrupted, not seen: it plays on the next visit.
    expect(await page.evaluate(() => sessionStorage.getItem('octoverse.veyra.entranceSeen'))).toBeNull();
  });

  test('Back while the world is still loading leaves no instance behind either', async ({ page }) => {
    test.setTimeout(240_000);
    await seen(page);
    await page.goto('/@veyra');
    await profileReady(page);
    const before = await settledSnapshot(page);
    await enterByKeyboard(page);
    await page.goBack();
    await profileAfterLeaving(page);
    await expect.poll(async () => (await snapshot(page)).types, { timeout: 15_000 }).toEqual(before.types);
  });

  test('three quick Backs from the detail end on the profile with its own address (a lagging stage is not an entry of its own)', async ({ page }) => {
    test.setTimeout(240_000);
    await seen(page, 'veyra');
    await enterFromProfile(page);
    await openOverview(page);
    await openDetail(page);
    await expect(detailPanel(page)).toBeVisible();
    const before = await historyLength(page);
    const trace = await page.evaluate(async () => {
      const seenUrls: string[] = [];
      const note = () => seenUrls.push(location.pathname + location.search);
      addEventListener('popstate', note);
      for (let i = 0; i < 3; i++) history.back();
      await new Promise(resolve => setTimeout(resolve, 4000));
      removeEventListener('popstate', note);
      return seenUrls;
    });
    console.log(`three quick Backs: ${trace.join('  ->  ')}`);
    await expect(page).toHaveURL(/\/@veyra$/);
    await profileReady(page);
    await expect(page.locator('.oct-route-fade')).toHaveCount(0, { timeout: 60_000 });
    // Nothing was pushed by the engine catching up, and the address stayed the profile's.
    expect(await historyLength(page)).toBe(before);
    expect(pathNow(page)).toBe('/@veyra');
  });
});

test.describe('the entrance plays once per session, by the world (spec 7.9)', () => {
  for (const world of [WORLDS[0], WORLDS[2]]) {
    test(`${world.name}: visit, leave, visit again: no entrance the second time`, async ({ page }) => {
      await seen(page); // the landing's only
      await page.goto(`/@${world.handle}`);
      await profileReady(page);
      await enterLink(page, world.name).click();
      const skip = page.getByRole('button', { name: 'Skip intro' });
      await expect(skip.or(introTitle(page, world.title))).toBeVisible({ timeout: 90_000 });
      // First visit: the entrance plays. Skipping it (or letting it end) is having seen it.
      if (await skip.isVisible()) await skip.click({ force: true });
      await expect(introTitle(page, world.title)).toBeVisible({ timeout: 30_000 });
      expect(await page.evaluate(id => sessionStorage.getItem(`octoverse.${id}.entranceSeen`), world.handle)).toBe('1');
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`/@${world.handle}$`));
      await profileReady(page);
      await enterLink(page, world.name).click();
      await worldUp(page, world.handle);
      // Second visit: straight to the intro. No skip control, and the title is up at once.
      await expect(skip).toHaveCount(0);
      await expect(introTitle(page, world.title)).toBeVisible();
    });
  }
});

test.describe('a world through the platform is the world at ?world=<id> (spec 2.5, 7.8)', () => {
  // A frozen still of the same moment through both addresses, compared with scripts/still_compare.py (the engine extraction's gate: mean
  // difference per channel 0.5, 0.2% of pixels over 8). The platform path takes the review switches in its own address on the
  // development server (`/@veyra/vault-os?freeze&stage=intro&t=1`), so the same switches go through both. What is compared is the canvas
  // alone: the platform's exit control is a pill over its top-left corner and is hidden for the capture, as no still has it.
  const OUT = join(process.cwd(), 'test-results', 'platform-world-stills');
  const FLAGS = 'freeze&stage=intro&t=1&hover=0,0,0';
  const SIZE = { width: 1280, height: 800 };

  async function capture(page: Page, address: string, file: string) {
    await page.goto(address);
    await page.waitForFunction(() => (window as unknown as { __octoverse?: { ready?: boolean } }).__octoverse?.ready === true, null, { timeout: 120_000 });
    const loaded = await page.evaluate(() => (window as unknown as { __octoverse?: { world?: { kit: boolean; plate: boolean } } }).__octoverse?.world);
    expect(loaded, `${address}: the world's kit and plate arrived`).toEqual({ kit: true, plate: true });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: '.exit-link { visibility: hidden !important; }' });
    await page.waitForTimeout(900);
    await page.locator('canvas').first().screenshot({ path: file });
  }

  test('a frozen still of Veyra and of Flux is the same through both addresses', async ({ page }, info) => {
    test.setTimeout(480_000);
    await page.setViewportSize(SIZE);
    rmSync(OUT, { recursive: true, force: true });
    const [platform, review] = [join(OUT, 'platform'), join(OUT, 'review')];
    mkdirSync(platform, { recursive: true });
    mkdirSync(review, { recursive: true });
    for (const world of [WORLDS[0], WORLDS[1]]) {
      await capture(page, `/@${world.handle}/${world.slug}?${FLAGS}`, join(platform, `${world.handle}.png`));
      await capture(page, `/?world=${world.handle}&${FLAGS}`, join(review, `${world.handle}.png`));
    }
    const run = spawnSync('python', ['scripts/still_compare.py', platform, review], { cwd: process.cwd(), encoding: 'utf8' });
    console.log(`still_compare.py (platform vs ?world=):\n${run.stdout}${run.stderr}`);
    info.annotations.push({ type: 'still_compare', description: run.stdout.trim() });
    expect(run.status, `still_compare.py:\n${run.stdout}${run.stderr}`).toBe(0);
  });
});
