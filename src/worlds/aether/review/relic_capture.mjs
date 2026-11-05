// Spec 7.7 relic rule, the entrance half: the stills relic_entrance.py measures. Dev server running:
//
//   NOX_URL=http://127.0.0.1:5196 node src/worlds/aether/review/relic_capture.mjs <out-dir> [--running-only]
//
// Every still is a `view` window onto the same unmoved stage camera (VIEW_BOX below, 100 px a unit), so her and the
// portal share one exposure, tone mapping and bloom in every frame, and relic_entrance.py projects the portal the
// same way in all of them. It writes:
// - entering-t<t>.png (+ -mask.png, her silhouette): the frozen entrance at each of ENTRANCE_T (the real entrance
//   runs 6.3 s: Task 17). A frozen world holds its
//   glows at their mid level (the glow pulse is 1 - pulse / 2 while motion is held), so these stills show the
//   portal's glyph and lanterns at that level, not at their peak; the stack below covers the peak.
// - intro.png (+ -mask.png): the frozen intro in the same window, her face glow with her breath held (the reference
//   for the face-trough stills) and her silhouette for the pulse stills.
// - frames.json: ENTRANCE_T and the time the frozen stills were started, so relic_entrance.py can tell this run's
//   frames from a stale one's. Every old entering-t*.png, intro*.png, pulse-NNN.png and face-NNN.png is deleted
//   first (pulse and face stills only, with --running-only).
// - pulse-NNN.png: the intro running (not frozen), clipped to the portal's part of the window (PULSE_CLIP), one still
//   at least every PULSE_STEP s of world time for longer than the slowest portal pulse (the glyph's 7.5 s; the
//   lanterns' 4.3 s; config.ts WORLD_MATERIALS), so relic_entrance.py finds the portal at its brightest over a whole
//   pulse (with the bubbles rising past it filtered out: see there); the membrane's flash is driven only by an
//   `emissive` prop drive, which nothing in Aether's world or sequences targets, so it never fires. The stage is the
//   intro, not the entrance: the glows pulse on the world's clock whatever the stage, and in the intro she stays in
//   the middle of the window, away from the portal (her silhouette from intro-mask.png is left out in any case).
//   pulse-times.json records each still's time.
// - face-NNN.png: the intro running, clipped to her face (FACE_CLIP), for longer than her face glow's slowest swing.
//   The engine (Octopus.tsx) scales the face glow by 1 + 0.06 sin(breath) + 0.025 sin(0.37 t + 1.3) while she
//   moves (her breath is 5 s, character.ts; the drift 17 s) and holds it at 1 when frozen, so frozen stills show her
//   face glow at its middle, never its trough. These stills must end within REST_BY s of the page's start: after 40 s
//   idle in the intro she rests and the glow dims a further 15%, which the entrance never does. face-times.json
//   records each still's time and the page's age at the end.
// Exit 1 if any capture fails, if the pulse stills leave a gap longer than PULSE_STEP or cover less than one glyph
// period, or if the face stills leave a gap longer than FACE_STEP, cover less than FACE_COVER or end after REST_BY.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { warmFonts, waitForReady } from '../../../../scripts/capture-ready.mjs';

export const VIEW_BOX = '-3,4.165,9.5,-4.165';
const [WIDTH, HEIGHT] = [1250, 833];
// The real entrance's beats (Task 17, spec 7.9; sequences/defaults.ts ENTRANCE_BEATS): the glimmer (0.5), revealed (1),
// the strokes (2), the glyph firing, its peak (3.2: the membrane's emissive flash is at its top in this frozen frame, the
// kit drive being read at the frozen moment), the turn (4.2, 4.8, 5.3), the settle (6) and the end (6.3).
export const ENTRANCE_T = [0.5, 1, 2, 3.2, 4.2, 4.8, 5.3, 6, 6.3];
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
// Her face glow in the frozen intro spans x 115 to 490 and y 397 to 549 in this window; the clip leaves room for her sway.
export const FACE_CLIP = { x: 80, y: 360, width: 460, height: 230 };
// The drift's period (2 pi / 0.37 = 17.0 s) and a margin; a gap of at most FACE_STEP; the page's age limit (rest at 40 s).
const FACE_COVER = 17.5;
const FACE_STEP = 0.6;
const REST_BY = 39;

