import { expect, test, type Page, type TestInfo } from '@playwright/test';

// The creator's live preview and the octopus's reactions (platform Task 19b; spec 7.13, 2.6, 2.4, 7.14), at /create. One live
// context on this host-free page. Run with --workers=1, one browser at a time.
//
// TIMING. Spec bounds are production-build numbers. They are asserted by default; against a DEV server they are only recorded, with the
// annotation 'UNASSERTED (dev build)'; PLATFORM_LOOSE_TIMING=1 is the explicit opt-out for a saturated machine ('UNASSERTED (loose timing)'),
// as in platform-resources.spec.ts. Run production with playwright.creator-live-prod.config.ts (vite preview on 5197).
//
// ENGINE LIMIT (E02b): a running instance reads its bundle once, so a palette change is a NEW instance (a new canvas). One test below
// is an EXPECTED FAILURE (`test.fail`) that states the spec's criterion (same canvas, under 200 ms); when the engine gains a live
// character-config channel it starts passing, Playwright then reports it as failing, and the `test.fail` is to be removed.
//
// WHAT THE ENGINE LETS US READ. A preview instance reports nothing of its own (debugHooks.ts writes for the page instance only). So
// the reaction tests assert (a) the platform's labels, (b) in a dev build what the platform asked of the engine (`window.__platform.creator`:
// the `attend` targets, the faces held) and (c) the one thing the engine confirms: its `onStageChange` (`data-engine-stage`). They do not
// claim to see a blink, a smile or a wiggle drawn.

const picture = (page: Page) => page.locator('.oct-creator-picture');
const live = (page: Page) => page.locator('.oct-creator-picture[data-state="live"] .oct-live-layer.is-on');
const swatch = (page: Page, id: string) => page.locator(`[data-palette="${id}"]`).first();
const template = (page: Page, id: string) => page.locator(`button[data-template="${id}"]`);

/** The window-listener counter, installed by the spec itself (so it exists in a production build too): the number of distinct listeners now on the window. */
const COUNTER = `(() => {
  const ids = new WeakMap(); const live = new Set(); let next = 0;
  const key = (type, fn, o) => { if (fn === null || (typeof fn !== 'object' && typeof fn !== 'function')) return null; let id = ids.get(fn); if (id === undefined) ids.set(fn, (id = ++next)); return type + '|' + id + '|' + (typeof o === 'boolean' ? o : !!(o && o.capture)); };
  const add = window.addEventListener.bind(window); const remove = window.removeEventListener.bind(window);
  window.addEventListener = (t, f, o) => { const k = key(t, f, o); if (k) live.add(k); return add(t, f, o); };
  window.removeEventListener = (t, f, o) => { const k = key(t, f, o); if (k) live.delete(k); return remove(t, f, o); };
  window.__specListeners = () => live.size;
})();`;

/** The listeners on the window now. Fails loudly if the counter is not there. */
async function listeners(page: Page): Promise<number> {
  const n = await page.evaluate(() => (window as unknown as { __specListeners?: () => number }).__specListeners?.());
  expect(typeof n, 'the spec installs a window listener counter (addInitScript): it must exist').toBe('number');
  return n as number;
}

let dev: boolean | undefined;
/** Whether the server is a vite DEV server (it serves its client at /@vite/client). */
async function isDev(page: Page): Promise<boolean> {
  // (`vite preview` answers every unknown path with index.html, so the answer must be JavaScript, not just 200.)
  dev ??= await page.request.get('/@vite/client').then(r => r.ok() && (r.headers()['content-type'] ?? '').includes('javascript'));
  return dev;
}

/** A spec timing bound: asserted unless this is a dev build or PLATFORM_LOOSE_TIMING=1, in which case it is recorded with an UNASSERTED annotation. */
async function bound(page: Page, info: TestInfo, what: string, ms: number, limit: number) {
  if (await isDev(page)) info.annotations.push({ type: 'UNASSERTED (dev build)', description: `${what}: ${Math.round(ms)} ms against ${limit} ms was not asserted` });
  else if (process.env.PLATFORM_LOOSE_TIMING === '1') info.annotations.push({ type: 'UNASSERTED (loose timing)', description: `${what}: ${Math.round(ms)} ms against ${limit} ms was not asserted` });
  else expect(ms, what).toBeLessThan(limit);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(COUNTER);
});

