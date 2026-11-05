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

// Keyboard and focus (spec 2.5, 7.15): reading order, and focus that follows the view.
test.describe('keyboard', () => {
  test.use({ viewport: { width: 1536, height: 1024 } });

  /** What has focus: its accessible label or its text. */
  const focused = (page: Page) => page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el && el !== document.body ? el.getAttribute('aria-label') ?? (el.textContent ?? '').trim() : '(body)';
  });
  const focusedIs = (page: Page, name: string) => expect.poll(() => focused(page), { timeout: 10_000 }).toBe(name);

  test('Tab reads the skip link, the nav, then the buttons in reading order', async ({ page }) => {
    await open(page, SIZES[0], '/');
    const order: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      order.push(await focused(page));
    }
    expect(order).toEqual(['Skip to main content', 'OctoVerse', 'Explore', 'Create', 'See how it works', 'Create yours']);
  });

  test('Enter on See how it works puts focus on the first card; Back and Escape return it', async ({ page }) => {
    await open(page, SIZES[0], '/');
    for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
    await focusedIs(page, 'See how it works');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/how-it-works$/);
    await focusedIs(page, 'Veyra, The Keeper of Files');
    // The focus ring is drawn (an outline in the host's lavender) on the focused card.
    const ring = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as HTMLElement);
      return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor, shadow: style.boxShadow };
    });
    expect(ring.style).not.toBe('none');
    expect(parseFloat(ring.width)).toBeGreaterThanOrEqual(2);
    expect(ring.color).toBe('rgb(216, 200, 255)');
    expect(ring.shadow).not.toBe('none');
    // One heading, for the screen reader.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('How it works');
    // Back (the button) returns focus to the control that opened the view.
    let reached = '';
    for (let i = 0; i < 12 && reached !== 'Back'; i++) {
      await page.keyboard.press('Tab');
      reached = (await focused(page)).replace(/^←\s*/, '');
    }
    expect(reached).toBe('Back');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await focusedIs(page, 'See how it works');
    // Escape does the same.
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/how-it-works$/);
    await focusedIs(page, 'Veyra, The Keeper of Files');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/$/);
    await focusedIs(page, 'See how it works');
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// How It Works alive (platform Task 13; spec 7.10, 7.11, 7.12, 7.14, 2.4): the card ripple, the one-live-preview slot, `attend`
// with reach, live previews on cards, tiles and the profile hero. The host's canvas is the page's one context; a card's preview
// is the other: at most two canvases in the document, ever, and none at all on a phone or with reduced motion.
// ---------------------------------------------------------------------------------------------------------------------------

type Tip = { x: number; y: number };
type Attention = { gazeX: number; reachArm: number; tips: Tip[]; target: Tip };

/** Every canvas of the page: the host's, and a live preview's (inside a `.oct-live-layer`), with the card or tile it sits in. */
const canvases = (page: Page) =>
  page.evaluate(() => {
    const all = [...document.querySelectorAll('canvas')];
    const owner = (c: Element) => (c.closest('[data-card]') as HTMLElement | null)?.dataset.card ?? (c.closest('[data-tile]') as HTMLElement | null)?.dataset.tile ?? (c.closest('.oct-hero') ? 'hero' : null);
    return { total: all.length, previews: all.filter(c => c.closest('.oct-live-layer')).map(owner) };
  });
const attention = (page: Page) => page.evaluate(() => (window as unknown as { __octoverse?: { attention?: Attention } }).__octoverse?.attention ?? null);
const nearest = ({ tips, target }: Attention) => tips.reduce((best, tip, i) => (Math.hypot(tip.x - target.x, tip.y - target.y) < Math.hypot(tips[best].x - target.x, tips[best].y - target.y) ? i : best), 0);
const card = (page: Page, id: string) => page.locator(`[data-card="${id}"] .oct-card`);
/** The most canvases the document has held at once since the page's scripts began (a MutationObserver, so a canvas that lived for one frame still counts). */
const watchCanvases = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { __maxCanvases: number };
    w.__maxCanvases = 0;
    const count = () => (w.__maxCanvases = Math.max(w.__maxCanvases, document.querySelectorAll('canvas').length));
    new MutationObserver(count).observe(document, { childList: true, subtree: true });
  });
