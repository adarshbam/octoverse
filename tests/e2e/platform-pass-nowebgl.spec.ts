import { chromium, expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { measureContrast } from './contrast';
import { ROUTES, SIZES, entrancesSeen, settleRoute } from './passRoutes';

// No WebGL (platform Task 21a; spec 7.15: a no-WebGL poster of the host's intro, every route still usable). A browser with no WebGL 2
// context (the page's own `getContext` answers null for webgl2/webgl, as the engine's own fallback.spec.ts does; the engine's
// `hasWebgl2()` then says no) gets:
//   - on the landing and How It Works the host's poster (public/octoverse/poster-intro.webp, named by the host's theme) under the
//     platform's HTML: the image is decoded (naturalWidth 1536), no canvas, the title, tagline, buttons and nav are all there and
//     usable (See how it works opens How It Works, Back returns), and no text or button meets the host's face in the poster (the face's
//     box is mapped through the image's `object-fit: cover; object-position: 50% 45%` from the poster's own pixels) at 1536 x 1024,
//     768 x 1024 and 390 x 844;
//   - on every other route its stills: Explore's five tiles, a profile's hero, the creator's picture, the not-found page, each with a
//     decoded image and no canvas, and no page error. A world visit is the engine's own page (its own poster, owned by the world):
//     this only checks the platform's route does not break (the exit control is there, no page error).
// And a real browser with WebGL switched off (`--disable-gpu --disable-3d-apis --disable-webgl`) gets the same on the landing.
// Why not `?nowebgl`: on `/` it is one of the ENGINE's review switches (src/app/main.tsx), so the address means "the engine's own page";
// that page is covered by fallback.spec.ts. Dev server, --workers=1.

test.setTimeout(120_000);

/** The page's `getContext` has no WebGL (this is what a browser with WebGL off or blocked does). */
async function noWebgl(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof original;
  });
}

/** The host's face in the poster's own pixels (poster-intro.webp, 1536 x 1024): both eyes and the mouth, with a margin. */
const POSTER_FACE = { left: 640, top: 545, right: 900, bottom: 710 };
const POSTER = { width: 1536, height: 1024, y: 0.45, x: 0.5 };

async function posterAndFace(page: Page) {
  return page.evaluate(
    ({ face, poster }) => {
      const img = document.querySelector<HTMLImageElement>('img.poster');
      if (!img) return null;
      const box = img.getBoundingClientRect();
      const scale = Math.max(box.width / poster.width, box.height / poster.height);
      const offsetX = (box.width - poster.width * scale) * poster.x;
      const offsetY = (box.height - poster.height * scale) * poster.y;
      return {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        src: img.getAttribute('src'),
        alt: img.alt,
        box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
        face: { left: box.left + offsetX + face.left * scale, top: box.top + offsetY + face.top * scale, right: box.left + offsetX + face.right * scale, bottom: box.top + offsetY + face.bottom * scale },
      };
    },
    { face: POSTER_FACE, poster: POSTER },
  );
}

const meets = (a: { left: number; top: number; right: number; bottom: number }, b: { left: number; top: number; right: number; bottom: number }) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

