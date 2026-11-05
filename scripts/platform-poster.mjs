// Usage: node scripts/platform-poster.mjs        (PORT=5297 moves the dev server; PW_CHANNEL picks the browser)
// The host's no-WebGL poster (platform spec 7.15, Task 21): the engine's own frozen intro of the host, 1536 x 1024, scale 1,
// with every HTML overlay hidden, saved as public/octoverse/poster-intro.webp (<= 150 KB; theme.poster declares the same
// width and height). The engine's Poster component draws it behind the platform's own HTML (the landing's text and buttons),
// cropped to cover, so it must carry no title, button or nameplate of its own. The pipeline is the platform's stills (same
// waits as scripts/capture-ready.mjs, the same chrome hiding as scripts/platform-stills.mjs): the render itself is untouched.
// The host has no kit (its world is the reef plate and water), so a page that reports `kit: false` is accepted for it,
// `plate` must be true. Own dev server on a fixed strict port, closed in finally.
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { warmFonts } from './capture-ready.mjs';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 5297);
const BASE = `http://localhost:${PORT}`;
const OUT = join(ROOT, 'public/octoverse/poster-intro.webp');
const MAX_BYTES = 150 * 1024;
const SIZE = { width: 1536, height: 1024 };

const ENCODE = `
import sys, os
from PIL import Image
src, dst, limit = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert('RGB')
for q in range(92, 9, -2):
    im.save(dst, 'WEBP', quality=q, method=6)
    n = os.path.getsize(dst)
    if n <= limit:
        print(q, n)
        sys.exit(0)
sys.exit('no quality fits ' + str(limit))
`;

/** In-page: hides everything that is not the canvas or one of its ancestors, and returns what text is still visible. */
const hideChrome = () => {
  const canvas = document.querySelector('canvas');
  if (!canvas) throw new Error('no canvas');
  const keep = new Set();
  for (let n = canvas; n; n = n.parentElement) keep.add(n);
  for (const n of keep) for (const c of n.children) if (!keep.has(c)) c.style.visibility = 'hidden';
  return document.body.innerText.trim();
};

const tmp = mkdtempSync(join(tmpdir(), 'octo-poster-'));
let browser;
let server;
try {
  browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
  server = await createServer({ root: ROOT, logLevel: 'warn', server: { host: 'localhost', port: PORT, strictPort: true, watch: null } });
  await server.listen();
  const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
  let failed = false;
  page.on('pageerror', e => { if (!/^Could not load : /.test(e.message)) { failed = true; console.log('[pageerror]', e.message); } });
  await warmFonts(page, BASE);
  await page.goto(`${BASE}/?stage=intro&freeze&world=octoverse`, { waitUntil: 'load' });
  // waitForReady refuses a world without its kit; the host has none, so the same waits are repeated for it.
  await page.waitForFunction(() => window.__octoverse?.ready === true, null, { timeout: 120_000, polling: 250 });
  await page.evaluate(() => document.fonts.ready);
  const world = await page.evaluate(() => window.__octoverse?.world);
  if (!world || world.plate !== true) throw new Error(`poster refused: window.__octoverse.world = ${JSON.stringify(world ?? null)}`);
  await page.waitForFunction(() => typeof window.__octoverse?.sequences === 'function', null, { timeout: 120_000, polling: 100 });
  await page.evaluate(async () => { await window.__octoverse.sequences(); });
  await page.waitForTimeout(1500);
  const text = await page.evaluate(hideChrome);
  if (text) throw new Error(`chrome text still visible after hideChrome: ${JSON.stringify(text.slice(0, 80))}`);
  const png = join(tmp, 'poster.png');
  await page.screenshot({ path: png });
  if (failed) throw new Error('page errors during capture');
  const r = spawnSync('python', ['-c', ENCODE, png, OUT, String(MAX_BYTES)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`encode failed: ${r.stderr}`);
  console.log(`poster: q/bytes ${r.stdout.trim()}; file ${statSync(OUT).size} bytes -> ${OUT}`);
} finally {
  await browser?.close();
  await server?.close();
  rmSync(tmp, { recursive: true, force: true });
}
