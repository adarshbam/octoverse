// Spec 7.7 relic rule, the entrance half: the stills relic_entrance.py measures. Dev server running:
//
//   NOX_URL=http://127.0.0.1:5196 node src/worlds/aether/review/relic_capture.mjs <out-dir> [--pulse-only]
//
// Every still is a `view` window onto the same unmoved stage camera (VIEW_BOX below, 100 px a unit), so her and the
// portal share one exposure, tone mapping and bloom in every frame, and relic_entrance.py projects the portal the
// same way in all of them. It writes:
// - entering-t<t>.png (+ -mask.png, her silhouette): the frozen entrance at each of ENTRANCE_T (the placeholder
//   entrance runs 8.4 s: the swim to 4.5 s, the hold, the opening, the spin and the settle). A frozen world holds its
//   glows at their mid level (the glow pulse is 1 - pulse / 2 while motion is held), so these stills show the
//   portal's glyph and lanterns at that level, not at their peak; the stack below covers the peak.
// - intro.png (+ -mask.png): the frozen intro in the same window, her face glow at rest (the reference for a frame
//   whose face glow is not found) and her silhouette for the stack.
// - pulse-NNN.png: the intro running (not frozen), clipped to the portal's part of the window (PULSE_CLIP), one still at least every PULSE_STEP s of world time for longer
//   than the slowest portal pulse (the glyph's 7.5 s; the lanterns' 4.3 s; config.ts WORLD_MATERIALS), so
//   relic_entrance.py finds the portal at its brightest over a whole pulse (with the bubbles rising past it filtered
//   out: see there); the membrane's flash is driven
//   only by an `emissive` prop drive, which nothing in Aether's world or sequences targets, so it never fires.
//   The stage is the intro, not the entrance: the glows pulse on the world's clock whatever the stage, and in the
//   intro she stays in the middle of the window, away from the portal (her silhouette from intro-mask.png is left
//   out in any case). pulse-times.json records each still's world time.
// Exit 1 if any capture fails, or if the pulse stills leave a gap longer than PULSE_STEP or cover less than one
// glyph period.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { warmFonts, waitForReady } from '../../../../scripts/capture-ready.mjs';

export const VIEW_BOX = '-3,4.165,9.5,-4.165';
const [WIDTH, HEIGHT] = [1250, 833];
export const ENTRANCE_T = [1, 2, 3.2, 4.5, 5.5, 6.5, 7.5, 8.4];
const GLYPH_PERIOD = 7.5;
// relic_entrance.py filters the bubbles out with a window of HOLD = 0.45 s either side of each still, so a gap must
// stay within the window (2 * HOLD; a wider gap only widens the pulse loss it allows for) and the stills must run a
// window's width past the period (plus a margin).
const PULSE_STEP = 0.9;
const COVER = GLYPH_PERIOD + 2;
// The pulse stills are clipped to the portal's part of the window (a whole frame takes too long under load to keep the
// gaps short); relic_entrance.py puts each clip back at this offset and checks the portal's region lies inside it.
// The portal's region in this window spans x 798 to 1185 and y 276 to 582; the smaller the clip, the denser the stills.
export const PULSE_CLIP = { x: 790, y: 270, width: 400, height: 320 };

const base = process.env.NOX_URL ?? 'http://127.0.0.1:5196';
const out = process.argv[2];
// --pulse-only: only the running stills again (the frozen ones are the same every run), when a loaded machine left them sparse.
const pulseOnly = process.argv[3] === '--pulse-only';
if (!out) throw new Error('usage: relic_capture.mjs <out-dir> [--pulse-only]');
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (/^pulse-\d{3}\.png$/.test(f)) rmSync(join(out, f));
const common = `view=${VIEW_BOX}&tier=high&kitwait=90000&world=aether`;

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
let failed = false;
async function still(query, path, mask) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { failed = true; console.log('[pageerror]', e.message); });
  await warmFonts(page, base);
  await page.goto(`${base}/?${query}${mask ? '&mask' : ''}`, { waitUntil: 'load' });
  await waitForReady(page, { mask, label: `${path} ` });
  await page.screenshot({ path });
  await page.close();
  console.log('saved', path);
}
try {
  if (!pulseOnly) {
    for (const t of ENTRANCE_T) {
      for (const mask of [false, true]) await still(`stage=entering&freeze&t=${t}&${common}`, join(out, `entering-t${t}${mask ? '-mask' : ''}.png`), mask);
    }
    for (const mask of [false, true]) await still(`stage=intro&freeze&${common}`, join(out, `intro${mask ? '-mask' : ''}.png`), mask);
  }

  // The running intro: stills against the page's own clock (the world's time is the renderer clock's elapsed time).
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { failed = true; console.log('[pageerror]', e.message); });
  await warmFonts(page, base);
  await page.goto(`${base}/?stage=intro&${common}`, { waitUntil: 'load' });
  await waitForReady(page, { label: 'intro running ' });
  // The page's clock: performance.now() runs with the renderer's clock (both wall time); the world reads elapsedTime.
  const now = () => page.evaluate(() => performance.now() / 1000);
  const start = await now();
  const times = [];
  for (let i = 0; (times.at(-1) ?? 0) < COVER; i++) {
    const before = await now();
    await page.screenshot({ path: join(out, `pulse-${String(i).padStart(3, '0')}.png`), clip: PULSE_CLIP });
    const after = await now();
    times.push(+((before + after) / 2 - start).toFixed(3));
    if (i > 200) throw new Error('pulse stills: too many frames');
  }
  await page.close();
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  const widest = Math.max(...gaps);
  writeFileSync(join(out, 'pulse-times.json'), JSON.stringify({ times, widestGap: widest, glyphPeriod: GLYPH_PERIOD, clip: PULSE_CLIP }, null, 1));
  console.log(`pulse stills: ${times.length} over ${times.at(-1).toFixed(2)} s, widest gap ${widest.toFixed(2)} s`);
  if (widest > PULSE_STEP) { failed = true; console.log(`FAIL: a gap of ${widest.toFixed(2)} s between pulse stills (at most ${PULSE_STEP} s): run again on a quieter machine`); }
  if (times.at(-1) - times[0] < GLYPH_PERIOD) { failed = true; console.log('FAIL: the pulse stills cover less than one glyph period'); }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