for (const size of [SIZES[0], SIZES[2], SIZES[3]]) {
  test(`no WebGL: the landing at ${size.width} x ${size.height} shows the poster, all its text and buttons, nothing on the face`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width: size.width, height: size.height });
    await entrancesSeen(page);
    await noWebgl(page);
    await page.goto('/');
    const img = page.locator('img.poster');
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate(i => (i as HTMLImageElement).naturalWidth)).toBe(1536);
    const info = (await posterAndFace(page))!;
    expect(info.src).toMatch(/octoverse\/poster-intro\.webp$/);
    expect(info.alt).toContain('OctoVerse');
    expect(info.naturalHeight).toBe(1024);
    expect(await page.locator('canvas').count()).toBe(0);
    // The platform's HTML over it, all usable.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'See how it works' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create yours/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'OctoVerse' })).toBeVisible();
    await page.waitForTimeout(600);
    const rects = await page.evaluate(() => {
      const out: { what: string; left: number; top: number; right: number; bottom: number }[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('.oct-layer button, .oct-layer a, .oct-layer h1, .oct-layer p, .oct-layer li')) {
        const style = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (style.visibility === 'hidden' || Number(style.opacity) === 0 || r.width === 0 || r.height === 0 || el.closest('[inert]')) continue;
        out.push({ what: `${el.tagName.toLowerCase()}[${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}]`, left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      }
      return out;
    });
    expect(rects.length).toBeGreaterThan(4);
    await page.screenshot({ path: join(process.cwd(), 'docs/superpowers/evidence/platform/pass', `nowebgl-landing-${size.width}x${size.height}.png`) });
    for (const r of rects) expect(meets(r, info.face), `${r.what} meets the poster's face (${JSON.stringify(info.face)})`).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    // And it is used: How It Works, then Back.
    await page.getByRole('button', { name: 'See how it works' }).click();
    await expect(page.getByRole('button', { name: /^Veyra, / })).toBeVisible();
    await expect(page).toHaveURL(/\/how-it-works$/);
    expect(await page.locator('canvas').count()).toBe(0);
    for (const id of ['veyra', 'flux', 'nox', 'aether', 'yours']) await expect(page.locator(`[data-card="${id}"] img.oct-still`)).toHaveAttribute('src', /.+/);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('button', { name: 'See how it works' })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

// The landing's text now sits on the poster, not on the live water: the same 4.5:1 (tests/e2e/contrast.ts says how it is sampled).
for (const size of [SIZES[0], SIZES[1], SIZES[2], SIZES[3]]) {
  test(`no WebGL: the landing's text at ${size.width} x ${size.height} is at least 4.5:1 on the poster`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await entrancesSeen(page);
    await noWebgl(page);
    await page.goto('/');
    await expect.poll(() => page.locator('img.poster').evaluate(i => (i as HTMLImageElement).naturalWidth)).toBe(1536);
    await page.waitForTimeout(800);
    const run = await measureContrast(page);
    const lowest = [...run.items].sort((a, b) => a.p5 - b.p5);
    console.log(`contrast nowebgl landing ${size.width}: ${run.sampled} text elements, lowest ${lowest[0]?.p5}:1 (${lowest[0]?.text})`);
    expect(run.sampled).toBeGreaterThan(4);
    // The wordmark is the one known exception (platform-pass-a11y.spec.ts CONTRAST_KNOWN: logotype in the approved gradient, 1.4 to 2.4:1 on the light shaft).
    expect(lowest.filter(i => i.p5 < 4.5 && i.text !== 'OCTOVERSE').map(i => `${i.tag} "${i.text}" ${i.p5}:1`)).toEqual([]);
  });
}

for (const route of ROUTES.filter(r => !['landing', 'how-it-works'].includes(r.name))) {
  test(`no WebGL: ${route.name} still works: stills decoded, no canvas, no error`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width: 1536, height: 1024 });
    await entrancesSeen(page);
    await noWebgl(page);
    await page.goto(route.path);
    if (route.engineOwned) {
      // The engine's own page: its poster and its controls are the world's (or the preview's). The platform's route must not break.
      await page.waitForSelector('#oct-main, .exit-link', { state: 'attached', timeout: 60_000 });
      await expect(page.locator('.exit-link').first()).toBeVisible({ timeout: 60_000 });
      expect(await page.locator('canvas').count()).toBe(0);
      expect(errors).toEqual([]);
      return;
    }
    await settleRoute(page, route);
    expect(await page.locator('canvas').count()).toBe(0);
    const stills = await page.evaluate(() => [...document.querySelectorAll<HTMLImageElement>('img.oct-still')].map(i => ({ src: i.getAttribute('src'), w: i.naturalWidth })));
    if (route.name === 'explore') expect(stills.length).toBeGreaterThanOrEqual(5);
    if (route.name.startsWith('profile-') || route.name === 'create') expect(stills.length).toBeGreaterThanOrEqual(1);
    for (const s of stills) expect(s.w, `${s.src} decoded`).toBeGreaterThan(0);
    await expect(page.locator('#oct-main')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('a real browser launched with WebGL switched off: the landing shows the poster and its text and buttons; Explore shows its stills', async ({ baseURL }) => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--disable-gpu', '--disable-3d-apis', '--disable-webgl', '--disable-webgl2'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1536, height: 1024 }, baseURL });
    const hasGl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
    test.skip(hasGl, 'this browser still offers WebGL 2 with the flags off: the stubbed-context tests above cover the no-WebGL path');
    await entrancesSeen(page);
    await page.goto('/');
    const img = page.locator('img.poster');
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate(i => (i as HTMLImageElement).naturalWidth)).toBe(1536);
    await expect(page.getByRole('button', { name: 'See how it works' })).toBeVisible();
    expect(await page.locator('canvas').count()).toBe(0);
    await page.goto('/explore');
    await expect(page.locator('[data-tile]')).toHaveCount(5);
    expect(await page.locator('canvas').count()).toBe(0);
  } finally {
    await browser.close();
  }
});
