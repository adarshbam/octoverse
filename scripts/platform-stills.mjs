// Usage: SET=world|creator node scripts/platform-stills.mjs   (SET=creator ONLY=aether.peach captures one)
// The platform's engine still pipeline (spec 7.14): every still is rendered by the engine through
// scripts/stage-capture.mjs, never painted or hand-edited, and reference art is never a still.
//   SET=world    four stills (nox, veyra, flux, aether): /?world=<id>&stage=intro&freeze&solo
//                (`solo` = the engine's review flag that hides the world's bubbles, the head dome and the
//                artifacts). The octoverse host is not in this set.
// Why not scripts/stage-capture.mjs itself: `solo` does not hide the HTML overlays (title, tagline, nameplate;
// `ui: 'none'` is a host prop, not a URL flag), and a still must be the octopus on its world with no UI chrome.
// So this script takes the same page, the same waits (capture-ready.mjs: Poppins, the ready flag, kit and plate
// both loaded, the sequence sheets, the settle) and the same screenshot, and only hides every DOM element that is
// not the canvas or its ancestors (`hideChrome`) just before the screenshot; the render itself is untouched.
//   SET=creator  the 36 creator stills (4 templates x 9 palettes, Original included): /?creator=<template>.<palette>&stage=intro&freeze&solo
//                (the dev-only review entry, src/platform/creator/review.ts: the engine's review page over a `u-review` bundle built
//                by assembleBundle; a still shows no personality, so each template wears its own world's). Same size, waits, chrome
//                hiding and encode as the world set. Files creator-<template>-<palette>.webp, manifest keys creator:<template>:<palette>.
// Size: 2x the largest card (spec 7.10). Task 8 builds the cards, so the card is sized from the P3 share table:
// the Flux box is 0.24 x 0.30 of a panel that fills the stage frame; at 1536 x 1024 that is a card of
// 369 x 307 CSS px, captured at device scale 2 = 738 x 614 px. This is an assumption, written into the
// manifest; resize here (CARD_CSS) if Task 8's real card differs.
// Encode: Pillow WebP, `quality` lowered until the file is <= 60 KB. Records src/platform/stills/manifest.json:
// { key, file, bundle, commit (git rev-parse --short HEAD at capture), date, bytes }.
// Own dev server on the FIXED port 5197 (strictPort), closed in finally; captures run one at a time.
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { warmFonts, waitForReady } from './capture-ready.mjs';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5197;
const URL_BASE = `http://localhost:${PORT}`;
const OUT_DIR = join(ROOT, 'public/platform/stills');
const MANIFEST = join(ROOT, 'src/platform/stills/manifest.json');
const MAX_BYTES = 60 * 1024;
const CARD_CSS = [369, 307]; // Flux card at 1536 x 1024: 0.24 x 1536, 0.30 x 1024
const SCALE = 2;
const KIT_WAIT_MS = 90_000; // dev-only `kitwait`: the first cold dev-server load on a shared GPU outlasts the engine's 15 s
const SIZE = { width: CARD_CSS[0] * SCALE, height: CARD_CSS[1] * SCALE };
const ASSUMPTION = 'Largest card = Flux card, P3 share table box 0.24 x 0.30 of a panel filling the stage frame; at 1536 x 1024 that is 369 x 307 CSS px; stills are 2x: 738 x 614 px. World stills: stage=intro, freeze, solo (engine review flag: no bubbles, head dome or artifacts) with the HTML overlays hidden, so the still is the octopus on its world only. Creator stills (4 templates x 9 palettes) are the same page through the dev-only ?creator=<template>.<palette> review entry, same size and flags. Task 8 may revise the card size.';
const WORLD_SET = ['nox', 'veyra', 'flux', 'aether'];
// The creator's ids (src/platform/creator/types.ts; this script cannot import TypeScript). Order: the house order of the templates.
const TEMPLATES = ['veyra', 'flux', 'nox', 'aether'];
const PALETTES = ['original', 'lavender', 'teal', 'mauve', 'rose', 'coral', 'peach', 'violet', 'lilacGrey'];

