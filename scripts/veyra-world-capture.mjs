// Usage: node scripts/veyra-world-capture.mjs <out.png> [extra query, e.g. tier=low]
// Captures Veyra's intro in the vault at the owner's desktop size, the frame scripts/veyra_world.py's boxes are drawn on:
// /?world=veyra&stage=intro&freeze&tier=high at 1536 x 1024 (scale 1), plus <out>-mask.png (her silhouette, white on
// black) from the same URL with &mask. kitwait gives the kit and far plate time to load on a busy machine.
// Then: python scripts/veyra_world.py <out.png>
import { chromium } from '@playwright/test';
import { warmFonts, waitForReady } from './capture-ready.mjs';
const [out, extra = ''] = process.argv.slice(2);
if (!out || !out.endsWith('.png')) throw new Error('usage: veyra-world-capture.mjs <out.png> [extra]');
const base = process.env.NOX_URL ?? 'http://localhost:5191';
const query = (mask) => `/?world=veyra&stage=intro&freeze&tier=high&kitwait=90000${mask ? '&mask' : ''}${extra ? `&${extra}` : ''}`;
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
let failed = false;
try {
  for (const mask of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1536, height: 1024 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => { failed = true; console.log('[pageerror]', e.message); });
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) console.log('[console]', m.text().slice(0, 300)); });
    await warmFonts(page, base);
    await page.goto(base + query(mask), { waitUntil: 'load' });
    await waitForReady(page, { mask, label: 'veyra intro ' });
    const path = mask ? out.replace(/\.png$/, '-mask.png') : out;
    await page.screenshot({ path });
    console.log('saved', path);
    await page.close();
  }
} finally {
  await browser.close();
}
if (failed) process.exit(1);
