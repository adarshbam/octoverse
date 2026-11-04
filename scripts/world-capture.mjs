// Usage: node scripts/world-capture.mjs <stage> <out.png> [extra query, e.g. tier=high]
// Captures /?stage=<stage>&freeze&view=<HQ panel 2 box> at 1536x1024 (scale 1), plus
// <out>-mask.png (white silhouette on black) from the same URL with &mask. The view box frames
// exactly the HQ panel 2 image (world (x, y) -> px (783.6 + 204.5 x, 495.4 - 204.5 y)), so a render
// pixel is an HQ pixel.
// WORLD=<id> adds world=<id> to the query (another world of the engine; unset, the page's default world, Nox).
// The view box below is Nox's HQ panel 2 (its samples are in src/worlds/nox/review).
// Each page is first sent through warmFonts (Poppins into the app origin's cache; a still without Poppins is refused).
import { chromium } from '@playwright/test';
import { warmFonts, waitForReady } from './capture-ready.mjs';
const [stage, out, extra = ''] = process.argv.slice(2);
if (!stage || !out) throw new Error('usage: world-capture.mjs <stage> <out.png> [extra]');
const base = process.env.NOX_URL ?? 'http://localhost:5191';
const VIEW = '-3.8318,2.4225,3.6792,-2.5848';
const world = process.env.WORLD ? `&world=${encodeURIComponent(process.env.WORLD)}` : '';
const query = (mask) => `/?stage=${stage}&freeze&view=${VIEW}${mask ? '&mask' : ''}${extra ? `&${extra}` : ''}${world}`;
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
let failed = false;
try {
  for (const mask of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1536, height: 1024 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => { failed = true; console.log('[pageerror]', e.message); });
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) console.log('[console]', m.text()); });
    // Poppins first, from the app's origin cache (see capture-ready.mjs): a late font shifts the tooltip glyphs.
    await warmFonts(page, base);
    await page.goto(base + query(mask), { waitUntil: 'load' });
    // Waits for the ready flag (`__octoverse.ready`) (the world's kit and far plate drawn, 40 frames), then a short settle.
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
