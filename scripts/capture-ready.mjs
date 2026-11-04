// Shared by stage-capture.mjs and world-capture.mjs: waits until the page has drawn a complete frame,
// instead of a fixed time that a loaded machine overruns (the world's kit not yet drawn, the sequence
// sheet not yet in). Throws on timeout, so a capture never silently saves a half-drawn page.
// A capture that the app only called ready because it gave up a wait (the kit's 15 s, the far plate's 20 s)
// would lack the kit or the plate: `window.__octoverse.world` says whether they really loaded, and a world that
// lacks either is refused. The page instance of any world writes `window.__octoverse` (host/debugHooks.ts), so
// nothing here names one. DEV SERVER ONLY: `__octoverse.world` and `.sequences` are written by development
// builds (`import.meta.env.DEV`), so against a production build these captures cannot run.
export const READY_TIMEOUT_MS = 120_000;
export const SETTLE_MS = 700;

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