async function open(page: Page, width = 1536, height = 1024) {
  await page.setViewportSize({ width, height });
  await page.goto('/create');
  await page.waitForSelector('#oct-main');
  await page.waitForSelector('.oct-creator-picture');
  await expect(page.locator('[data-draft-status]')).toHaveAttribute('data-draft-status', 'saved', { timeout: 20_000 });
}

/** Tags the preview's current canvas, so a later read can tell whether it is the same node. */
const tagCanvas = (page: Page, tag: string) => page.evaluate(t => ((document.querySelector('.oct-creator-picture canvas') as unknown as Record<string, string> | null)!['__tag'] = t), tag);
const canvasTag = (page: Page) => page.evaluate(() => (document.querySelector('.oct-creator-picture canvas') as unknown as Record<string, string> | null)?.['__tag'] ?? null);
const canvasCount = (page: Page) => page.locator('canvas').count();

/** Watches the page's canvases: the most there ever were at once since this was called (`window.__maxCanvases`). */
const watchCanvases = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __maxCanvases: number };
    w.__maxCanvases = document.querySelectorAll('canvas').length;
    new MutationObserver(() => (w.__maxCanvases = Math.max(w.__maxCanvases, document.querySelectorAll('canvas').length))).observe(document.body, { childList: true, subtree: true });
  });
const maxCanvases = (page: Page) => page.evaluate(() => (window as unknown as { __maxCanvases: number }).__maxCanvases);

type Notes = { attend: { at: number; value: { x: number; y: number } | null }[]; face: { at: number; value: string | null }[] };
const notes = (page: Page) => page.evaluate(() => (window as unknown as { __platform?: { creator?: Notes } }).__platform?.creator ?? { attend: [], face: [] });

/** Clicks a palette swatch and measures IN the page (a busy page delays Playwright's own click, not the page's answer): ms from the click event to the new still, and to the old layer leaving. */
async function clickPalette(page: Page, id: string): Promise<{ still: number; layerOff: number }> {
  await page.evaluate(() => {
    const w = window as unknown as { __pal: { click: number; still: number; off: number } };
    w.__pal = { click: 0, still: 0, off: 0 };
    document.addEventListener('click', () => (w.__pal.click = performance.now()), { capture: true, once: true });
    const pic = document.querySelector('.oct-creator-picture')!;
    const seen = pic.getAttribute('data-still');
    const done = new MutationObserver(() => {
      if (!w.__pal.still && pic.getAttribute('data-still') !== seen) w.__pal.still = performance.now();
      if (!w.__pal.off && !pic.querySelector('.oct-live-layer.is-on')) w.__pal.off = performance.now();
    });
    done.observe(pic, { attributes: true, subtree: true, childList: true });
  });
  await swatch(page, id).click();
  await expect(picture(page)).toHaveAttribute('data-palette', id);
  await page.waitForFunction(() => (window as unknown as { __pal: { off: number } }).__pal.off > 0, null, { timeout: 5000 });
  return page.evaluate(() => {
    const p = (window as unknown as { __pal: { click: number; still: number; off: number } }).__pal;
    return { still: p.still - p.click, layerOff: p.off - p.click };
  });
}

