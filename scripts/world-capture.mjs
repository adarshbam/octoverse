// Usage: node scripts/world-capture.mjs <stage> <out.png> [extra query, e.g. tier=high]
// Captures /?stage=<stage>&freeze&world&view=<HQ panel 2 box> at 1536x1024 (scale 1), plus
// <out>-mask.png (white silhouette on black) from the same URL with &mask. The view box frames
// exactly the HQ panel 2 image (world (x, y) -> px (783.6 + 204.5 x, 495.4 - 204.5 y)), so a render
// pixel is an HQ pixel. Until the world exists the app ignores `world` and shows the painted plate.
import { chromium } from '@playwright/test';
const [stage, out, extra = ''] = process.argv.slice(2);
if (!stage || !out) throw new Error('usage: world-capture.mjs <stage> <out.png> [extra]');
const base = process.env.NOX_URL ?? 'http://localhost:5191';
const VIEW = '-3.8318,2.4225,3.6792,-2.5848';
const query = (mask) => `/?stage=${stage}&freeze&world&view=${VIEW}${mask ? '&mask' : ''}${extra ? `&${extra}` : ''}`;
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
let failed = false;
for (const mask of [false, true]) {
  const page = await browser.newPage({ viewport: { width: 1536, height: 1024 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { failed = true; console.log('[pageerror]', e.message); });
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) console.log('[console]', m.text()); });
  await page.goto(base + query(mask), { waitUntil: 'load' });
  await page.waitForTimeout(mask ? 2500 : 4500);
  const path = mask ? out.replace(/\.png$/, '-mask.png') : out;
  await page.screenshot({ path });
  console.log('saved', path);
  await page.close();
}
await browser.close();
if (failed) process.exit(1);
