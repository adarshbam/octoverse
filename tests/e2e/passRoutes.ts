import type { Page } from '@playwright/test';

// What the final-pass specs (platform-pass*.spec.ts, platform Task 21a) share: the platform's routes, the five widths, and how to
// open a route ready to be measured.

/** The five widths of spec 2.5 with the window height each is captured at (the file names of the stills carry both). */
export const SIZES = [
  { width: 1536, height: 1024 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 740 },
] as const;
export type Size = (typeof SIZES)[number];

export interface PassRoute {
  /** The route's name in the stills' file names. */
  name: string;
  path: string;
  /** The route draws a live host (WebGL): it is ready once the engine's ready flag is up. */
  host: boolean;
  /** The route's own page is the engine's (a world visit, the creator's full preview): its controls are the engine's. */
  engineOwned: boolean;
  /** The landing's two routes: a face rectangle exists (development build) and nothing of the platform may meet it. */
  face: boolean;
}

export const ROUTES: readonly PassRoute[] = [
  { name: 'landing', path: '/', host: true, engineOwned: false, face: true },
  { name: 'how-it-works', path: '/how-it-works', host: true, engineOwned: false, face: true },
  { name: 'explore', path: '/explore', host: false, engineOwned: false, face: false },
  { name: 'profile-veyra', path: '/@veyra', host: false, engineOwned: false, face: false },
  { name: 'profile-flux', path: '/@flux', host: false, engineOwned: false, face: false },
  { name: 'profile-nox', path: '/@nox', host: false, engineOwned: false, face: false },
  { name: 'profile-aether', path: '/@aether', host: false, engineOwned: false, face: false },
  { name: 'world-veyra-vault-os', path: '/@veyra/vault-os', host: true, engineOwned: true, face: false },
  { name: 'create', path: '/create', host: false, engineOwned: false, face: false },
  { name: 'create-preview', path: '/create/preview', host: true, engineOwned: true, face: false },
  { name: 'not-found', path: '/not-a-real-path', host: false, engineOwned: false, face: false },
];

/** Every entrance the session could play has been seen (the host, the four worlds, the creator's bundles). */
export async function entrancesSeen(page: Page) {
  await page.addInitScript(ids => {
    try {
      for (const id of ids) sessionStorage.setItem(`octoverse.${id}.entranceSeen`, '1');
    } catch {
      /* no storage: the entrance would play, and the waits below would time out saying so */
    }
  }, ['octoverse', 'veyra', 'flux', 'nox', 'aether', 'u-your-octopus', 'u-preview']);
}

/** The engine's ready flag (the world drawn and settled). */
export const hostReady = (page: Page) =>
  page.waitForFunction(() => (window as unknown as { __octoverse?: { ready?: boolean } }).__octoverse?.ready === true, null, { timeout: 120_000 });

/**
 * Opens a route at a size and waits until it has settled: fonts, images, a host's ready flag, and (the host's pages) the animations
 * of the page's own layer. `seen: false` leaves the entrances to play; `query` is added to the address (`?freeze` holds the host still for the contrast samples).
 */
export async function openRoute(page: Page, route: PassRoute, size: { width: number; height: number }, { seen = true, query = '' }: { seen?: boolean; query?: string } = {}) {
  await page.setViewportSize({ width: size.width, height: size.height });
  if (seen) await entrancesSeen(page);
  await page.goto(route.path + query);
  await settleRoute(page, route);
}

/** The waits of `openRoute`, for a page that is already navigating. */
export async function settleRoute(page: Page, route: PassRoute) {
  // A world visit and the full preview are the engine's pages: they have no platform main landmark (the platform's `#oct-main` is only the placeholder shown while the world loads).
  if (!route.engineOwned) await page.waitForSelector('#oct-main', { state: 'attached', timeout: 60_000 });
  if (route.host) {
    await hostReady(page);
    if (route.name === 'landing') await page.getByRole('button', { name: 'See how it works' }).waitFor({ state: 'visible' });
    else if (route.name === 'how-it-works') await page.getByRole('button', { name: /^Veyra, / }).waitFor({ state: 'visible' });
    else await page.locator('.exit-link').first().waitFor({ state: 'visible', timeout: 60_000 });
  } else if (route.name === 'create') await page.waitForSelector('[data-slot="preview"]');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map(i => (i.complete ? null : new Promise(done => { i.onload = i.onerror = done; })))));
  // The cards' ripple (600 ms), the text's fade (250 ms) and the camera's settle are over.
  await page.waitForTimeout(route.host ? 1200 : 300);
}

/**
 * Every control smaller than 44 px in either dimension, as `tag[label] w x h`, apart from the documented exemptions (the specs'
 * headers list each with its reason). The exemptions, by selector:
 *   skip      `.oct-skip-link` while it waits above the page (it is 48 px high once it has focus, and is measured then).
 *   sr-only   `.oct-sr-only`: text for a screen reader, not drawn.
 *   inert     anything inside `[inert]` or `[hidden]` or not drawn: it cannot be pressed.
 *   live      `.oct-live-layer`: a card's live preview, the engine's own inert, aria-hidden picture.
 *   engine    on a route whose page is the engine's (`engineOwned`), everything inside the engine's host (`[data-world]` and `[data-preview]`
 *             are the platform's wrappers, `.exit-link`, the nameplate and the detail panel are the engine's own DOM): the engine owns that
 *             UI (contract 19); the pass lists what it finds there (`engine`) and asserts nothing on it.
 *   host      on the landing's two routes the engine's DOM that is not the platform's layer (`.oct-layer`): with `ui: 'none'` that is the canvas
 *             and the engine's inert pieces.
 */
export async function smallTargets(page: Page, engineOwned: boolean): Promise<{ small: string[]; engine: string[] }> {
  return page.evaluate(owned => {
    const small: string[] = [];
    const engine: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('button, a, [role="tab"], input, summary')) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || r.width === 0 || r.height === 0) continue;
      if (el.closest('[hidden], [inert], .oct-sr-only, .oct-live-layer')) continue;
      if (el.matches('.oct-skip-link') && r.bottom <= 0) continue;
      if (el.matches('input[type="file"]') && r.width <= 1) continue;
      if (r.width >= 44 - 0.5 && r.height >= 44 - 0.5) continue;
      const label = `${el.tagName.toLowerCase()}[${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}] ${Math.round(r.width)} x ${Math.round(r.height)}`;
      const engineDom = owned && !el.closest('.oct-layer, .oct-nav') ? true : !!el.closest('.oct-landing') && !el.closest('.oct-layer');
      (engineDom ? engine : small).push(label);
    }
    return { small, engine };
  }, engineOwned);
}
