import { expect, test, type Page } from '@playwright/test';

// The platform's routes, router and shell (platform Task 14; spec 7.8, 7.9, 2.4): every route loads by deep link, an unknown path is the
// not-found page with working links, the browser's Back and Forward walk landing -> Explore -> profile, a bad `?view=` is replaced in the
// URL, the navigation bar is never on a world or the create preview, the 250 ms fade runs between pages (and is an instant cut with
// reduced motion, and is never left behind), and a route change to a cached page is interactive well inside 500 ms.
// The landing is a live host (WebGL): the session has seen the entrance, as in platform-landing.spec.ts. Run with --workers=1.

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
    await expect(page.getByRole('heading', { name: 'Veyra' })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.oct-nav')).toHaveCount(0);
    // Only Veyra's bundle was asked for.
    expect(loaded.filter(u => /nox|flux|aether/.test(u))).toEqual([]);
    expect(loaded.some(u => /veyra/.test(u) || /bundle-/.test(u))).toBe(true);
    await page.goto('/@flux/github-pipeline-engine?view=detail');
    await expect(page.getByRole('heading', { name: 'Flux' })).toBeVisible({ timeout: 30_000 });
    expect(pathNow(page)).toBe('/@flux/github-pipeline-engine?view=detail');
  });

  test('/create/preview has no navigation bar', async ({ page }) => {
    await page.goto('/create/preview');
    await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Veyra' })).toBeVisible({ timeout: 30_000 });
  expect(pathNow(page)).toBe('/@veyra/vault-os');
  await expect(page.locator('main')).toHaveAttribute('data-view', 'intro');
  await page.goto('/@veyra/vault-os?view=techFocus&a=1');
  await expect(page.getByRole('heading', { name: 'Veyra' })).toBeVisible({ timeout: 30_000 });
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
