// Usage: node scripts/focus-capture.mjs <out>   (writes <out>.webm and <out>-sheet.png)
// Records technology focus in the overview (11 s): 1.5 s idle, the pointer glides onto the Kali
// Linux orb, then on to TypeScript, then Escape lets go. The sheet tiles 12 frames, about 0.9 s apart.
import { chromium } from '@playwright/test';
import { screencast } from './screencast.mjs';

const [out] = process.argv.slice(2);
if (!out) throw new Error('usage: focus-capture.mjs <out>');
const base = process.env.NOX_URL ?? 'http://localhost:5191';
const size = { width: 960, height: 640 };
const SECONDS = 11;

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`${base}/?stage=overview&tier=high`, { waitUntil: 'load' });
await page.waitForTimeout(5000);
const centre = async name => {
  const box = await page.getByRole('button', { name, exact: true }).boundingBox();
  return [box.x + box.width / 2, box.y + box.height / 2];
};
const kali = await centre('Kali Linux');
const typescript = await centre('TypeScript');

let pointer = [size.width / 2, size.height - 20];
await page.mouse.move(...pointer);
const drawn = await screencast(page, { out, seconds: SECONDS, size, sheet: `fps=${12 / SECONDS},scale=480:-1,tile=4x3` }, async at => {
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
  await glide(kali, 1500, 2300);
  await glide(typescript, 5500, 6500);
  await at(9200);
  await page.keyboard.press('Escape');
});
await browser.close();
console.log('saved', `${out}.webm`, `${out}-sheet.png`, `(${drawn} frames drawn, ~${(drawn / SECONDS).toFixed(0)} fps)`);
