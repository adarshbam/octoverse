// Usage: node scripts/review-capture.mjs <component> <out.png>
// Captures the component review page (reference, frozen, moving, orbit) at 1400x1000.
import { chromium } from '@playwright/test';
const [component, out] = process.argv.slice(2);
if (!component || !out) throw new Error('usage: review-capture.mjs <component> <out.png>');
const base = process.env.NOX_URL ?? 'http://localhost:5191';
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1.5 });
let failed = false;
page.on('pageerror', e => { failed = true; console.log('[pageerror]', e.message); });
await page.goto(`${base}/review.html?component=${component}`, { waitUntil: 'load' });
await page.waitForTimeout(6000);
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
if (failed) process.exit(1);