// Pillow: quality 90 downward until the WebP is <= MAX_BYTES; prints "quality bytes".
const ENCODE = `
import sys
from PIL import Image
src, dst, limit = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert('RGB')
for q in range(90, 9, -2):
    im.save(dst, 'WEBP', quality=q, method=6)
    import os
    n = os.path.getsize(dst)
    if n <= limit:
        print(q, n)
        sys.exit(0)
sys.exit('no quality fits ' + str(limit))
`;

const run = (cmd, args, env = {}) => {
  const r = spawnSync(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8' });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${r.status})`);
  return r.stdout;
};

/** In-page: hides everything that is not the canvas or one of its ancestors (the HTML overlays), and returns what text is still visible. */
const hideChrome = () => {
  const canvas = document.querySelector('canvas');
  if (!canvas) throw new Error('no canvas');
  const keep = new Set();
  for (let n = canvas; n; n = n.parentElement) keep.add(n);
  for (const n of keep) for (const c of n.children) if (!keep.has(c)) c.style.visibility = 'hidden';
  return document.body.innerText.trim();
};

/** One still: `query` is the address's own parameter (`world=nox` or `creator=nox.rose`); the page at the card's size, scale 2, waited ready like stage-capture, chrome hidden, saved as PNG. */
async function capture(browser, query, path) {
  const page = await browser.newPage({ viewport: { width: CARD_CSS[0], height: CARD_CSS[1] }, deviceScaleFactor: SCALE });
  let failed = false;
  page.on('pageerror', e => { failed = true; console.log('[pageerror]', e.message); });
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) console.log('[console]', m.text()); });
  await warmFonts(page, URL_BASE);
  await page.goto(`${URL_BASE}/?stage=intro&freeze&solo&kitwait=${KIT_WAIT_MS}&${query}`, { waitUntil: 'load' });
  await waitForReady(page, { label: `${query} ` });
  const text = await page.evaluate(hideChrome);
  if (text) throw new Error(`${query}: chrome text still visible after hideChrome: ${JSON.stringify(text.slice(0, 80))}`);
  await page.screenshot({ path });
  await page.close();
  if (failed) throw new Error(`${query}: page errors during capture`);
}

const set = process.env.SET ?? 'world';
if (set !== 'world' && set !== 'creator') throw new Error(`unknown SET=${set} (world | creator)`);

// What to capture: { key, file, bundle, query } per still.
const only = process.env.ONLY;
const jobs =
  set === 'world'
    ? WORLD_SET.map(w => ({ key: `world:${w}`, file: `${w}.webp`, bundle: w, query: `world=${encodeURIComponent(w)}` }))
    : TEMPLATES.flatMap(t => PALETTES.map(p => ({ key: `creator:${t}:${p}`, file: `creator-${t}-${p}.webp`, bundle: 'u-review', query: `creator=${t}.${p}` })));
const chosen = only ? jobs.filter(j => j.query.endsWith(`=${only}`)) : jobs;
if (chosen.length === 0) throw new Error(`ONLY=${only} matches no still`);

const commit = run('git', ['rev-parse', '--short', 'HEAD']).trim();
const date = new Date().toISOString().slice(0, 10);
const tmp = mkdtempSync(join(tmpdir(), 'octo-stills-'));
mkdirSync(OUT_DIR, { recursive: true });

const prior = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { entries: [] };
const entries = prior.entries.filter(e => !chosen.some(j => j.key === e.key));

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
const server = await createServer({ root: ROOT, logLevel: 'warn', server: { host: 'localhost', port: PORT, strictPort: true, watch: null } });
try {
  await server.listen();
  for (const job of chosen) {
    const png = join(tmp, `${job.file}.png`);
    await capture(browser, job.query, png);
    const dst = join(OUT_DIR, job.file);
    const [quality] = run('python', ['-c', ENCODE, png, dst, String(MAX_BYTES)]).trim().split(' ');
    const bytes = statSync(dst).size;
    console.log(`${job.key}: ${job.file} q${quality} ${bytes} bytes`);
    entries.push({ key: job.key, file: job.file, bundle: job.bundle, commit, date, bytes });
  }
} finally {
  await browser.close();
  await server.close();
  rmSync(tmp, { recursive: true, force: true });
}

entries.sort((a, b) => a.key.localeCompare(b.key));
writeFileSync(MANIFEST, JSON.stringify({ assumption: ASSUMPTION, ...SIZE, entries }, null, 2) + '\n');
console.log('manifest written:', MANIFEST);
