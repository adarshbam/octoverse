import { expect, test, type Page } from '@playwright/test';

// The landing compositions (platform spec 7.8, 7.10, 7.15 and 2.5): the intro at `/` and How It Works
// at `/how-it-works`, over the live host (`ui: 'none'`). At 1536 x 1024, 768 x 1024 and 390 x 844 no
// card, button or text rectangle meets the host's eyes or mouth; the page never scrolls sideways; on
// the phone the cards are a snap row below the host. The development build writes the host's face
// rectangles to `window.__platform.faceRect` (from the face anchor, the face layout and the live shift).
// The entrance is skipped: the session has seen it.

const SIZES = [
  { name: 'desktop', width: 1536, height: 1024 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 390, height: 844 },
] as const;

type Rect = { left: number; top: number; right: number; bottom: number };
type FaceRect = { eyes: Rect[]; mouth: Rect };

test.setTimeout(120_000);

async function open(page: Page, size: (typeof SIZES)[number], path: '/' | '/how-it-works') {
  await page.setViewportSize({ width: size.width, height: size.height });
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('octoverse.octoverse.entranceSeen', '1');
    } catch {
      /* no storage: the entrance would play, and the specs below would time out saying so */
    }
  });
  await page.goto(path);
  await page.waitForFunction(() => (window as unknown as { __octoverse?: { ready?: boolean } }).__octoverse?.ready === true, null, { timeout: 90_000 });
  if (path === '/') await expect(page.getByRole('button', { name: 'See how it works' })).toBeVisible();
  else await expect(page.getByRole('button', { name: /^Veyra, / })).toBeVisible();
  // The cards' ripple (600 ms) and the text's fade (250 ms) are over.
  await page.waitForTimeout(1200);
}