const maxCanvases = (page: Page) => page.evaluate(() => (window as unknown as { __maxCanvases: number }).__maxCanvases);
const listeners = (page: Page) => page.evaluate(() => (window as unknown as { __listenerCount?: (t: string) => number }).__listenerCount?.('*') ?? -1);
const HOST_ONLY = { total: 1, previews: [] };
/** How long a preview may take to unmount once its card is left. It is 300 ms of the platform's own; the rest is slack for a main thread that three other sessions' GPU work has starved (frames of 6 s were seen). */
const LEAVE_MS = 20_000;

test.describe('How It Works alive: desktop', () => {
  test.use({ viewport: { width: 1536, height: 1024 } });
  test.setTimeout(240_000);

  test('the cards ripple in reading order over 600 ms (CSS delays 0, 75, 150, 225, 300 ms of 300 ms each; and the frames that drew them)', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('octoverse.octoverse.entranceSeen', '1');
      // When each card first drew at more than half its opacity, in page-clock milliseconds.
      const seen: Record<string, number> = {};
      (window as unknown as { __ripple: Record<string, number> }).__ripple = seen;
      // The order the browser starts and ends the cards' animations in (a long frame on a busy GPU can put them in one frame, but never out of order).
      const events: string[] = [];
      (window as unknown as { __rippleEvents: string[] }).__rippleEvents = events;
      for (const type of ['animationstart', 'animationend'] as const) {
        document.addEventListener(type, e => (e.target as HTMLElement).dataset?.card && events.push(`${type}:${(e.target as HTMLElement).dataset.card}`), true);
      }
      const tick = () => {
        for (const el of document.querySelectorAll<HTMLElement>('[data-card]')) {
          const id = el.dataset.card!;
          if (!(id in seen) && Number(getComputedStyle(el).opacity) > 0.5) seen[id] = performance.now();
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto('/how-it-works');
    await expect(card(page, 'yours')).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(1500);
    const order = ['veyra', 'flux', 'nox', 'aether', 'yours'];
    const shown = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-card]')].map(el => el.dataset.card));
    expect(shown, 'five cards in reading order in the document').toEqual(order);
    // What the CSS says: delay i x 75 ms, 300 ms each, so the last one is in at 600 ms.
    const timing = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-card]')].map(el => {
        const style = getComputedStyle(el);
        return { name: style.animationName, delay: style.animationDelay, duration: style.animationDuration };
      }),
    );
    expect(timing.map(t => t.name)).toEqual(Array(5).fill('oct-ripple'));
    expect(timing.map(t => parseFloat(t.delay) * 1000)).toEqual([0, 75, 150, 225, 300]);
    expect(timing.map(t => parseFloat(t.duration) * 1000)).toEqual(Array(5).fill(300));
    // What was drawn: each card is more than half in no earlier than the one before it.
    const ripple = await page.evaluate(() => (window as unknown as { __ripple: Record<string, number> }).__ripple);
    const times = order.map(id => ripple[id]);
    const events = await page.evaluate(() => (window as unknown as { __rippleEvents: string[] }).__rippleEvents);
    for (const type of ['animationstart', 'animationend']) expect(events.filter(e => e.startsWith(type)).map(e => e.split(':')[1]), `${type} in reading order`).toEqual(order);
    console.log(`ripple: first drawn at ${times.map(t => (t - times[0]).toFixed(0)).join(', ')} ms after the first card`);
    for (let i = 1; i < times.length; i++) expect(times[i], `${order[i]} is not before ${order[i - 1]}`).toBeGreaterThanOrEqual(times[i - 1]);
    // The 600 ms itself is the CSS timing above: how long the frames take to be drawn is the shared GPU's (here the host is still loading its world), not the ripple's.
  });

  test("hovering Veyra, Flux then Nox within 500 ms leaves one live preview, and it is Nox's: two canvases in all", async ({ page }) => {
    await watchCanvases(page);
    await open(page, SIZES[0], '/how-it-works');
    expect(await canvases(page), 'at rest: the host only').toEqual(HOST_ONLY);
    const t0 = Date.now();
    await card(page, 'veyra').hover({ force: true });
    await card(page, 'flux').hover({ force: true });
    await card(page, 'nox').hover({ force: true });
    const took = Date.now() - t0;
    await expect.poll(() => canvases(page), { timeout: 30_000, message: "Nox's preview is the one canvas besides the host" }).toEqual({ total: 2, previews: ['nox'] });
    // It stays that way: Veyra's and Flux's lingering previews (300 ms) are gone, not waiting.
    await page.waitForTimeout(1500);
    expect(await canvases(page)).toEqual({ total: 2, previews: ['nox'] });
    expect(await maxCanvases(page), 'never more than the host and one preview at once').toBeLessThanOrEqual(2);
    // The still cross-fades to the picture: the layer is fully in.
    await expect.poll(() => page.locator('[data-card="nox"] .oct-live-layer').evaluate(el => Number(getComputedStyle(el).opacity)), { timeout: 30_000 }).toBe(1);
    console.log(`three hovers took ${took} ms; one preview, Nox's; max canvases ${await maxCanvases(page)}`);
    // Leaving unmounts it (after 300 ms).
    await page.mouse.move(5, 500);
    await expect.poll(() => canvases(page), { timeout: LEAVE_MS }).toEqual(HOST_ONLY);
    // Your Octopus never goes live: its picture stays the gold glyph.
    await card(page, 'yours').hover({ force: true });
    await page.waitForTimeout(1500);
    expect(await canvases(page)).toEqual(HOST_ONLY);
    await expect(page.locator('[data-card="yours"] [data-glyph="octopus"]')).toBeVisible();
  });

  test('the cross-fade: the picture is fully in a moment after it is asked to show, and a card left fades it out at once', async ({ page }) => {
    await open(page, SIZES[0], '/how-it-works');
    await card(page, 'flux').hover({ force: true });
    const layer = page.locator('[data-card="flux"] .oct-live-layer');
    // `is-on` is set once the preview's canvas has drawn a few frames; from then its opacity reaches 1 within the transition (250 ms) and slack.
    await page.locator('[data-card="flux"] .oct-live-layer.is-on').waitFor({ state: 'attached', timeout: 30_000 });
    const t0 = Date.now();
    await expect.poll(() => layer.evaluate(el => Number(getComputedStyle(el).opacity)), { timeout: 2_000, intervals: [25] }).toBe(1);
    const fade = Date.now() - t0;
    console.log(`fade from is-on to opacity 1: ${fade} ms`);
    expect(fade).toBeLessThan(650);
    await page.mouse.move(5, 500);
    await expect(page.locator('[data-card="flux"] .oct-live-layer.is-on')).toHaveCount(0);
  });

  test('keyboard focus turns the host toward the card and reaches the nearest arm; leaving lets both go (window.__octoverse.attention)', async ({ page }) => {
    await open(page, SIZES[0], '/how-it-works');
    await expect.poll(async () => (await attention(page))?.reachArm, { timeout: 5_000 }).toBe(-1);
    const sideOf = async (id: string) => {
      const c = (await card(page, id).boundingBox())!;
      const canvas = (await page.locator('canvas').first().boundingBox())!;
      return c.x + c.width / 2 - (canvas.x + canvas.width / 2);
    };
    // Veyra stands upper left, Nox upper right: the gaze follows.
    expect(await sideOf('veyra')).toBeLessThan(0);
    expect(await sideOf('nox')).toBeGreaterThan(0);
    await card(page, 'veyra').focus();
    expect(await page.evaluate(() => document.activeElement?.matches(':focus-visible')), 'a keyboard-style focus').toBe(true);
    await expect.poll(async () => (await attention(page))?.gazeX ?? 0, { timeout: 3_000 }).toBeLessThan(-0.1);
    await expect.poll(async () => (await attention(page))?.reachArm ?? -1, { timeout: 3_000 }).toBeGreaterThanOrEqual(0);
    const left = (await attention(page))!;
    expect(left.reachArm).toBe(nearest(left));
    expect(left.target.x).toBeLessThan(0);
    // Focus is a hover for the picture too: Veyra's preview mounts.
    await expect.poll(() => canvases(page), { timeout: 30_000 }).toEqual({ total: 2, previews: ['veyra'] });
    await card(page, 'nox').focus();
    await expect.poll(async () => (await attention(page))?.gazeX ?? 0, { timeout: 3_000 }).toBeGreaterThan(0.1);
    await expect.poll(async () => (await attention(page))?.target.x ?? 0, { timeout: 3_000 }).toBeGreaterThan(0);
    const right = (await attention(page))!;
    expect(right.reachArm).toBeGreaterThanOrEqual(0);
    expect(right.reachArm).toBe(nearest(right));
    expect(right.target.x).toBeGreaterThan(left.target.x);
    await expect.poll(() => canvases(page), { timeout: 30_000 }).toEqual({ total: 2, previews: ['nox'] });
    // Leaving lets go of the arm, the eyes and the preview.
    await card(page, 'nox').blur();
    await expect.poll(async () => (await attention(page))?.reachArm, { timeout: 3_000 }).toBe(-1);
    // (The eyes are free again, to the pointer and the world's own glances: where they look then is not the card's, so only the arm is held to a number.)
    await expect.poll(() => canvases(page), { timeout: LEAVE_MS }).toEqual(HOST_ONLY);
    // Your Octopus is looked at and reached for too, though it never goes live.
    await card(page, 'yours').focus();
    await expect.poll(async () => (await attention(page))?.reachArm ?? -1, { timeout: 3_000 }).toBeGreaterThanOrEqual(0);
    await page.waitForTimeout(1000);
    expect(await canvases(page)).toEqual(HOST_ONLY);
  });

  test("a card left after its neighbour was entered leaves the neighbour's gaze alone", async ({ page }) => {
    await open(page, SIZES[0], '/how-it-works');
    await card(page, 'veyra').hover({ force: true });
    await card(page, 'nox').hover({ force: true });
    await expect.poll(async () => (await attention(page))?.gazeX ?? 0, { timeout: 3_000 }).toBeGreaterThan(0.1);
    await page.waitForTimeout(600);
    expect((await attention(page))!.reachArm).toBeGreaterThanOrEqual(0);
    expect((await attention(page))!.gazeX).toBeGreaterThan(0.1);
  });

  test('20 hover cycles leave no canvas, preview or window listener behind', async ({ page }) => {
    await watchCanvases(page);
    await open(page, SIZES[0], '/how-it-works');
    const ids = ['veyra', 'flux', 'nox', 'aether'];
    const cycle = async (id: string) => {
      await card(page, id).hover({ force: true });
      await expect.poll(async () => (await canvases(page)).previews, { timeout: 30_000 }).toEqual([id]);
      await page.mouse.move(5, 500);
      await expect.poll(async () => (await canvases(page)).total, { timeout: LEAVE_MS }).toBe(1);
    };
    await cycle('veyra');
    const before = await listeners(page);
    expect(before, 'the dev listener counter exists').toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) await cycle(ids[i % ids.length]);
    expect(await canvases(page)).toEqual(HOST_ONLY);
    expect(await listeners(page), 'window listeners after 20 cycles = before').toBe(before);
    expect(await maxCanvases(page)).toBeLessThanOrEqual(2);
  });

  test('resizing to a phone with a live card unmounts the preview and keeps the cards off the face', async ({ page }) => {
    await watchCanvases(page);
    await open(page, SIZES[0], '/how-it-works');
    await card(page, 'flux').hover({ force: true });
    await expect.poll(() => canvases(page), { timeout: 30_000 }).toEqual({ total: 2, previews: ['flux'] });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => canvases(page), { timeout: LEAVE_MS, message: 'the preview unmounts on the phone' }).toEqual(HOST_ONLY);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(1500);
    const { rects, face, scrollWidth, innerWidth } = await measure(page);
    expect(face).not.toBeNull();
    for (const r of rects) for (const part of [...face!.eyes, face!.mouth]) expect(meets(r, part), `${r.what} meets the face after the resize`).toBe(false);
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
    expect(await maxCanvases(page)).toBeLessThanOrEqual(2);
  });
});

