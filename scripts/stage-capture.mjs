// Usage: node scripts/stage-capture.mjs <stage> <out.png> [extra query, e.g. tech=kali]
// Captures /?stage=<stage>&freeze at 506x504 (scale 2), plus <out>-mask.png (white silhouette).
import { chromium } from '@playwright/test';
const [stage, out, extra = ''] = process.argv.slice(2);
if (!stage || !out) throw new Error('usage: stage-capture.mjs <stage> <out.png> [extra]');
const base = process.env.NOX_URL ?? 'http://localhost:5191';
const query = (mask) => `/?stage=${stage}&freeze${mask ? '&mask' : ''}${extra ? `&${extra}` : ''}`;
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
let failed = false;
for (const mask of [false, true]) {
  const page = await browser.newPage({ viewport: { width: 506, height: 504 }, deviceScaleFactor: 2 });
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
