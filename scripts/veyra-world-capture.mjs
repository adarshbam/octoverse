// Usage: node scripts/veyra-world-capture.mjs <out.png> [extra query, e.g. tier=low]
// Captures Veyra's intro in the vault at the owner's desktop size, the frame scripts/veyra_world.py's boxes are drawn on:
// /?world=veyra&stage=intro&freeze&tier=high at 1536 x 1024 (scale 1), plus <out>-mask.png (her silhouette, white on
// black) from the same URL with &mask. kitwait gives the kit and far plate time to load on a busy machine.
// For veyra_world.py's no-red rule it also writes where the technology pendants are drawn (Task 15 fix round 1):
// <out>-solo.png, the same frame with &solo (the pendants, the dome glass and the ambient bubbles hidden; the frame is
// frozen, so every other pixel is the same), and <out>-pendants.json, each pendant's centre and button size on the page
// (the orb buttons follow the drawn orbs: centre at the orb's, size the orb's diameter or 44 px, whichever is larger).
// Then: python scripts/veyra_world.py <out.png>
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { warmFonts, waitForReady } from './capture-ready.mjs';
const [out, extra = ''] = process.argv.slice(2);
if (!out || !out.endsWith('.png')) throw new Error('usage: veyra-world-capture.mjs <out.png> [extra]');
const base = process.env.NOX_URL ?? 'http://localhost:5191';
const query = (variant) => `/?world=veyra&stage=intro&freeze&tier=high&kitwait=90000${variant ? `&${variant}` : ''}${extra ? `&${extra}` : ''}`;
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
let failed = false;
try {
  for (const variant of ['', 'mask', 'solo']) {
    const page = await browser.newPage({ viewport: { width: 1536, height: 1024 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => { failed = true; console.log('[pageerror]', e.message); });
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) console.log('[console]', m.text().slice(0, 300)); });
    await warmFonts(page, base);
    await page.goto(base + query(variant), { waitUntil: 'load' });
    await waitForReady(page, { mask: variant === 'mask', label: `veyra intro ${variant} ` });
    const path = variant ? out.replace(/\.png$/, `-${variant}.png`) : out;
    await page.screenshot({ path });
    console.log('saved', path);
    if (!variant) {
      // The pendants' places on the page: each orb button's centre and size (CSS px = capture px at scale 1).
      const pendants = await page.$$eval('.orb-button', els => els.map(el => {
        const r = el.getBoundingClientRect();
        return { name: el.getAttribute('aria-label'), x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.width };
      }));
      const json = out.replace(/\.png$/, '-pendants.json');
      writeFileSync(json, JSON.stringify(pendants, null, 2));
      console.log('saved', json, `(${pendants.length} pendants)`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
if (failed) process.exit(1);
