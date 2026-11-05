import { expect, test, type Page } from '@playwright/test';

// Veyra's pendants (Task 20): twelve technologies hang as glass orbs from her arms, bloom out of
// her cups after the entrance, and are chosen by the engine's arm lift. These checks drive the
// real page: the HTML buttons that follow the orbs, the tooltip, the phone's tray and reduced motion.
// The entrance is skipped by the session flag the world sets itself (`octoverse.veyra.entranceSeen`).

const ENTRANCE_SEEN = ['octoverse.veyra.entranceSeen', '1'] as const;
const BUTTONS = '.orb-button';
const TRAY = '.orb-tray-item';
/** The bloom runs 1.2 s (artifacts.ts); the rest is the pendants being drawn and the first frames. */
const BLOOM_MS = 1200;

type Tips = { x: number; y: number }[];
type Win = { __octoverse?: { ready?: boolean; attention?: { tips: Tips } } };

async function openVeyra(page: Page, query = '') {
  await page.addInitScript(([key, value]) => sessionStorage.setItem(key, value), ENTRANCE_SEEN);
  await page.goto(`/?world=veyra${query}`);
  await page.waitForFunction(() => (window as unknown as Win).__octoverse?.ready === true, undefined, { timeout: 90_000 });
}

/** Every button is out of its cup: none is inert (the buttons are `pointer-events: none` while their pendant is faded out). */
async function bloomed(page: Page, count = 12) {
  await expect(page.locator(BUTTONS)).toHaveCount(count);
  await expect
    .poll(() => page.locator(BUTTONS).evaluateAll(els => els.every(el => (el as HTMLElement).style.pointerEvents !== 'none')), { timeout: 60_000 })
    .toBe(true);
  // The bloom is the sheet's 1.2 s; give the last pendant the time it needs to reach full size.
  await page.waitForTimeout(BLOOM_MS);
}

const centres = (page: Page) =>
  page.locator(BUTTONS).evaluateAll(els =>
    els.map(el => {
      const r = el.getBoundingClientRect();
      return { name: el.getAttribute('aria-label') ?? '', x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }),
  );

test('twelve pendant buttons with unique ids after the entrance and the bloom', async ({ page }) => {
  await openVeyra(page);
  // For the record: the buttons are live from ready on (the bloom is drawn in the scene; the buttons do not wait for it).
  const outAtReady = await page.locator(BUTTONS).evaluateAll(els => els.filter(el => (el as HTMLElement).style.pointerEvents !== 'none').length);
  test.info().annotations.push({ type: 'live buttons at ready (motion on)', description: String(outAtReady) });
  await bloomed(page);
  const ids = await page.locator(BUTTONS).evaluateAll(els => els.map(el => el.getAttribute('aria-label')));
  expect(ids).toHaveLength(12);
  expect(ids.every(id => !!id)).toBe(true);
  expect(new Set(ids).size).toBe(12);
  // Each button sits on the page (a pendant that never bloomed would leave it at the origin).
  const box = page.viewportSize()!;
  for (const c of await centres(page)) {
    expect(c.x, c.name).toBeGreaterThan(0);
    expect(c.x, c.name).toBeLessThan(box.width);
    expect(c.y, c.name).toBeGreaterThan(0);
    expect(c.y, c.name).toBeLessThan(box.height);
  }
});

test('Tab reaches a pendant, its tooltip names the technology, Escape clears it and focus stays', async ({ page }) => {
  await openVeyra(page);
  await bloomed(page);
  for (let i = 0; i < 40 && !(await page.evaluate(() => document.activeElement?.classList.contains('orb-button') ?? false)); i++) await page.keyboard.press('Tab');
  const name = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? null);
  expect(name).toBeTruthy();
  const tip = page.getByRole('tooltip');
  await expect(tip).toBeVisible();
  await expect(tip.locator('.tech-tooltip-head')).toContainText(name!);
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await expect(page.getByRole('button', { name: name! })).toBeFocused();
});

