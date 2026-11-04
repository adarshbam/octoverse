// Usage: node scripts/world-capture.mjs <stage> <out.png> [extra query, e.g. tier=high]
// Captures /?stage=<stage>&freeze&view=<the reference's view box> at the reference's size, 1536x1024 for Nox (scale 1), plus
// <out>-mask.png (white silhouette on black) from the same URL with &mask. The view box frames
// exactly the reference image (Nox: HQ panel 2, world (x, y) -> px (783.6 + 204.5 x, 495.4 - 204.5 y)), so a render
// pixel is a reference pixel.
// WORLD=<id> (or OCTO_WORLD=<id>, which wins) adds world=<id> to the query (another world of the engine; unset, the page's default world, Nox).
// The framing is the world's own: src/worlds/<id>/review/world_reference.json (the reference image's size, the view box
// that frames it, its registration), next to its samples. A world with no such file is refused, not framed as Nox.
// A stage named in the reference's optional `stages` table (e.g. Veyra's overview, framed on panel 3) is captured at that
// entry's size instead; an entry with no `view` is the plain page (the stage camera, its lean and the HTML panels), not a zoom.
// Each page is first sent through warmFonts (Poppins into the app origin's cache; a still without Poppins is refused).
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { warmFonts, waitForReady } from './capture-ready.mjs';
const [stage, out, extra = ''] = process.argv.slice(2);
if (!stage || !out) throw new Error('usage: world-capture.mjs <stage> <out.png> [extra]');
const base = process.env.NOX_URL ?? 'http://localhost:5191';
const worldId = process.env.OCTO_WORLD || process.env.WORLD || '';
const world = worldId ? `&world=${encodeURIComponent(worldId)}` : '';
const referencePath = `src/worlds/${worldId || 'nox'}/review/world_reference.json`;
if (!existsSync(referencePath)) throw new Error(`no world reference for world '${worldId || 'nox'}': expected ${referencePath} (image, origin, pxPerUnit, size, view)`);
const reference = JSON.parse(readFileSync(referencePath, 'utf8'));
const staged = reference.stages?.[stage];
if (staged) {
  if (!staged.size) throw new Error(`${referencePath} stages.${stage} has no 'size'`);
} else for (const key of ['size', 'view']) if (!reference[key]) throw new Error(`${referencePath} has no '${key}'`);
const VIEW = staged ? staged.view : reference.view;
const [width, height] = staged ? staged.size : reference.size;
const query = (mask) => `/?stage=${stage}&freeze${VIEW ? `&view=${VIEW}` : ''}${mask ? '&mask' : ''}${extra ? `&${extra}` : ''}${world}`;
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
let failed = false;
try {
  for (const mask of [false, true]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
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
