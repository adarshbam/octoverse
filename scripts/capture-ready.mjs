// Shared by stage-capture.mjs and world-capture.mjs: waits until the page has drawn a complete frame,
// instead of a fixed time that a loaded machine overruns (the world's kit not yet drawn, the sequence
// sheet not yet in). Throws on timeout, so a capture never silently saves a half-drawn page.
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