test.describe('How It Works alive: phone 390 x 844 (stills only)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('no preview canvas ever mounts, hovered, focused or tapped', async ({ page }) => {
    await watchCanvases(page);
    await open(page, SIZES[2], '/how-it-works');
    for (const id of ['veyra', 'flux', 'nox']) {
      await card(page, id).hover({ force: true });
      await card(page, id).focus();
      await page.waitForTimeout(500);
    }
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    expect(await canvases(page)).toEqual(HOST_ONLY);
    expect(await maxCanvases(page), 'the host only, ever').toBe(1);
    // And the host does not look at a card below it.
    expect((await attention(page))?.reachArm ?? -1).toBe(-1);
  });
});

test.describe('How It Works alive: reduced motion', () => {
  test.use({ viewport: { width: 1536, height: 1024 }, reducedMotion: 'reduce' });

  test('no ripple plays and no preview mounts', async ({ page }) => {
    await watchCanvases(page);
    await page.addInitScript(() => sessionStorage.setItem('octoverse.octoverse.entranceSeen', '1'));
    await page.goto('/how-it-works');
    await expect(card(page, 'yours')).toBeVisible({ timeout: 90_000 });
    // No animation runs on a card, and every one is fully in at once.
    const state = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-card]')].map(el => ({ running: el.getAnimations().length, opacity: getComputedStyle(el).opacity, animationName: getComputedStyle(el).animationName })),
    );
    for (const s of state) expect(s).toEqual({ running: 0, opacity: '1', animationName: 'none' });
    for (const id of ['veyra', 'flux', 'nox', 'aether']) {
      await card(page, id).hover({ force: true });
      await card(page, id).focus();
      await page.waitForTimeout(400);
    }
    expect(await canvases(page)).toEqual(HOST_ONLY);
    expect(await maxCanvases(page)).toBe(1);
    // A hovered card is still only a still: it lifts no 4% either (the CSS holds it).
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-card="flux"] .oct-card')!).transform)).toBe('none');
  });
});

