// Usage: node scripts/stepped-capture.mjs <scenario> <out> [width height]
// Records a scenario frame by frame on a virtual clock, so the video shows the motion as it really
// runs whatever the machine's load: the page's clock (requestAnimationFrame, timers, performance)
// is stepped 1/30 s at a time, CSS and Web animations are held to the same virtual time, and each
// frame is screenshot. Writes <out>.webm (30 fps) and <out>-sheet.png (12 frames).
// Scenarios: focus (Kali, then TypeScript, then Escape), rapid (quick switching), open (intro to
// overview and back), idle (the overview with no input), keys (Tab to Kali, Shift+Tab, Escape),
// phone (taps on a touch phone: Kali from the tray, let go, TypeScript, Escape; give 390 844),
// detail (View Project, the pointer over the panel and still, then Escape; give 1280 720),
// journey (the visitor's way in: the intro, Explore, View Project, a look over the panel, Escape;
// give 1280 720), entrance (a first visit: Nox swims in and lands in the intro; give 1280 720).
// KEEP=<dir> keeps the frames there (f0000.png is the first, 1/30 s of the page's time apart).
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [scenario, out, w = '960', h = '640'] = process.argv.slice(2);
if (!scenario || !out) throw new Error('usage: stepped-capture.mjs <scenario> <out> [width height]');
const base = process.env.NOX_URL ?? 'http://localhost:5191';
const size = { width: Number(w), height: Number(h) };
const FPS = 30;
const extra = process.env.CAPTURE_QUERY ?? '';

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
const touch = scenario === 'phone';
const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' });
const page = await context.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
if (process.env.DEBUG) page.on('console', m => /focusin|pointerover|FOCUS/.test(m.text()) && console.log('[page]', m.text()));
const start = scenario === 'open' || scenario === 'journey' ? 'intro' : 'overview';
// The entrance is a first visit, with no stage in the address. The page's clock stands still from
// its first script, so the swim, timed from its own first frame, is recorded from that frame on.
const entrance = scenario === 'entrance';
if (entrance) {
  const now = Date.now();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now + 50);
  await page.goto(`${base}/?tier=high${extra}`, { waitUntil: 'load' });
} else {
  // The page runs on our clock from the start, so its time never jumps.
  await page.clock.install();
  await page.goto(`${base}/?stage=${start}&tier=high${extra}`, { waitUntil: 'load' });
  // From here the page's time moves only when we step it; otherwise it would also run on while each
  // (slow) screenshot is taken. The pause lands just ahead of the page's clock, which still runs.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  // Warm up: let the stage settle for 4 s of its own time.
  for (let i = 0; i < 40; i++) await page.clock.runFor(100);
}
// With `hidden`, also a button whose panel is still closed.
const centre = async (name, hidden = false) => {
  const box = await page.getByRole('button', { name, exact: true, includeHidden: hidden }).boundingBox();
  return [box.x + box.width / 2, box.y + box.height / 2];
};
const spots = scenario === 'focus' || scenario === 'rapid' || scenario === 'probe'
  ? { kali: await centre('Kali Linux'), ts: await centre('TypeScript'), html: await centre('HTML'), docker: await centre('Docker'), python: await centre('Python') }
  : {};

if (process.env.DEBUG) {
  await page.evaluate(() => {
    for (const type of ['focusin', 'pointerover']) document.addEventListener(type, e => console.log(type, e.target?.getAttribute?.('aria-label') ?? e.target?.className, performance.now().toFixed(0)), true);
  });
}
await page.evaluate(() => {
  // Hold every CSS and Web animation to the page's (virtual) clock.
  const seen = new WeakMap();
  window.__syncAnimations = () => {
    const now = performance.now();
    for (const a of document.getAnimations()) {
      if (!seen.has(a)) {
        // New since the last step: it began within that step, at most one frame ago.
        seen.set(a, now - Math.min(Number(a.currentTime ?? 0), 1000 / 30));
        a.pause();
      }
      a.currentTime = now - seen.get(a);
    }
  };
});

