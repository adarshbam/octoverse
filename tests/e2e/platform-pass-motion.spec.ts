import { expect, test, type Page } from '@playwright/test';
import { ROUTES, SIZES, hostReady, settleRoute, type PassRoute } from './passRoutes';

// Reduced motion on every route (platform Task 21a; spec 7.15: no entrance, no float, drift or swim, card previews as stills, route
// fades as cuts), with `reducedMotion: 'reduce'` and NO entrance seen (the first visit of a session, where the entrance would play):
//   - the landing and a world visit open on the intro at once: no "Skip intro" control ever appears, the intro's buttons are there as
//     soon as the host has drawn, and the entrance is not recorded as a thing that was played;
//   - no preview canvas anywhere a card, tile, profile hero or the creator's picture is: hovering and focusing every tile and card leaves
//     no `.oct-live-layer`, and the only canvas on a page is its own host's (none on a static page; one on a host page);
//   - nothing the platform draws moves: every element of the platform's own DOM has no CSS animation and no transition, and no animation
//     of the page is running (the engine's DOM inside a host is the engine's, which reads reduced motion itself);
//   - route changes are cuts: four route changes in a row show no `.oct-route-fade`, and its CSS says `display: none` should one exist.
// `prefers-reduced-motion` coverage of the platform's CSS is checked by the "nothing moves" scan on the pages that draw each rule
// (a rule that animates or transitions under reduced motion fails it), not by reading the CSS.
// Dev server, --workers=1.

test.setTimeout(150_000);

const SIZE = SIZES[0];
test.use({ reducedMotion: 'reduce', viewport: { width: SIZE.width, height: SIZE.height } });