test.describe('the profile hero is a live preview (spec 7.12)', () => {
  test('desktop: the hero shows a live preview of the world, over its still', async ({ page }) => {
    test.setTimeout(120_000);
    await watchCanvases(page);
    await page.setViewportSize({ width: 1536, height: 1024 });
    await page.goto('/@veyra');
    await expect.poll(() => canvases(page), { timeout: 60_000 }).toEqual({ total: 1, previews: ['hero'] });
    await expect(page.locator('.oct-hero .oct-live-picture')).toHaveAttribute('data-state', 'live', { timeout: 30_000 });
    await expect(page.locator('.oct-hero .oct-still')).toHaveCount(1);
    expect(await maxCanvases(page)).toBe(1);
    // The preview fills the hero's box and takes no input: the page's own controls work around it.
    const hero = await page.locator('.oct-hero').evaluate(el => ({ width: el.clientWidth, height: el.clientHeight }));
    const cv = (await page.locator('.oct-hero canvas').boundingBox())!;
    expect(cv.width, 'the canvas fills the hero inside its border').toBeGreaterThanOrEqual(hero.width - 1);
    expect(cv.height).toBeGreaterThanOrEqual(hero.height - 1);
    await expect(page.locator('.oct-hero .oct-live-layer')).toHaveAttribute('inert', '');
  });

  test('a phone: the hero is a still, always', async ({ page }) => {
    await watchCanvases(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/@veyra');
    await expect(page.locator('.oct-hero .oct-still')).toBeVisible();
    await page.waitForTimeout(2500);
    expect(await canvases(page)).toEqual({ total: 0, previews: [] });
    expect(await maxCanvases(page)).toBe(0);
  });
});

test.describe('Explore tiles come alive like the cards (spec 7.11)', () => {
  test.use({ viewport: { width: 1536, height: 1024 } });
  test.setTimeout(180_000);
  const tile = (page: Page, id: string) => page.locator(`[data-tile="${id}"] .oct-tile`);

  test('one live preview at a time, the last tile entered; Your Octopus stays the glyph; a phone has stills', async ({ page }) => {
    await watchCanvases(page);
    await page.goto('/explore');
    await expect(tile(page, 'veyra')).toBeVisible();
    expect(await canvases(page)).toEqual({ total: 0, previews: [] });
    await tile(page, 'veyra').hover();
    await tile(page, 'flux').hover();
    await tile(page, 'aether').hover();
    await expect.poll(() => canvases(page), { timeout: 30_000 }).toEqual({ total: 1, previews: ['aether'] });
    await page.waitForTimeout(1200);
    expect(await canvases(page)).toEqual({ total: 1, previews: ['aether'] });
    // Keyboard focus too.
    await tile(page, 'nox').focus();
    await expect.poll(() => canvases(page), { timeout: 30_000 }).toEqual({ total: 1, previews: ['nox'] });
    await page.mouse.move(5, 5);
    await tile(page, 'nox').blur();
    await expect.poll(() => canvases(page), { timeout: 5_000 }).toEqual({ total: 0, previews: [] });
    await tile(page, 'yours').hover();
    await page.waitForTimeout(1200);
    expect(await canvases(page)).toEqual({ total: 0, previews: [] });
    expect(await maxCanvases(page), 'one context, the preview, on a page with no host').toBe(1);
    await page.setViewportSize({ width: 390, height: 844 });
    await tile(page, 'veyra').hover({ force: true });
    await page.waitForTimeout(1200);
    expect(await canvases(page)).toEqual({ total: 0, previews: [] });
  });
});
