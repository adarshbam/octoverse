// Usage: node scripts/platform-pages-capture.mjs [out-dir]   (ONLY=creator limits it to pages whose name starts with that)
// Static captures of the platform's profile, explore and not-found pages (platform Task 9, spec 7.8, 7.11, 7.12) at 1536 x 1024,
// 768 x 1024 and 390 x 844 (full viewport, device scale 1), through the temporary `?page=` switch of src/platform/App.tsx.
// Names: profile-<handle>-<w>x<h>.png, explore-<w>x<h>.png, notfound-<w>x<h>.png, creator-<w>x<h>.png (the creator, platform Task 10). NOX_URL is the dev server (default :5197).
// No WebGL on these pages: they hold stills only. Poppins is warmed first, as the other capture scripts do.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { warmFonts } from './capture-ready.mjs';

const base = process.env.NOX_URL ?? 'http://localhost:5197';
const out = resolve(process.argv[2] ?? 'docs/superpowers/evidence/platform/m3');
const SIZES = [[1536, 1024], [768, 1024], [390, 844]];
const PAGES = [
  ...['veyra', 'flux', 'nox', 'aether'].map(h => ({ name: `profile-${h}`, query: `page=profile&handle=${h}` })),
  { name: 'explore', query: 'page=explore' },
  { name: 'notfound', query: 'page=notfound' },
  { name: 'creator', query: 'page=create' },
].filter(p => !process.env.ONLY || p.name.startsWith(process.env.ONLY));

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
try {
  for (const [width, height] of SIZES) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    page.on('pageerror', e => console.log('[pageerror]', e.message));
    await warmFonts(page, base);
    for (const p of PAGES) {
      await page.goto(`${base}/?${p.query}`, { waitUntil: 'load' });
      await page.waitForSelector('#oct-main');
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => Promise.all([...document.images].map(i => (i.complete ? null : new Promise(done => { i.onload = i.onerror = done; })))));
      await page.waitForTimeout(400);
      const file = join(out, `${p.name}-${width}x${height}.png`);
      await page.screenshot({ path: file });
      console.log('saved', file);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
