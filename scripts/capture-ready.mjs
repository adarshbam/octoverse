// Shared by stage-capture.mjs and world-capture.mjs: waits until the page has drawn a complete frame,
// instead of a fixed time that a loaded machine overruns (the world's kit not yet drawn, the sequence
// sheet not yet in). Throws on timeout, so a capture never silently saves a half-drawn page.
// A capture that the app only called ready because it gave up a wait (the kit's 15 s, the far plate's 20 s)
// would lack the kit or the plate: `window.__noxWorld` says whether they really loaded, and a world that
// lacks either is refused. DEV SERVER ONLY: `__noxWorld` is written by development builds (`import.meta.env.DEV`),
// so against a production build these captures cannot run.
export const READY_TIMEOUT_MS = 120_000;
export const SETTLE_MS = 700;

/**
 * Waits for the page to be ready, then settles. `mask` pages draw no world and set no `__noxReady`;
 * they wait for the canvas, the sequence sheets (blow, swell and entrance stills need them) and 40
 * drawn frames, the same count `__noxReady` waits for.
 */
export async function waitForReady(page, { mask = false, label = '' } = {}) {
  const fail = (what, error) => {
    throw new Error(`capture ${label}not ready (${what}) within ${READY_TIMEOUT_MS / 1000} s: ${error.message.split('\n')[0]}`);
  };
  try {
    if (mask) await page.waitForSelector('canvas', { timeout: READY_TIMEOUT_MS });
    else await page.waitForFunction(() => window.__noxReady === true, null, { timeout: READY_TIMEOUT_MS, polling: 250 });
  } catch (error) {
    fail(mask ? 'canvas' : 'window.__noxReady', error);
  }
  if (!mask) {
    // `__noxReady` is also set when the kit or the far plate was given up; a still taken then is not the world.
    let world;
    try {
      world = await page.evaluate(() => window.__noxWorld);
    } catch (error) {
      fail('window.__noxWorld', error);
    }
    if (!world || world.kit !== true || world.plate !== true) {
      throw new Error(`capture ${label}refused: the world did not fully load (window.__noxWorld = ${JSON.stringify(world ?? null)}; kit and plate must both be true). Dev server only: a loaded machine or a missing file left the kit or far plate out.`);
    }
  }
  // `__noxReady` does not wait for the Theatre sequence sheet (entrance, blow, swell): it loads on its
  // own promise, shared by all three. The dev server serves the module at this path; it is the app's instance.
  try {
    await page.evaluate(async () => { await (await import('/src/nox3d/sequences/theatre.ts')).loadSequences(); });
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