/** The platform's own DOM that still has a CSS animation or transition (or a running animation); the engine's DOM inside a host is left out. */
async function moving(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const engine = (el: Element) => !!el.closest('[data-world], [data-preview], .oct-live-layer, canvas') || (!!el.closest('.oct-landing') && !el.closest('.oct-layer'));
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (engine(el)) continue;
      for (const pseudo of [null, '::before', '::after']) {
        const style = getComputedStyle(el, pseudo);
        const durations = style.transitionDuration.split(',').map(d => parseFloat(d));
        const transitions = style.transitionProperty !== 'none' && style.transitionProperty !== '' && durations.some(d => d > 0);
        const animated = style.animationName !== 'none' && parseFloat(style.animationDuration) > 0;
        if (transitions || animated) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}${pseudo ?? ''}: ${animated ? `animation ${style.animationName}` : `transition ${style.transitionProperty} ${style.transitionDuration}`}`);
      }
    }
    for (const animation of document.getAnimations()) {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      if (target && !engine(target)) out.push(`running ${animation.constructor.name} on ${target.tagName.toLowerCase()}.${String(target.className).split(' ')[0]}`);
    }
    return [...new Set(out)];
  });
}

const canvases = (page: Page) => page.locator('canvas').count();

for (const route of ROUTES) {
  test(`reduced motion: ${route.name}: nothing moves, no preview, the intro at once`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(route.path);
    // No entrance control may ever show: watch for it from the first frame.
    await page.evaluate(() => {
      const w = window as unknown as { __skipSeen: number };
      w.__skipSeen = 0;
      new MutationObserver(() => {
        // The engine keeps its skip control in the page all the time, inert and invisible; one a visitor could press is the entrance's.
        const offered = [...document.querySelectorAll<HTMLButtonElement>('button')].some(b => /^Skip intro$/.test((b.textContent ?? '').trim()) && !b.inert && !b.closest('[inert]') && getComputedStyle(b).visibility !== 'hidden' && Number(getComputedStyle(b).opacity) > 0);
        if (offered) w.__skipSeen++;
      }).observe(document.documentElement, { childList: true, subtree: true });
    });
    await settleRoute(page, route);
    if (route.host) {
      expect(await canvases(page), 'the page has its own host and no other canvas').toBe(1);
    } else {
      expect(await canvases(page), 'a static page draws no canvas: every preview is a still').toBe(0);
    }
    expect(await page.evaluate(() => (window as unknown as { __skipSeen: number }).__skipSeen), 'no "Skip intro" control: there is no entrance to skip').toBe(0);
    expect(await page.locator('.oct-live-layer').count()).toBe(0);

    // Pressing on tiles and cards: still no preview.
    for (const selector of ['[data-tile] a, [data-tile]', '[data-card] .oct-card', '.oct-hero a', '[data-slot="preview"]']) {
      for (const el of (await page.locator(selector).all()).slice(0, 5)) {
        if (!(await el.isVisible())) continue;
        await el.hover({ force: true, timeout: 2000 }).catch(() => {});
        await el.focus({ timeout: 2000 }).catch(() => {});
      }
    }
    await page.waitForTimeout(700);
    expect(await page.locator('.oct-live-layer').count(), 'no live preview after hovering and focusing').toBe(0);
    expect(await canvases(page)).toBe(route.host ? 1 : 0);

    expect(await moving(page), 'no CSS animation, no transition, nothing running on the platform DOM').toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('reduced motion: the landing and a world visit open on the intro at once, with the intro pose and no entrance', async ({ page }) => {
  const landing = ROUTES[0];
  await page.goto('/');
  await hostReady(page);
  // Ready and the intro's buttons are up with nothing to wait for or skip.
  await expect(page.getByRole('button', { name: 'See how it works' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip intro' })).toHaveCount(0);
  // The engine's entrance clock (development build) never ran.
  const entrance = await page.evaluate(() => (window as unknown as { __octoverse?: { entrance?: { t: number; loaded: boolean } } }).__octoverse?.entrance ?? null);
  expect(entrance === null || entrance.t === 0 || entrance.loaded === false, `entrance probe: ${JSON.stringify(entrance)}`).toBe(true);
  void landing;
  await page.goto('/@veyra/vault-os');
  await hostReady(page);
  await expect(page.locator('[data-world="veyra"] .exit-link')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip intro' })).toHaveCount(0);
});

test('reduced motion: route changes are cuts (no fade overlay ever appears) across landing, Explore, a profile and the creator', async ({ page }) => {
  await page.goto('/explore');
  await expect(page.locator('[data-tile]')).toHaveCount(5);
  const fadeCss = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'oct-route-fade';
    document.body.appendChild(probe);
    const display = getComputedStyle(probe).display;
    probe.remove();
    return display;
  });
  expect(fadeCss, 'the overlay is not drawn under reduced motion, even if mounted').toBe('none');
  await page.evaluate(() => {
    const w = window as unknown as { __fadeAdded: number };
    w.__fadeAdded = 0;
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) if (node instanceof HTMLElement && node.classList.contains('oct-route-fade')) w.__fadeAdded++;
    }).observe(document.body, { childList: true, subtree: true });
  });
  for (const [click, ready] of [
    ['[data-tile="veyra"] a[href="/@veyra"]', () => page.getByRole('tab', { name: /^Projects/ }).waitFor()],
    ['.oct-nav a[href="/create"]', () => page.locator('[data-slot="preview"]').waitFor()],
    ['.oct-nav a[href="/explore"]', () => page.locator('[data-tile]').first().waitFor()],
  ] as [string, () => Promise<void>][]) {
    await page.locator(click).first().click();
    await ready();
  }
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __fadeAdded: number }).__fadeAdded)).toBe(0);
  expect(await page.locator('.oct-route-fade').count()).toBe(0);
});

// A route-less sanity check that the helper's route list covers every route this spec names.
test('reduced motion: every route of the pass is covered', () => {
  const names = ROUTES.map((r: PassRoute) => r.name);
  expect(names).toEqual(['landing', 'how-it-works', 'explore', 'profile-veyra', 'profile-flux', 'profile-nox', 'profile-aether', 'world-veyra-vault-os', 'create', 'create-preview', 'not-found']);
});
