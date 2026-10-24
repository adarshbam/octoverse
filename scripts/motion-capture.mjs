// Usage: node scripts/motion-capture.mjs <out>   (writes <out>.webm and <out>-sheet.png)
// Records 10 s of the live intro with a scripted pointer: idle 4 s with the pointer away, then a
// reach to the right arms, a reach to the left arms, and a hover over the face. The sheet tiles 12
// frames from the same recording, 0.83 s apart, left to right and top to bottom.
// Frames come from the browser's screencast and are encoded with ffmpeg (on PATH, with libvpx).
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
await page.waitForTimeout(3000);

// Every frame the page draws, with the time it reached the screen (seconds since the epoch).
const frames = [];
const cdp = await page.context().newCDPSession(page);
cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
  frames.push({ data, time: metadata.timestamp });
  cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: size.width, maxHeight: size.height });

const start = Date.now();
const at = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, start + ms - Date.now())));
let pointer = AWAY;
// Moves the pointer to `to` between `from` and `until` ms on the timeline, eased.
async function glide(to, from, until) {
  const [x0, y0] = pointer;
  const steps = Math.max(2, Math.round((until - from) / 33));
  for (let i = 1; i <= steps; i++) {
    await at(from + ((until - from) * i) / steps);
    const t = i / steps;
    const e = t * t * (3 - 2 * t);
    await page.mouse.move(x0 + (to[0] - x0) * e, y0 + (to[1] - y0) * e);
  }
  pointer = to;
}

// Idle: the pointer has not entered the page, so Nox breathes, floats, blinks and glances.
await at(4000);
await page.mouse.move(...AWAY);
await glide(RIGHT, 4000, 5000);
await glide(LEFT, 6000, 7200);
await glide(FACE, 8000, 8800);
await at(SECONDS * 1000);
await cdp.send('Page.stopScreencast');
await browser.close();

// Each frame shows until the next one arrives; the timeline is cut to the scripted 10 s.
const t0 = start / 1000;
const kept = frames.filter(f => f.time >= t0 - 0.2 && f.time <= t0 + SECONDS);
if (kept.length < 2) throw new Error(`only ${kept.length} frames were captured`);
const dir = mkdtempSync(join(tmpdir(), 'nox-motion-'));
let list = '';
kept.forEach((f, i) => {
  const file = join(dir, `f${String(i).padStart(4, '0')}.jpg`);
  writeFileSync(file, Buffer.from(f.data, 'base64'));
  const end = i + 1 < kept.length ? kept[i + 1].time : t0 + SECONDS;
  const from = Math.max(f.time, t0);
  list += `file '${file.replace(/\\/g, '/')}'\nduration ${Math.max(0.001, end - from).toFixed(4)}\n`;
});
list += `file '${join(dir, `f${String(kept.length - 1).padStart(4, '0')}.jpg`).replace(/\\/g, '/')}'\n`;
writeFileSync(join(dir, 'frames.txt'), list);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'frames.txt'), '-vf', 'fps=30', '-t', String(SECONDS), '-c:v', 'libvpx', '-b:v', '4M', `${out}.webm`]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${out}.webm`, '-vf', `fps=1.2,${CROP},scale=480:-1,tile=4x3`, '-frames:v', '1', `${out}-sheet.png`]);
rmSync(dir, { recursive: true, force: true });
const rate = kept.length / SECONDS;
console.log('saved', `${out}.webm`, `${out}-sheet.png`, `(${kept.length} frames drawn, ~${rate.toFixed(0)} fps)`);