test.describe('the live preview', () => {
  test('appears on desktop: one canvas (the page has no host), the preview over the still, aria-hidden and inert', async ({ page }) => {
    await open(page);
    await expect(live(page)).toHaveCount(1, { timeout: 60_000 });
    expect(await canvasCount(page)).toBe(1);
    await expect(page.locator('.oct-creator-picture canvas')).toHaveCount(1);
    const layer = page.locator('.oct-creator-picture .oct-live-layer');
    await expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(await layer.evaluate(el => el.hasAttribute('inert'))).toBe(true);
    // The picture is the template's backdrop: the preview fills the picture box.
    const box = (await picture(page).boundingBox())!;
    const canvas = (await page.locator('.oct-creator-picture canvas').boundingBox())!;
    expect(canvas.width).toBeGreaterThanOrEqual(box.width - 6);
    expect(canvas.height).toBeGreaterThanOrEqual(box.height - 6);
    // ... and no more than its cover box (a missing size container once made it the window's size: 1536 x 1280 behind a 480 x 384 clip).
    expect(canvas.width).toBeLessThanOrEqual(box.width * 1.1);
    expect(canvas.height).toBeLessThanOrEqual(box.height * 1.1);
    await expect(page.getByRole('button', { name: 'Overview', exact: true })).toBeVisible();
  });

  test('a palette change: the new colours on screen at once (the still), the old layer gone, then a new live preview', async ({ page }, info) => {
    const complaints: string[] = [];
    page.on('console', m => m.type() === 'error' && complaints.push(m.text()));
    await open(page);
    await expect(live(page)).toHaveCount(1, { timeout: 60_000 });
    await watchCanvases(page);
    const stillBefore = await picture(page).getAttribute('data-still');
    const { still, layerOff } = await clickPalette(page, 'teal');
    expect(await picture(page).getAttribute('data-still')).not.toBe(stillBefore);
    expect(await picture(page).getAttribute('data-still')).toContain('-teal.');
    const t0 = Date.now();
    await expect(live(page)).toHaveCount(1, { timeout: 30_000 });
    const showing = Date.now() - t0;
    console.log(`PALETTE (in the page, from the click event): new still ${Math.round(still)} ms, old layer off ${Math.round(layerOff)} ms; new live preview showing ${showing} ms after that; max canvases ${await maxCanvases(page)}`);
    info.annotations.push({ type: 'palette-change', description: `new still ${Math.round(still)} ms; old layer off ${Math.round(layerOff)} ms; showing ${showing} ms later` });
    await bound(page, info, 'palette: the new colours (the still) from the click event', still, 200);
    await bound(page, info, 'palette: the old layer gone from the click event', layerOff, 250);
    expect(await maxCanvases(page)).toBeLessThanOrEqual(2);
    expect(await canvasCount(page)).toBe(1);
    expect(complaints.filter(c => /same key|Encountered two children/.test(c))).toEqual([]);
  });

  // The spec's criterion (2.6: a palette change updates the live preview without a new canvas, in under 200 ms), stated as the test it
  // will become. It fails today because the engine reads a bundle once (E02b: no live character-config channel). When it passes,
  // Playwright reports the unexpected pass: then delete `test.fail` and the E02b note.
  test('a palette change keeps the same canvas and shows in under 200 ms', async ({ page }) => {
    test.fail(true, 'E02b: the engine has no live character-config channel; a palette change is a new instance');
    await open(page);
    await expect(live(page)).toHaveCount(1, { timeout: 60_000 });
    await tagCanvas(page, 'before');
    await swatch(page, 'teal').click();
    await expect(picture(page)).toHaveAttribute('data-palette', 'teal');
    const t0 = Date.now();
    await expect(live(page)).toHaveCount(1, { timeout: 30_000 });
    expect(await canvasTag(page), 'the same canvas node after the change').toBe('before');
    expect(Date.now() - t0, 'ms until the live preview shows the new palette').toBeLessThan(200);
  });

  test('a template change fades the preview out and shows a new one; back to a template already shown it is within 1.5 s', async ({ page }, info) => {
    await open(page);
    await expect(live(page)).toHaveCount(1, { timeout: 60_000 });
    await watchCanvases(page);
    // Each template is shown once (cold: its shaders compile for the first time in this browser), then again (warm: its code and its
    // compiled programs are there, the spec's "chunk cached" case). The cold times are recorded; the warm ones are the 1.5 s criterion.
    const order = ['veyra', 'nox', 'flux', 'veyra', 'nox', 'flux'];
    const seen = new Set<string>(['aether']);
    const lines: string[] = [];
    const warm: number[] = [];
    for (const id of order) {
      const t0 = Date.now();
      await template(page, id).click();
      await expect(picture(page)).toHaveAttribute('data-template', id);
      const still = Date.now() - t0;
      // From the page's own answer (the new template on screen), so a click the busy page took long to receive is not counted against it.
      const t1 = Date.now();
      await page.waitForFunction(() => !document.querySelector('.oct-creator-picture .oct-live-layer.is-on'));
      const faded = Date.now() - t1;
      await expect(live(page)).toHaveCount(1, { timeout: 40_000 });
      const showing = Date.now() - t1;
      const cold = !seen.has(id);
      seen.add(id);
      if (!cold) warm.push(showing);
      lines.push(`${id} ${cold ? 'cold' : 'warm'}: click to new still ${still} ms; then old layer off ${faded} ms, new preview showing ${showing} ms`);
    }
    console.log(['TEMPLATE:', ...lines].join(String.fromCharCode(10)));
    info.annotations.push({ type: 'template-change', description: lines.join(' | ') });
    for (const ms of warm) await bound(page, info, 'template change (warm) to the new preview showing', ms, 1500);
    expect(await maxCanvases(page)).toBeLessThanOrEqual(2);
  });

  test('the preview follows the chosen project: another project, and its technologies, make a new preview', async ({ page }, info) => {
    await open(page);
    await expect(live(page)).toHaveCount(1, { timeout: 60_000 });
    const first = await picture(page).getAttribute('data-project');
    const firstTech = await picture(page).getAttribute('data-tech');
    expect(first).toBeTruthy();
    expect(firstTech).toContain('react');
    await tagCanvas(page, 'sample');
    // A new project is selected when added: it has no technologies, so its preview differs from the first project's.
    await page.getByRole('button', { name: 'Add project' }).click();
    await expect(picture(page)).not.toHaveAttribute('data-project', first!);
    const second = (await picture(page).getAttribute('data-project'))!;
    await expect(picture(page)).toHaveAttribute('data-tech', '');
    await expect(live(page)).toHaveCount(1, { timeout: 30_000 });
    expect(await canvasTag(page), 'a new project is a new preview instance').toBeNull();
    // Its technologies change the preview again.
    await tagCanvas(page, 'second-empty');
    await page.getByLabel('Search technologies').fill('rust');
    await page.locator('[data-picker-id="rust"]').click();
    await expect(picture(page)).toHaveAttribute('data-tech', 'rust');
    expect(await picture(page).getAttribute('data-project')).toBe(second);
    const t1 = Date.now();
    await expect(live(page)).toHaveCount(1, { timeout: 30_000 });
    const showingTech = Date.now() - t1;
    expect(await canvasTag(page), 'other technologies are a new preview instance').toBeNull();
    // Back to the first project: its technologies are the preview's again (warm: this template has been drawn).
    await tagCanvas(page, 'second-rust');
    await page.locator(`[data-project-id="${first}"]`).click();
    await expect(picture(page)).toHaveAttribute('data-project', first!);
    await expect(picture(page)).toHaveAttribute('data-tech', firstTech!);
    const t2 = Date.now();
    await expect(live(page)).toHaveCount(1, { timeout: 30_000 });
    const showingBack = Date.now() - t2;
    expect(await canvasTag(page)).toBeNull();
    expect(await canvasCount(page)).toBe(1);
    info.annotations.push({ type: 'project-change', description: `technologies change to showing ${showingTech} ms; back to the first project ${showingBack} ms` });
    await bound(page, info, 'project switch (warm) to the new preview showing', showingBack, 1500);
    // The draft keeps what was edited: nothing about the preview stops a reload from showing the same project's technologies.
  });

  test('20 palette changes 40 ms apart: one coalesced remount, never more than two canvases, back to one; no window listener left behind', async ({ page }) => {
    await open(page);
    await expect(live(page)).toHaveCount(1, { timeout: 60_000 });
    const before = await listeners(page);
    await watchCanvases(page);
    const ids = ['teal', 'rose', 'coral', 'violet', 'mauve', 'peach', 'lavender', 'lilacGrey', 'original'];
    // In the page, 40 ms apart (a fast hand): Playwright's own click is slower than the coalescing window when the page is busy.
    await page.evaluate(async list => {
      for (let i = 0; i < 20; i++) {
        document.querySelector<HTMLElement>(`[data-palette="${list[i % list.length]}"]`)!.click();
        await new Promise(done => setTimeout(done, 40));
      }
    }, ids);
    await expect(live(page)).toHaveCount(1, { timeout: 40_000 });
    expect(await maxCanvases(page)).toBeLessThanOrEqual(2);
    expect(await canvasCount(page)).toBe(1);
    expect(await listeners(page)).toBe(before);
  });

  test('the Overview toggle: the engine moves the running instance to the overview and back (its onStageChange), same canvas', async ({ page }) => {
    await open(page);
    await expect(live(page)).toHaveCount(1, { timeout: 60_000 });
    await expect(picture(page)).toHaveAttribute('data-engine-stage', 'intro');
    await tagCanvas(page, 'one');
    const toggle = page.getByRole('button', { name: 'Overview', exact: true });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(picture(page)).toHaveAttribute('data-engine-stage', 'overview', { timeout: 10_000 });
    expect(await canvasTag(page)).toBe('one');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(picture(page)).toHaveAttribute('data-engine-stage', 'intro', { timeout: 10_000 });
    expect(await canvasTag(page)).toBe('one');
  });

  test('a new preview opens on the overview when the toggle is on (the stage survives the remount)', async ({ page }) => {
    await open(page);
    await expect(live(page)).toHaveCount(1, { timeout: 60_000 });
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await expect(picture(page)).toHaveAttribute('data-engine-stage', 'overview', { timeout: 10_000 });
    await swatch(page, 'rose').click();
    await expect(live(page)).toHaveCount(1, { timeout: 30_000 });
    await expect(picture(page)).toHaveAttribute('data-engine-stage', 'overview');
  });

  test('reaction labels: a palette change sparkles, a name change labels after the typing pauses (same canvas), a personality labels for 3 s', async ({ page }) => {
    await open(page);
    await expect(live(page)).toHaveCount(1, { timeout: 60_000 });
    await expect(page.locator('.oct-shimmer')).toHaveCount(0);
    await swatch(page, 'rose').click();
    await expect(page.locator('.oct-shimmer')).toHaveCount(1);
    await expect(picture(page)).toHaveAttribute('data-reaction', 'palette');
    await expect(picture(page)).toHaveAttribute('data-reaction', '', { timeout: 5000 });
    await expect(live(page)).toHaveCount(1, { timeout: 30_000 });
    // A name is not drawn: no new instance, a reaction after the typing pauses, gone after its hold.
    await tagCanvas(page, 'named');
    await page.getByLabel('Name', { exact: true }).fill('Ada');
    await expect(picture(page)).toHaveAttribute('data-reaction', 'name', { timeout: 3000 });
    expect(await canvasTag(page)).toBe('named');
    await expect(picture(page)).toHaveAttribute('data-reaction', '', { timeout: 5000 });
    // A personality is a new instance whose own idle runs; the label lasts 3 s.
    const t0 = Date.now();
    await page.locator('[data-personality="mysterious"]').click();
    await expect(picture(page)).toHaveAttribute('data-reaction', 'personality');
    await expect(picture(page)).toHaveAttribute('data-reaction', '', { timeout: 6000 });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(2800);
    await expect(live(page)).toHaveCount(1, { timeout: 30_000 });
  });

  test('what the platform asks of the engine (dev build: window.__platform.creator): gaze targets for the wiggle stand-in, the faces held for the name', async ({ page }) => {
    test.skip(!(await isDev(page)), 'the attend and face notes (window.__platform.creator) exist in the dev build only');
    await open(page);
    await expect(live(page)).toHaveCount(1, { timeout: 60_000 });
    const before = await notes(page);
    // Palette: the new instance has drawn, then attend is given left, right, left, right and released (null).
    await swatch(page, 'coral').click();
    await expect(live(page)).toHaveCount(1, { timeout: 30_000 });
    await expect.poll(async () => (await notes(page)).attend.length - before.attend.length, { timeout: 8000 }).toBeGreaterThanOrEqual(5);
    const targets = (await notes(page)).attend.slice(before.attend.length).map(n => n.value);
    expect(targets.at(-1)).toBeNull();
    const xs = targets.flatMap(t => (t ? [t.x] : []));
    expect(xs.length).toBe(4);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[2]).toBeLessThan(xs[3]);
    // Name: the stand-in blink (restful) then the smile (happy), then let go (null), and no new canvas.
    await tagCanvas(page, 'named');
    const faces0 = (await notes(page)).face.length;
    await page.getByLabel('Name', { exact: true }).fill('Bo');
    await expect.poll(async () => (await notes(page)).face.slice(faces0).map(n => n.value), { timeout: 8000 }).toEqual(['restful', 'happy', null]);
    expect(await canvasTag(page)).toBe('named');
  });

  test('reload keeps the draft and the preview comes back for it', async ({ page }) => {
    await open(page);
    await template(page, 'flux').click();
    await swatch(page, 'coral').click();
    await expect(page.locator('[data-draft-status]')).toHaveAttribute('data-draft-status', 'saved', { timeout: 10_000 });
    await expect(page.locator('[data-draft-status]')).toHaveText('Saved in this browser');
    await page.reload();
    await page.waitForSelector('.oct-creator-picture');
    await expect(picture(page)).toHaveAttribute('data-template', 'flux');
    await expect(picture(page)).toHaveAttribute('data-palette', 'coral');
    await expect(live(page)).toHaveCount(1, { timeout: 60_000 });
  });
});

