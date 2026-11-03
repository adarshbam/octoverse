// Usage: node scripts/world-capture.mjs <stage> <out.png> [extra query, e.g. tier=high]
// Captures /?stage=<stage>&freeze&view=<HQ panel 2 box> at 1536x1024 (scale 1), plus
// <out>-mask.png (white silhouette on black) from the same URL with &mask. The view box frames
// exactly the HQ panel 2 image (world (x, y) -> px (783.6 + 204.5 x, 495.4 - 204.5 y)), so a render
// pixel is an HQ pixel.
import { chromium } from '@playwright/test';
import { waitForReady } from './capture-ready.mjs';
const [stage, out, extra = ''] = process.argv.slice(2);
if (!stage || !out) throw new Error('usage: world-capture.mjs <stage> <out.png> [extra]');
const base = process.env.NOX_URL ?? 'http://localhost:5191';
const VIEW = '-3.8318,2.4225,3.6792,-2.5848';
const query = (mask) => `/?stage=${stage}&freeze&view=${VIEW}${mask ? '&mask' : ''}${extra ? `&${extra}` : ''}`;
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
let failed = false;
try {
  for (const mask of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1536, height: 1024 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => { failed = true; console.log('[pageerror]', e.message); });
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) console.log('[console]', m.text()); });
    await page.goto(base + query(mask), { waitUntil: 'load' });
    // Waits for `__noxReady` (the world's kit and far plate drawn, 40 frames), then a short settle.
    await waitForReady(page, { mask, label: `${stage} ` });
    const path = mask ? out.replace(/\.png$/, '-mask.png') : out;
    await page.screenshot({ path });
    console.log('saved', path);
    await page.close();
  }
} finally {
  await browser.close();
}
if (failed) process.exit(1);
