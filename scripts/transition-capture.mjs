// Usage: node scripts/transition-capture.mjs <out>   (writes <out>.webm and <out>-sheet.png)
// Records the intro opening into the overview and closing again: 1.5 s on the intro, the
// nameplate pressed, 4.5 s in the overview, Escape, 3 s back on the intro (9 s). The sheet tiles
// 12 frames from the recording, 0.75 s apart.
import { chromium } from '@playwright/test';
import { screencast } from './screencast.mjs';

const [out] = process.argv.slice(2);
if (!out) throw new Error('usage: transition-capture.mjs <out>');
const base = process.env.NOX_URL ?? 'http://localhost:5191';
const size = { width: 960, height: 640 };
const SECONDS = 9;

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`${base}/?stage=intro&tier=high`, { waitUntil: 'load' });
await page.waitForTimeout(5000);
const nameplate = page.getByRole('button', { name: /Explore/ });

const drawn = await screencast(page, { out, seconds: SECONDS, size, sheet: `fps=${12 / SECONDS},scale=480:-1,tile=4x3` }, async at => {
  await at(1500);
  await nameplate.click();
  await at(6000);
  await page.keyboard.press('Escape');
});
await browser.close();
console.log('saved', `${out}.webm`, `${out}-sheet.png`, `(${drawn} frames drawn, ~${(drawn / SECONDS).toFixed(0)} fps)`);
