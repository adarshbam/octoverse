// Captures idle and cursor-interaction frames of the spike into spike-out/frames/.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://localhost:5191';
mkdirSync('spike-out/frames', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 506, height: 504 }, deviceScaleFactor: 1.5 });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`${base}/spike.html`, { waitUntil: 'load' });
const shot = async (name, wait) => { await page.waitForTimeout(wait); await page.screenshot({ path: `spike-out/frames/${name}.png` }); console.log('frame', name); };
await shot('1-idle-a', 2500);
await shot('2-idle-b', 1400);
await shot('3-idle-c', 1400);
await page.mouse.move(250, 300, { steps: 8 });
await page.mouse.move(430, 225, { steps: 20 });
await shot('4-reach-upper-right', 1500);
await page.mouse.move(25, 300, { steps: 25 });
await shot('5-reach-left', 1500);
await page.mouse.move(255, 330, { steps: 20 });
await shot('6-cursor-on-face', 1200);
const fps = await page.evaluate(() => new Promise(resolve => {
  let n = 0; const start = performance.now();
  const tick = () => { n++; if (performance.now() - start < 2000) requestAnimationFrame(tick); else resolve(n / ((performance.now() - start) / 1000)); };
  requestAnimationFrame(tick);
}));
console.log('headless fps', fps.toFixed(1));
await browser.close();