/** The visible text, buttons, links and cards of the landing layer, and the host's face, in CSS pixels. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const rects: { what: string; left: number; top: number; right: number; bottom: number; width: number; height: number }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('.oct-layer button, .oct-layer a, .oct-layer h1, .oct-layer p, .oct-layer li')) {
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (style.visibility === 'hidden' || Number(style.opacity) === 0 || r.width === 0 || r.height === 0) continue;
      if (el.closest('[inert]')) continue;
      const what = el.tagName.toLowerCase() + (el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : `[${(el.textContent ?? '').trim().slice(0, 30)}]`);
      rects.push({ what, left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
    }
    const probe = (window as unknown as { __platform?: { faceRect?: FaceRect } }).__platform;
    return { rects, face: probe?.faceRect ?? null, scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth };
  });
}

const meets = (a: Rect, b: Rect) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

for (const size of SIZES) {
  test.describe(`${size.name} ${size.width} x ${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (const path of ['/', '/how-it-works'] as const) {
      test(`${path}: nothing meets the host's eyes or mouth, and the page does not scroll sideways`, async ({ page }) => {
        await open(page, size, path);
        const { rects, face, scrollWidth, innerWidth } = await measure(page);
        expect(face, 'the development build writes window.__platform.faceRect').not.toBeNull();
        expect(rects.length).toBeGreaterThan(path === '/' ? 4 : 6);
        const parts: [string, Rect][] = [['left eye', face!.eyes[0]], ['right eye', face!.eyes[1]], ['mouth', face!.mouth]];
        const clearances: string[] = [];
        for (const r of rects) {
          for (const [name, part] of parts) {
            expect(meets(r, part), `${r.what} (${Math.round(r.left)},${Math.round(r.top)} to ${Math.round(r.right)},${Math.round(r.bottom)}) meets the ${name} (${Math.round(part.left)},${Math.round(part.top)} to ${Math.round(part.right)},${Math.round(part.bottom)})`).toBe(false);
          }
          // How far the rectangle is from the face's nearest part (0 would be touching).
          const gap = Math.min(...parts.map(([, p]) => Math.max(p.left - r.right, r.left - p.right, p.top - r.bottom, r.top - p.bottom)));
          clearances.push(`${r.what}: ${Math.round(gap)}`);
        }
        console.log(`${size.name} ${path} face eyes ${JSON.stringify(face!.eyes.map(e => [Math.round(e.left), Math.round(e.top), Math.round(e.right), Math.round(e.bottom)]))} mouth ${JSON.stringify([face!.mouth.left, face!.mouth.top, face!.mouth.right, face!.mouth.bottom].map(Math.round))}; nearest clearance ${clearances.sort((a, b) => Number(a.split(': ')[1]) - Number(b.split(': ')[1]))[0]}`);
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
        // 44 px targets (spec 7.15).
        for (const r of rects.filter(r => r.what.startsWith('button') || r.what.startsWith('a['))) {
          expect(r.height, `${r.what} is at least 44 px high`).toBeGreaterThanOrEqual(43.5);
        }
      });
    }
  });
}

test.describe('phone: How It Works is a snap row below the host', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('five cards in one row, below the host, snapping sideways, stills only', async ({ page }) => {
    await open(page, SIZES[2], '/how-it-works');
    const cards = page.getByRole('button', { name: /^(Veyra|Flux|Nox|Aether|Your Octopus), / });
    await expect(cards).toHaveCount(5);
    const boxes = await cards.evaluateAll(els => els.map(el => el.getBoundingClientRect().toJSON() as { x: number; y: number; width: number; height: number }));
    const hostBottom = 844 * 0.55;
    for (const b of boxes) {
      expect(Math.abs(b.y - boxes[0].y), 'one row').toBeLessThan(1);
      expect(b.y, 'below the host').toBeGreaterThanOrEqual(hostBottom - 1);
      expect(b.height).toBeGreaterThanOrEqual(120);
    }
    const row = await cards.first().evaluate(el => {
      let node: HTMLElement | null = el.parentElement;
      while (node && getComputedStyle(node).overflowX !== 'auto' && getComputedStyle(node).overflowX !== 'scroll') node = node.parentElement;
      if (!node) return null;
      const style = getComputedStyle(node);
      return { snap: style.scrollSnapType, scrolls: node.scrollWidth > node.clientWidth, rowWidth: node.clientWidth };
    });
    expect(row, 'a scrolling row holds the cards').not.toBeNull();
    expect(row!.snap).toMatch(/x/);
    expect(row!.scrolls).toBe(true);
    // Stills only: the host's canvas is the only one.
    await expect(page.locator('canvas')).toHaveCount(1);
    // The host's box is the upper 55%: its canvas ends there.
    const canvas = (await page.locator('canvas').boundingBox())!;
    expect(Math.round(canvas.y + canvas.height)).toBeLessThanOrEqual(Math.round(hostBottom) + 1);
  });

  test('the intro: title above the host, buttons below it', async ({ page }) => {
    await open(page, SIZES[2], '/');
    const hostBottom = 844 * 0.55;
    const title = (await page.getByText('OCTOVERSE', { exact: true }).boundingBox())!;
    const see = (await page.getByRole('button', { name: 'See how it works' }).boundingBox())!;
    const create = (await page.getByRole('button', { name: 'Create yours' }).boundingBox())!;
    expect(title.y + title.height).toBeLessThan(hostBottom / 2);
    expect(see.y).toBeGreaterThanOrEqual(hostBottom - 1);
    expect(create.y).toBeGreaterThanOrEqual(hostBottom - 1);
  });
});

test('desktop: See how it works opens How It Works, and Back returns to the intro', async ({ page }) => {
  await open(page, SIZES[0], '/');
  // The button drifts a pixel or so with the camera's hover, so the click does not wait for it to hold still.
  await page.getByRole('button', { name: 'See how it works' }).click({ force: true });
  await expect(page).toHaveURL(/\/how-it-works$/);
  await expect(page.getByRole('button', { name: /^Flux, / })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Your Octopus, / })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click({ force: true });
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'See how it works' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Flux, / })).toHaveCount(0);
});
