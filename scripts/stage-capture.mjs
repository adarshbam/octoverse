// Usage: node scripts/stage-capture.mjs <stage> <out.png> [extra query, e.g. tech=kali]
// Captures /?stage=<stage>&freeze at 506x504 (scale 2), plus <out>-mask.png (white silhouette).
// The detail is a wide composition: it is captured at its high-quality panel's own size,
// 1672x941 (scale 1). VIEW=WxH and SCALE=n choose another size.
import { chromium } from '@playwright/test';
import { waitForReady } from './capture-ready.mjs';
const [stage, out, extra = ''] = process.argv.slice(2);
if (!stage || !out) throw new Error('usage: stage-capture.mjs <stage> <out.png> [extra]');
const base = process.env.NOX_URL ?? 'http://localhost:5191';
const query = (mask) => `/?stage=${stage}&freeze${mask ? '&mask' : ''}${extra ? `&${extra}` : ''}`;
const VIEWS = { detail: [1672, 941, 1] };
const [width, height, scale] = process.env.VIEW
  ? [...process.env.VIEW.split('x').map(Number), Number(process.env.SCALE ?? 1)]
  : VIEWS[stage] ?? [506, 504, 2];
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
let failed = false;
try {
  for (const mask of [false, true]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
    page.on('pageerror', e => { failed = true; console.log('[pageerror]', e.message); });
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) console.log('[console]', m.text()); });
    await page.goto(base + query(mask), { waitUntil: 'load' });
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