// The scenario's actions, at times in seconds.
let pointer = [size.width / 2, size.height - 12];
const startPoint = [...pointer];
const glideSteps = [];
const glide = (to, from, until) => {
  const steps = Math.max(2, Math.round((until - from) * FPS));
  const [x0, y0] = pointer;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t * t * (3 - 2 * t);
    glideSteps.push([from + ((until - from) * i) / steps, () => page.mouse.move(x0 + (to[0] - x0) * e, y0 + (to[1] - y0) * e)]);
  }
  pointer = to;
};
const actions = [];
let seconds = 10;
if (scenario === 'focus') {
  seconds = 12.5;
  actions.push([0.05, () => page.mouse.move(...startPoint)]);
  glide(spots.kali, 1.5, 2.3);
  glide(spots.ts, 5.5, 6.5);
  actions.push([9.2, () => page.keyboard.press('Escape')]);
} else if (scenario === 'rapid') {
  seconds = 8;
  actions.push([0.05, () => page.mouse.move(...startPoint)]);
  glide(spots.kali, 0.8, 1.2);
  glide(spots.html, 1.5, 1.9);
  glide(spots.docker, 2.1, 2.5);
  glide(spots.python, 2.7, 3.1);
  actions.push([5.6, () => page.keyboard.press('Escape')]);
} else if (scenario === 'open') {
  seconds = 9;
  actions.push([1.5, () => page.getByRole('button', { name: /Explore/ }).click()]);
  actions.push([6.0, () => page.keyboard.press('Escape')]);
} else if (scenario === 'keys') {
  // As many Tab presses as there are focusable things before the Kali orb, one every 0.3 s.
  const presses = await page.evaluate(() => {
    const order = [...document.querySelectorAll('button, a[href], input, [tabindex]')].filter(el => el.tabIndex >= 0 && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
    return order.findIndex(el => el.classList.contains('orb-button') && el.getAttribute('aria-label') === 'Kali Linux') + 1;
  });
  if (presses < 1) throw new Error('Kali orb not reachable by Tab');
  const reached = 1.0 + (presses - 1) * 0.3;
  for (let i = 0; i < presses; i++) actions.push([1.0 + i * 0.3, () => page.keyboard.press('Tab')]);
  actions.push([reached + 3.5, () => page.keyboard.press('Shift+Tab')]);
  actions.push([reached + 6.5, () => page.keyboard.press('Escape')]);
  seconds = reached + 9;
} else if (scenario === 'phone') {
  seconds = 11;
  const tray = async name => {
    const box = await page.locator(`.orb-tray-item[aria-label="${name}"]`).boundingBox();
    return [box.x + box.width / 2, box.y + box.height / 2];
  };
  const [kali, ts] = [await tray('Kali Linux'), await tray('TypeScript')];
  actions.push([1.0, () => page.touchscreen.tap(...kali)]);
  actions.push([4.5, () => page.touchscreen.tap(size.width / 2, 40)]);
  actions.push([6.0, () => page.touchscreen.tap(...ts)]);
  actions.push([9.0, () => page.touchscreen.tap(size.width / 2, 40)]);
} else if (scenario === 'detail') {
  seconds = 14;
  const view = await centre('View Project');
  actions.push([1.0, () => page.mouse.click(...view)]);
  pointer = view;
  glide([size.width * 0.62, size.height * 0.45], 4.5, 5.3);
  actions.push([11.0, () => page.keyboard.press('Escape')]);
} else if (scenario === 'journey') {
  seconds = 17;
  const view = await centre('View Project', true);
  actions.push([1.0, () => page.getByRole('button', { name: /Explore/ }).click()]);
  actions.push([4.0, () => page.mouse.click(...view)]);
  pointer = view;
  glide([size.width * 0.62, size.height * 0.45], 7.5, 8.3);
  actions.push([14.0, () => page.keyboard.press('Escape')]);
} else if (scenario === 'probe') {
  seconds = 1;
  actions.push([0.05, () => page.mouse.move(...startPoint)]);
} else if (entrance) {
  // The 2.5 s swim, then the intro's words come in.
  seconds = 4.5;
} else if (scenario !== 'idle') throw new Error(`unknown scenario ${scenario}`);
const timeline = [...actions, ...glideSteps].sort((a, b) => a[0] - b[0]);
if (process.env.SECONDS) seconds = Number(process.env.SECONDS);

if (!entrance) for (let i = 0; i < 3; i++) await page.clock.runFor(1000 / FPS);
const dir = process.env.KEEP ?? mkdtempSync(join(tmpdir(), 'nox-step-'));
mkdirSync(dir, { recursive: true });
const frames = Math.round(seconds * FPS);
let next = 0;
for (let f = 0; f < frames; f++) {
  const t = f / FPS;
  while (next < timeline.length && timeline[next][0] <= t) await timeline[next++][1]();
  await page.clock.runFor(1000 / FPS);
  await page.evaluate(() => window.__syncAnimations());
  writeFileSync(join(dir, `f${String(f).padStart(4, '0')}.png`), await page.screenshot());
}
await browser.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png'), '-c:v', 'libvpx', '-b:v', '5M', `${out}.webm`]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${out}.webm`, '-vf', `fps=${12 / seconds},scale=480:-1,tile=4x3`, '-frames:v', '1', `${out}-sheet.png`]);
if (!process.env.KEEP) rmSync(dir, { recursive: true, force: true });
console.log('saved', `${out}.webm`, `${out}-sheet.png`, `(${frames} frames, ${seconds} s)`);
