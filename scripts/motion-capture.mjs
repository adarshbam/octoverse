// Usage: node scripts/motion-capture.mjs <out>   (writes <out>.webm and <out>-sheet.png)
// Records 10 s of the live intro with a scripted pointer: idle 4 s with the pointer away, then a
// reach to the right arms, a reach to the left arms, and a hover over the face. The sheet tiles 12
// frames from the same recording, 0.83 s apart, left to right and top to bottom.
// Frames come from the browser's screencast and are encoded with ffmpeg (on PATH, with libvpx).
import { chromium } from '@playwright/test';
import { screencast } from './screencast.mjs';

const [out] = process.argv.slice(2);
if (!out) throw new Error('usage: motion-capture.mjs <out>');
const base = process.env.NOX_URL ?? 'http://localhost:5191';
const size = { width: 960, height: 640 };
const SECONDS = 10;
// Pointer stops in the 960x640 intro framing: past each side's arm tips, and over the face.
const AWAY = [940, 120];
const RIGHT = [780, 440];
const LEFT = [175, 440];
const FACE = [480, 400];
// The sheet's crop of each frame: the character, without the title above or the plate below.
const CROP = 'crop=660:330:150:268';

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('[pageerror]', e.message));
// The high tier is held so a slow machine does not step the quality down mid-recording.
await page.goto(`${base}/?stage=intro&tier=high`, { waitUntil: 'load' });
await page.waitForTimeout(5000);

let pointer = AWAY;
const drawn = await screencast(page, { out, seconds: SECONDS, size, sheet: `fps=1.2,${CROP},scale=480:-1,tile=4x3` }, async at => {
  // Moves the pointer to `to` between `from` and `until` ms on the timeline, eased.
  const glide = async (to, from, until) => {
    const [x0, y0] = pointer;
    const steps = Math.max(2, Math.round((until - from) / 33));
    for (let i = 1; i <= steps; i++) {
      await at(from + ((until - from) * i) / steps);
      const t = i / steps;
      const e = t * t * (3 - 2 * t);
      await page.mouse.move(x0 + (to[0] - x0) * e, y0 + (to[1] - y0) * e);
    }
    pointer = to;
  };
  // Idle: the pointer has not entered the page, so Nox breathes, floats, blinks and glances.
  await at(4000);
  await page.mouse.move(...AWAY);
  await glide(RIGHT, 4000, 5000);
  await glide(LEFT, 6000, 7200);
  await glide(FACE, 8000, 8800);
});
await browser.close();
console.log('saved', `${out}.webm`, `${out}-sheet.png`, `(${drawn} frames drawn, ~${(drawn / SECONDS).toFixed(0)} fps)`);
