// Usage: node scripts/platform-capture.mjs <stage> <out.png> [extra query, e.g. yaw=180]
// The platform's still capture for a world that has no kit yet (the host, `octoverse`, until the reef
// kit lands in platform Task 5). scripts/stage-capture.mjs refuses such a world: its page reports
// `__octoverse.world.kit === false`, because the kit's empty url fails to load and the world steps down
// to its last level (water, fog and light: the same backdrop a preview's `place: 'backdrop'` asks for,
// engine host/options.ts). This wrapper keeps every other wait of stage-capture (Poppins, the ready
// flag, the sequence sheets, 40 frames for the mask, the settle) and differs in two ways only:
//   - it accepts kit false for a world in KITLESS (any other world must load its kit, as before);
//   - it tolerates the kit loader's own page errors for that world (`Could not load : ...`), and
//     still fails on any other page error.
// Captures /?stage=<stage>&freeze&world=<id> at P2's panel size, 512 x 508 (scale 2), plus <out>-mask.png.
// WORLD=<id> (default octoverse); VIEW=WxH and SCALE=n choose another size. NOX_URL is the dev server.
// TODO(kitless): retire this once the host's kit lands (Task 5) and stage-capture.mjs takes the world.
import { chromium } from '@playwright/test';
import { warmFonts, SETTLE_MS, READY_TIMEOUT_MS } from './capture-ready.mjs';

const KITLESS = new Set(['octoverse']);
const KIT_ERROR = /^Could not load : /;

const [stage, out, extra = ''] = process.argv.slice(2);
if (!stage || !out) throw new Error('usage: platform-capture.mjs <stage> <out.png> [extra]');
const base = process.env.NOX_URL ?? 'http://localhost:5197';
const worldId = process.env.OCTO_WORLD || process.env.WORLD || 'octoverse';
const kitless = KITLESS.has(worldId);
const query = (mask) => `/?stage=${stage}&freeze${mask ? '&mask' : ''}${extra ? `&${extra}` : ''}&world=${encodeURIComponent(worldId)}`;
const [width, height] = (process.env.VIEW ?? '512x508').split('x').map(Number);
const scale = Number(process.env.SCALE ?? 2);

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
let failed = false;
try {
  for (const mask of [false, true]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
    page.on('pageerror', e => {
      if (kitless && KIT_ERROR.test(e.message)) return;
      failed = true;
      console.log('[pageerror]', e.message);
    });
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404') && !(kitless && /Could not load : |kit/.test(m.text()))) console.log('[console]', m.text()); });
    await warmFonts(page, base);
    await page.goto(base + query(mask), { waitUntil: 'load' });
    if (mask) await page.waitForSelector('canvas', { timeout: READY_TIMEOUT_MS });
    else {
      await page.waitForFunction(() => window.__octoverse?.ready === true, null, { timeout: READY_TIMEOUT_MS, polling: 250 });
      await page.evaluate(() => document.fonts.ready);
      const world = await page.evaluate(() => window.__octoverse?.world);
      // A kitless world must still have reached its backdrop with the far plate; any other world needs its kit.
      if (!world || world.plate !== true || (!kitless && world.kit !== true)) {
        throw new Error(`capture ${stage} refused: window.__octoverse.world = ${JSON.stringify(world ?? null)}`);
      }
    }
    await page.waitForFunction(() => typeof window.__octoverse?.sequences === 'function', null, { timeout: READY_TIMEOUT_MS, polling: 100 });
    await page.evaluate(async () => { await window.__octoverse.sequences(); });
    if (mask) await page.evaluate(() => new Promise(done => { let n = 0; const step = () => (++n >= 40 ? done() : requestAnimationFrame(step)); requestAnimationFrame(step); }));
    await page.waitForTimeout(SETTLE_MS);
    const path = mask ? out.replace(/\.png$/, '-mask.png') : out;
    await page.screenshot({ path });
    console.log('saved', path);
    await page.close();
  }
} finally {
  await browser.close();
}
if (failed) process.exit(1);