const base = process.env.NOX_URL ?? 'http://127.0.0.1:5196';
const out = process.argv[2];
// --running-only: only the running stills again (the frozen ones are the same every run), when a loaded machine left them sparse.
const runningOnly = process.argv[3] === '--running-only';
if (!out) throw new Error('usage: relic_capture.mjs <out-dir> [--running-only]');
mkdirSync(out, { recursive: true });
const stale = runningOnly ? /^(pulse|face)-\d{3}\.png$/ : /^((pulse|face)-\d{3}\.png|entering-t.*\.png|intro(-mask)?\.png|frames\.json)$/;
for (const f of readdirSync(out)) if (stale.test(f)) rmSync(join(out, f));
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

/** Clipped stills of the running intro until `cover` s have passed; their times (from the first) and the page's age at the end. */
async function running(prefix, clip, cover) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { failed = true; console.log('[pageerror]', e.message); });
  await warmFonts(page, base);
  await page.goto(`${base}/?stage=intro&${common}`, { waitUntil: 'load' });
  await waitForReady(page, { label: `intro running (${prefix}) ` });
  // The page's clock: performance.now() runs with the renderer's clock (both wall time); the world reads elapsedTime.
  const now = () => page.evaluate(() => performance.now() / 1000);
  const start = await now();
  const times = [];
  for (let i = 0; (times.at(-1) ?? 0) < cover; i++) {
    const before = await now();
    await page.screenshot({ path: join(out, `${prefix}-${String(i).padStart(3, '0')}.png`), clip });
    const after = await now();
    times.push(+((before + after) / 2 - start).toFixed(3));
    if (i > 300) throw new Error(`${prefix} stills: too many frames`);
  }
  const age = await now();
  await page.close();
  const widest = Math.max(...times.slice(1).map((t, i) => t - times[i]));
  console.log(`${prefix} stills: ${times.length} over ${times.at(-1).toFixed(2)} s, widest gap ${widest.toFixed(2)} s, page age at the end ${age.toFixed(1)} s`);
  return { times, widestGap: widest, pageAge: +age.toFixed(3), clip };
}

try {
  if (!runningOnly) {
    const started = Date.now();
    for (const t of ENTRANCE_T) {
      for (const mask of [false, true]) await still(`stage=entering&freeze&t=${t}&${common}`, join(out, `entering-t${t}${mask ? '-mask' : ''}.png`), mask);
    }
    for (const mask of [false, true]) await still(`stage=intro&freeze&${common}`, join(out, `intro${mask ? '-mask' : ''}.png`), mask);
    writeFileSync(join(out, 'frames.json'), JSON.stringify({ entranceT: ENTRANCE_T, started }, null, 1));
  }

  const pulse = await running('pulse', PULSE_CLIP, COVER);
  writeFileSync(join(out, 'pulse-times.json'), JSON.stringify({ ...pulse, glyphPeriod: GLYPH_PERIOD }, null, 1));
  if (pulse.widestGap > PULSE_STEP) { failed = true; console.log(`FAIL: a gap of ${pulse.widestGap.toFixed(2)} s between pulse stills (at most ${PULSE_STEP} s): run again on a quieter machine`); }
  if (pulse.times.at(-1) - pulse.times[0] < GLYPH_PERIOD) { failed = true; console.log('FAIL: the pulse stills cover less than one glyph period'); }

  const face = await running('face', FACE_CLIP, FACE_COVER);
  writeFileSync(join(out, 'face-times.json'), JSON.stringify(face, null, 1));
  if (face.widestGap > FACE_STEP) { failed = true; console.log(`FAIL: a gap of ${face.widestGap.toFixed(2)} s between face stills (at most ${FACE_STEP} s): run again on a quieter machine`); }
  if (face.times.at(-1) - face.times[0] < FACE_COVER - 0.5) { failed = true; console.log(`FAIL: the face stills cover less than ${FACE_COVER - 0.5} s`); }
  if (face.pageAge > REST_BY) { failed = true; console.log(`FAIL: the face stills ended ${face.pageAge.toFixed(1)} s after the page started (at most ${REST_BY} s: she rests at 40 s): run again`); }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