// Review Focus 2: the pendants swing, so a button is a moving anchor. A pointer that rests on one
// must give that pendant's tooltip and no flicker, and a pointer gliding across several chooses none.
test('hover intent with a moving anchor: gliding across pendants chooses none, resting on one keeps its tooltip steady', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    // Samples the tooltip's name every 50 ms from the page's own clock, so a flicker is seen however busy the test runner is.
    const log: { t: number; name: string | null }[] = [];
    Object.assign(window, { __tipLog: log });
    setInterval(() => {
      const tip = document.querySelector('[role="tooltip"] .tech-tooltip-head h3');
      log.push({ t: performance.now(), name: tip?.textContent?.trim() ?? null });
    }, 50);
  });
  await openVeyra(page);
  await bloomed(page);
  const log = () => page.evaluate(() => (window as unknown as { __tipLog: { t: number; name: string | null }[] }).__tipLog);
  const start = await centres(page);
  // Three pendants, left to right on the page: the glide's way points.
  const way = [...start].sort((a, b) => a.x - b.x);
  const [first, mid, last] = [way[0], way[Math.floor(way.length / 2)], way[way.length - 1]];

  // Gliding: the pointer crosses the pendants at a steady pace (a button is entered and left on the way).
  await page.mouse.move(first.x, first.y);
  const mark = (await log()).length;
  await page.mouse.move(mid.x, mid.y, { steps: 12 });
  await page.mouse.move(last.x, last.y, { steps: 12 });
  const glideSamples = (await log()).slice(mark);
  expect(glideSamples.filter(s => s.name !== null).map(s => s.name), 'a glide across pendants chooses none').toEqual([]);

  // Resting: the pointer stays on the last pendant while it swings; the anchor is followed by the button, not the pointer.
  // Sample for about 1.5 s after the intent delay (130 ms dwell, then the tooltip's own fade-in delay).
  const settleFrom = (await log()).length;
  // How far the pendant's button travels while the pointer rests: the moving anchor.
  let travel = 0;
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(100);
    const now = (await centres(page)).find(c => c.name === last.name)!;
    travel = Math.max(travel, Math.hypot(now.x - last.x, now.y - last.y));
  }
  test.info().annotations.push({ type: 'anchor travel (px)', description: travel.toFixed(1) });
  const resting = (await log()).slice(settleFrom);
  const names = resting.map(s => s.name);
  // Compress runs; the tooltip may appear once (null to A) and then stays: never A to B to A, never A to nothing to A.
  const runs = names.filter((n, i) => i === 0 || n !== names[i - 1]);
  const named = runs.filter((n): n is string => n !== null);
  expect(new Set(named).size, `tooltip names while resting: ${JSON.stringify(runs)}`).toBeLessThanOrEqual(1);
  expect(runs.length, `tooltip changes while resting: ${JSON.stringify(runs)}`).toBeLessThanOrEqual(2);
  expect(runs[runs.length - 1], 'the pendant it rests on is chosen').not.toBeNull();
  // The pointer is over the pendant it rests on (or the button followed it away and the tooltip stays on the last choice).
  expect(runs[runs.length - 1]).toBe(last.name);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test.setTimeout(120_000);

  test('the tray lists the twelve and choosing one raises its arm', async ({ page }) => {
    await openVeyra(page, '&stage=overview');
    await expect(page.locator('.orb-tray.is-open')).toBeVisible();
    await expect.poll(() => page.locator('.orb-tray').evaluate(el => getComputedStyle(el).opacity), { timeout: 30_000 }).toBe('1');
    const items = page.locator(TRAY);
    await expect(items).toHaveCount(12);
    const names = await items.evaluateAll(els => els.map(el => el.getAttribute('aria-label')));
    expect(new Set(names).size).toBe(12);
    // Nothing is chosen yet.
    await expect(page.locator(`${TRAY}[aria-pressed="true"]`)).toHaveCount(0);

    // The arm's tip rests where the arm hangs; choosing a pendant lifts its arm, so some tip moves up the stage a good way.
    await bloomed(page);
    const tips = () => page.evaluate(() => (window as unknown as Win).__octoverse?.attention?.tips.map(t => ({ ...t })) ?? []);
    const before = await tips();
    expect(before.length).toBe(8);
    // Control: with nothing chosen the tips only sway a little over the same time.
    await page.waitForTimeout(900);
    const idle = (await tips()).map((t, i) => Math.hypot(t.x - before[i].x, t.y - before[i].y));
    test.info().annotations.push({ type: 'idle tip drift (arm units)', description: Math.max(...idle).toFixed(3) });
    const rest = await tips();
    const choice = page.locator(`${TRAY}[aria-label="React"]`);
    await choice.tap();
    await expect(choice).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`${TRAY}[aria-pressed="true"]`)).toHaveCount(1);
    await expect(page.getByRole('tooltip')).toContainText('React');
    // The lift takes about 450 ms; wait for the arm to be up, then compare.
    await page.waitForTimeout(900);
    const after = await tips();
    const moved = after.map((t, i) => Math.hypot(t.x - rest[i].x, t.y - rest[i].y));
    test.info().annotations.push({ type: 'lift tip travel (arm units)', description: Math.max(...moved).toFixed(3) });
    expect(Math.max(...moved), `tip movement per arm: ${moved.map(m => m.toFixed(2))}`).toBeGreaterThan(Math.max(...idle) * 3 + 0.1);
    // It is React's arm that rises (T1 hangs React's pendant: the first top-down slot), by the most.
    expect(moved.indexOf(Math.max(...moved)), 'React hangs from T1, the first arm').toBe(0);

    // Choosing it again lets go.
    await choice.tap();
    await expect(choice).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('reduced motion', () => {
  // What "no wobble" can be measured as. The arms still curl very slowly under reduced motion (the
  // engine's tip curl is not scaled by it: see the Task 20 report), so a button's position is not
  // constant. A pendant's swing and the bloom's wobble are quicker than that: they show as a
  // jitter on top of the slow path. So each button's path is high-passed (its position less the
  // mean of the positions six frames either side, about 125 ms), less what all twelve do together
  // that frame (a slow frame jumps them all; it is not a pendant's swing), and what is left must
  // stay under 0.5 px on all but a few frames (under 5%: a slow frame under load still shows now and
  // then; the buttons round to 0.1 px). The full Nox run under load once saw one spike of 2.8 px on
  // React alone, hence the share and not the worst. It is a smoothness bound, not a contrast: with
  // motion on, an idle pendant barely swings either; the swing itself is pinned at 0 by the unit
  // tests of `pendantSwing` and `bloomState`.
  test('the pendants show at once with no wobble: every button holds a smooth path', async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openVeyra(page);
    // Sampled from the first frame after ready on. The buttons are live as soon as the pendants are drawn (with motion on too:
    // the bloom itself is in the GL scene, so the first-frame check here only proves the buttons are there and keep their size).
    const run = await page.evaluate(async () => {
      const els = [...document.querySelectorAll<HTMLElement>('.orb-button')];
      const series: { x: number; y: number; w: number; live: boolean }[][] = els.map(() => []);
      const t0 = performance.now();
      await new Promise<void>(done => {
        const tick = () => {
          els.forEach((el, i) => {
            const r = el.getBoundingClientRect();
            series[i].push({ x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, live: el.style.pointerEvents !== 'none' });
          });
          if (performance.now() - t0 < 4000) requestAnimationFrame(tick);
          else done();
        };
        tick();
      });
      return els.map((el, i) => ({ name: el.getAttribute('aria-label') ?? '', series: series[i] }));
    });
    expect(run).toHaveLength(12);
    const WINDOW = 6;
    const frames = Math.min(...run.map(r => r.series.length));
    expect(frames).toBeGreaterThan(2 * WINDOW + 10);
    for (const { name, series } of run) {
      expect(series[0].live, `${name} is out at the first frame`).toBe(true);
      expect(Math.abs(series[0].w - series[frames - 1].w), `${name} keeps its size`).toBeLessThan(0.5);
    }
    // Each button's high-passed path, less what all twelve do together at that frame (the median): a
    // slow frame jumps every button at once and is not a pendant's own swing.
    const residual = (r: (typeof run)[number], i: number, d: 'x' | 'y') => r.series[i][d] - (r.series[i - WINDOW][d] + r.series[i + WINDOW][d]) / 2;
    const median = (xs: number[]) => [...xs].sort((p, q) => p - q)[Math.floor(xs.length / 2)];
    // A wobble is a sustained ripple, not one slow frame: count the frames where a button's own jitter passes half a pixel.
    const over = new Map<string, number>();
    const worst = new Map<string, number>();
    for (let i = WINDOW; i < frames - WINDOW; i++) {
      for (const d of ['x', 'y'] as const) {
        const together = median(run.map(r => residual(r, i, d)));
        for (const r of run) {
          const own = Math.abs(residual(r, i, d) - together);
          worst.set(r.name, Math.max(worst.get(r.name) ?? 0, own));
          if (own > 0.5) over.set(r.name, (over.get(r.name) ?? 0) + 1);
        }
      }
    }
    const judged = 2 * (frames - 2 * WINDOW);
    for (const [name, px] of worst) test.info().annotations.push({ type: `${name} own jitter (px): worst, frames over 0.5`, description: `${px.toFixed(2)}, ${over.get(name) ?? 0} of ${judged}` });
    for (const name of worst.keys()) expect((over.get(name) ?? 0) / judged, `${name}: share of frames with its own jitter over 0.5 px`).toBeLessThan(0.05);
  });
});
