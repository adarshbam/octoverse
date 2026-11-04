// Shared by stage-capture.mjs and world-capture.mjs: waits until the page has drawn a complete frame,
// instead of a fixed time that a loaded machine overruns (the world's kit not yet drawn, the sequence
// sheet not yet in). Throws on timeout, so a capture never silently saves a half-drawn page.
// A capture that the app only called ready because it gave up a wait (the kit's 15 s, the far plate's 20 s)
// would lack the kit or the plate: `window.__octoverse.world` says whether they really loaded, and a world that
// lacks either is refused. The page instance of any world writes `window.__octoverse` (host/debugHooks.ts), so
// nothing here names one. DEV SERVER ONLY: `__octoverse.world` and `.sequences` are written by development
// builds (`import.meta.env.DEV`), so against a production build these captures cannot run.
// Fonts: Poppins comes from Google Fonts and the page waits for nothing; a face that arrives after the tech tooltip
// is laid out moves its glyphs by a device pixel (the techFocus drift, E02 diagnosis). `warmFonts` loads the three
// weights before each still, and `waitForReady` refuses a still whose page lacks them, so an unreachable Google Fonts
// FAILS the capture instead of saving a fallback-font still. The committed baseline was captured with Poppins loaded.
export const READY_TIMEOUT_MS = 120_000;
export const SETTLE_MS = 700;
export const FONT_TIMEOUT_MS = 30_000;
const POPPINS_WEIGHTS = ['400', '500', '600'];

/** In-page: the number of Poppins faces (weights 400, 500, 600) whose status is `loaded`. `document.fonts.check`
 *  is not used: it answers true for a family nothing defines (stylesheet never arrived). */
const loadedPoppinsWeights = (weights) => [...document.fonts].filter(f => f.family.replace(/["']/g, '') === 'Poppins' && f.status === 'loaded' && weights.includes(String(f.weight))).map(f => String(f.weight));

/**
 * Loads the three Poppins weights once on the app's own origin (the HTTP cache is keyed by the top-level site, so
 * the still's page, loaded next in the same page, has them from the cache at once), then forgets what the warm-up
 * page stored. Throws if the faces do not all arrive within FONT_TIMEOUT_MS (Google Fonts unreachable).
 */
export async function warmFonts(page, base) {
  await page.goto(base + '/?nowebgl', { waitUntil: 'load' });
  try {
    // The stylesheet is `media="print" onload=...`: the faces exist only once it has loaded, so wait for them to be defined.
    await page.waitForFunction(w => [...document.fonts].filter(f => f.family.replace(/["']/g, '') === 'Poppins' && w.includes(String(f.weight))).length >= w.length, POPPINS_WEIGHTS, { timeout: FONT_TIMEOUT_MS, polling: 100 });
    await page.evaluate(async (w) => { await Promise.all(w.map(x => document.fonts.load(`${x} 16px Poppins`))); }, POPPINS_WEIGHTS);
    const loaded = await page.evaluate(loadedPoppinsWeights, POPPINS_WEIGHTS);
    if (loaded.length < POPPINS_WEIGHTS.length) throw new Error(`only weights [${loaded.join(', ')}] loaded`);
  } catch (error) {
    throw new Error(`capture refused: Poppins did not load in ${FONT_TIMEOUT_MS / 1000} s (Google Fonts unreachable?): ${error.message.split('\n')[0]}`);
  }
  await page.evaluate(() => { sessionStorage.clear(); });
}

/**
 * Waits for the page to be ready, then settles. `mask` pages draw no world and set no ready flag;
 * they wait for the canvas, the sequence sheets (blow, swell and entrance stills need them) and 40
 * drawn frames, the same count the ready flag (`__octoverse.ready`) waits for.
 */
export async function waitForReady(page, { mask = false, label = '' } = {}) {
  const fail = (what, error) => {
    throw new Error(`capture ${label}not ready (${what}) within ${READY_TIMEOUT_MS / 1000} s: ${error.message.split('\n')[0]}`);
  };
  try {
    if (mask) await page.waitForSelector('canvas', { timeout: READY_TIMEOUT_MS });
    else await page.waitForFunction(() => window.__octoverse?.ready === true, null, { timeout: READY_TIMEOUT_MS, polling: 250 });
  } catch (error) {
    fail(mask ? 'canvas' : 'window.__octoverse.ready', error);
  }
  if (!mask) {
    // A still without Poppins (blocked or failed) is not the page: refuse it. A browser loads a face only when text
    // uses it, so a face the page never used stays 'unloaded' (400 on most stills): that is fine; 'error' or a missing
    // face is not, and at least one must be loaded.
    let faces;
    try {
      faces = await page.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].filter(f => f.family.replace(/["']/g, '') === 'Poppins').map(f => `${f.weight}:${f.status}`);
      });
    } catch (error) {
      fail('document.fonts', error);
    }
    if (faces.length < POPPINS_WEIGHTS.length || faces.some(f => f.endsWith(':error') || f.endsWith(':loading')) || !faces.some(f => f.endsWith(':loaded'))) {
      throw new Error(`capture ${label}refused: Poppins did not load (faces: [${faces.join(', ')}]; Google Fonts unreachable?)`);
    }
    // The ready flag is also set when the kit or the far plate was given up; a still taken then is not the world.
    let world;
    try {
      world = await page.evaluate(() => window.__octoverse?.world);
    } catch (error) {
      fail('window.__octoverse.world', error);
    }
    if (!world || world.kit !== true || world.plate !== true) {
      throw new Error(`capture ${label}refused: the world did not fully load (window.__octoverse.world = ${JSON.stringify(world ?? null)}; kit and plate must both be true). Dev server only: a loaded machine or a missing file left the kit or far plate out.`);
    }
  }
  // The ready flag does not wait for the Theatre sequence sheet (entrance, blow, swell): it loads on its
  // own promise, shared by all three. The page gives its own loader (`__octoverse.sequences`, the world's
  // set): the same promise the instance's sheets wait on.
  try {
    await page.waitForFunction(() => typeof window.__octoverse?.sequences === 'function', null, { timeout: READY_TIMEOUT_MS, polling: 100 });
    await page.evaluate(async () => { await window.__octoverse.sequences(); });
  } catch (error) {
    fail('sequence sheet', error);
  }
  if (mask) {
    try {
      await page.evaluate(() => new Promise(done => { let n = 0; const step = () => (++n >= 40 ? done() : requestAnimationFrame(step)); requestAnimationFrame(step); }));
    } catch (error) {
      fail('frames', error);
    }
  }
  await page.waitForTimeout(SETTLE_MS);
}