test.describe('where there is no live preview', () => {
  test('a phone (390 x 844) shows the still only: no canvas, no preview layer, no Overview toggle; a palette change still changes the still', async ({ page }) => {
    await open(page, 390, 844);
    await page.waitForTimeout(2500);
    expect(await canvasCount(page)).toBe(0);
    await expect(page.locator('.oct-live-layer')).toHaveCount(0);
    await expect(picture(page)).toHaveAttribute('data-state', 'still');
    await expect(picture(page).locator('img.oct-still')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Overview', exact: true })).toHaveCount(0);
    await swatch(page, 'teal').click();
    await expect(picture(page)).toHaveAttribute('data-palette', 'teal');
    await expect(picture(page).locator('img.oct-still')).toHaveAttribute('src', /creator-aether-teal\.webp/);
    await page.waitForTimeout(800);
    expect(await canvasCount(page)).toBe(0);
    await expect(page.locator('.oct-live-layer')).toHaveCount(0);
  });

  test('reduced motion: the still only; 20 palette changes leave no canvas and no window listener behind', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await page.waitForTimeout(2500);
    expect(await canvasCount(page)).toBe(0);
    await expect(picture(page)).toHaveAttribute('data-state', 'still');
    const before = await listeners(page);
    const ids = ['teal', 'rose', 'coral', 'violet', 'mauve', 'peach', 'lavender', 'lilacGrey', 'original'];
    for (let i = 0; i < 20; i++) {
      await swatch(page, ids[i % ids.length]).click();
      expect(await canvasCount(page)).toBe(0);
    }
    await expect(picture(page)).toHaveAttribute('data-palette', ids[19 % ids.length]);
    await expect(picture(page).locator('img.oct-still')).toHaveAttribute('src', new RegExp(`creator-aether-${ids[19 % ids.length]}\\.webp`));
    // The sparkle is a motion: none either.
    await expect(page.locator('.oct-shimmer')).toHaveCount(0);
    expect(await listeners(page)).toBe(before);
  });
});
