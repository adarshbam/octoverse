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

/** Every arm's tip (arm space), as the page reports it each frame. */
const armTips = (page: Page) => page.evaluate(() => (window as unknown as Win).__octoverse?.attention?.tips.map(t => ({ ...t })) ?? []);
const tipTravel = (from: Tips, to: Tips) => to.map((t, i) => Math.hypot(t.x - from[i].x, t.y - from[i].y));

test('twelve pendant buttons with unique ids after the entrance and the bloom', async ({ page }) => {
  test.setTimeout(120_000);
  await openVeyra(page);
  // For the record: the buttons are live from ready on (the bloom is drawn in the scene; the buttons do not wait for it).
  const outAtReady = await page.locator(BUTTONS).evaluateAll(els => els.filter(el => (el as HTMLElement).style.pointerEvents !== 'none').length);
  test.info().annotations.push({ type: 'live buttons at ready (motion on)', description: String(outAtReady) });
  await bloomed(page);
  const ids = await page.locator(BUTTONS).evaluateAll(els => els.map(el => el.getAttribute('aria-label')));
  expect(ids).toHaveLength(12);
  expect(ids.every(id => !!id)).toBe(true);
  expect(new Set(ids).size).toBe(12);
  // Each button sits where its pendant hangs: inside the page, not at the corner a button starts in (its 44 px box at the
  // origin has its centre at 22, 22), and clear of every other button's centre (twelve different places).
  const box = page.viewportSize()!;
  const at = await centres(page);
  for (const c of at) {
    expect(c.x, c.name).toBeGreaterThan(0);
    expect(c.x, c.name).toBeLessThan(box.width);
    expect(c.y, c.name).toBeGreaterThan(0);
    expect(c.y, c.name).toBeLessThan(box.height);
    expect(Math.hypot(c.x - 22, c.y - 22), `${c.name} has left the corner it starts in`).toBeGreaterThan(5);
  }
  for (let i = 0; i < at.length; i++) {
    for (let j = i + 1; j < at.length; j++) expect(Math.hypot(at[i].x - at[j].x, at[i].y - at[j].y), `${at[i].name} and ${at[j].name} are not in one place`).toBeGreaterThan(5);
  }
});

test('Tab reaches a pendant, its tooltip names the technology, Escape clears it and focus stays', async ({ page }) => {
  test.setTimeout(120_000);
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

// Review Focus 2: the pendants hang from arms that move, so a button is a moving anchor. A pointer that rests on one
// must give that pendant's tooltip and no flicker, and a pointer gliding across several chooses none.
test('hover intent with a moving anchor: gliding across pendants chooses none, resting on one chooses it and keeps its tooltip steady', async ({ page }) => {
  test.setTimeout(120_000);
  type Sample = { t: number; name: string | null };
  await page.addInitScript(() => {
    // Samples the tooltip's name every 50 ms from the page's own clock, so a flicker is seen however busy the test runner is;
    // and notes when the pointer last moved, on the same clock.
    const log: Sample[] = [];
    Object.assign(window, { __tipLog: log, __lastMove: 0 });
    addEventListener('pointermove', () => Object.assign(window, { __lastMove: performance.now() }), true);
    setInterval(() => {
      const tip = document.querySelector('[role="tooltip"] .tech-tooltip-head h3');
      log.push({ t: performance.now(), name: tip?.textContent?.trim() ?? null });
    }, 50);
  });
  await openVeyra(page);
  await bloomed(page);
  const log = () => page.evaluate(() => (window as unknown as { __tipLog: Sample[] }).__tipLog);
  const lastMove = () => page.evaluate(() => (window as unknown as { __lastMove: number }).__lastMove);
  const start = await centres(page);
  // Three pendants, left to right on the page: the glide's way points.
  const way = [...start].sort((a, b) => a.x - b.x);
  const [first, mid, last] = [way[0], way[Math.floor(way.length / 2)], way[way.length - 1]];
  const tipsBefore = await armTips(page);

  // Gliding: the pointer crosses the pendants at a steady pace (a button is entered and left on the way). The pendants move (that is
  // the test), so each leg aims at where its pendant is as the leg starts, not where it was when the page was measured.
  const where = async (name: string) => (await centres(page)).find(c => c.name === name)!;
  await page.mouse.move(first.x, first.y);
  const toMid = await where(mid.name);
  await page.mouse.move(toMid.x, toMid.y, { steps: 12 });
  const toLast = await where(last.name);
  await page.mouse.move(toLast.x, toLast.y, { steps: 12 });
  // The glide's window ends 100 ms after the pointer's last move on the page's own clock: less than the intent's dwell (130 ms), so
  // however slowly this round trip comes back, the tooltip a rest brings cannot fall into it.
  const stopped = await lastMove();
  const glide = (await log()).filter(s => s.t <= stopped + 100);
  expect(glide.length, 'the glide was sampled').toBeGreaterThan(3);
  expect(glide.filter(s => s.name !== null).map(s => s.name), 'a glide across pendants chooses none').toEqual([]);

  // Resting: the pointer stays on the last pendant while it moves; the anchor is followed by the button, not the pointer.
  // Sampled for 1.6 s after the glide's window (the intent's dwell of 130 ms, then the tooltip's own fade-in delay, come first).
  let travel = 0;
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(100);
    const now = (await centres(page)).find(c => c.name === last.name)!;
    travel = Math.max(travel, Math.hypot(now.x - toLast.x, now.y - toLast.y));
  }
  test.info().annotations.push({ type: 'anchor travel (px)', description: travel.toFixed(1) });
  const names = (await log()).filter(s => s.t > stopped + 100).map(s => s.name);
  // Compress runs; the tooltip may appear once (nothing, then the name) and then stays: never A to B to A, never A to nothing to A.
  const runs = names.filter((n, i) => i === 0 || n !== names[i - 1]);
  const named = runs.filter((n): n is string => n !== null);
  expect(new Set(named).size, `tooltip names while resting: ${JSON.stringify(runs)}`).toBeLessThanOrEqual(1);
  expect(runs.length, `tooltip changes while resting: ${JSON.stringify(runs)}`).toBeLessThanOrEqual(2);
  expect(runs[runs.length - 1], 'the pendant it rests on is chosen').not.toBeNull();
  expect(runs[runs.length - 1]).toBe(last.name);
  // The choice is the one a click or a Tab makes: the button of the pendant the pointer rests on is the one the tooltip describes
  // (the buttons call the same choosing, `FOCUS_TECH`, which lifts the pendant's arm: the Tab and tray checks show that lift). Under
  // a hover the arm turns toward the pointer, which is already on the pendant, so the tips move little: noted, not asserted.
  await expect(page.getByRole('button', { name: last.name })).toHaveAttribute('aria-describedby', /.+/);
  const described = await page.locator(`${BUTTONS}[aria-describedby]`).evaluateAll(els => els.map(el => el.getAttribute('aria-label')));
  expect(described, 'only the pendant it rests on is described').toEqual([last.name]);
  const moved = tipTravel(tipsBefore, await armTips(page));
  test.info().annotations.push({ type: 'tip travel after the rest (arm units)', description: moved.map(m => m.toFixed(2)).join(' ') });
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

    // The arm's tip rests where the arm hangs; choosing a pendant lifts its arm, so its tip moves up the stage a good way.
    await bloomed(page);
    const before = await armTips(page);
    expect(before.length).toBe(8);
    // Control: with nothing chosen the tips only sway a little over the same time.
    await page.waitForTimeout(900);
    const rest = await armTips(page);
    const idle = tipTravel(before, rest);
    test.info().annotations.push({ type: 'idle tip drift (arm units)', description: Math.max(...idle).toFixed(3) });
    const choice = page.locator(`${TRAY}[aria-label="React"]`);
    await choice.tap();
    await expect(choice).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`${TRAY}[aria-pressed="true"]`)).toHaveCount(1);
    await expect(page.getByRole('tooltip')).toContainText('React');
    // The lift takes about 450 ms; wait for the arm to be up, then compare.
    await page.waitForTimeout(900);
    const moved = tipTravel(rest, await armTips(page));
    test.info().annotations.push({ type: 'lift tip travel (arm units)', description: Math.max(...moved).toFixed(3) });
    // It is React's arm that rises (T1 hangs React's pendant: the first top-down slot): it moves the most, well past the rest.
    const order = moved.map((m, i) => [m, i]).sort((a, b) => b[0] - a[0]);
    expect(order[0][1], `React hangs from T1, the first arm; tip movement per arm: ${moved.map(m => m.toFixed(2))}`).toBe(0);
    expect(order[0][0]).toBeGreaterThan(0.3);
    expect(order[0][0], 'well past the next arm').toBeGreaterThan(2 * order[1][0]);

    // Choosing it again lets go.
    await choice.tap();
    await expect(choice).toHaveAttribute('aria-pressed', 'false');
  });
});

// Reduced motion (spec 7.8: "no float, drift or swim; pendants shown still"). The buttons follow the pendants each frame, so
// their positions are the pendants' positions on the page: a swing, a sway, a drift or a slow lift all show in them.
// What stays in the unit tests: the swing angle itself (`pendantSwing`, `bloomState` with reducedMotion are 0), and that the
// arm's curl, trail, depth wave and idle look-around are scaled by it (src/engine/character/reducedMotion.test.ts).
type Frame = { t: number; p: [number, number][] };

/**
 * Records every button's centre on every animation frame for `ms` (the page's own clock, from 0 at the first frame). With `lift`,
 * the first button (React) is focused `lift.at` ms in: focusing a pendant chooses it, as a Tab does.
 */
function record(page: Page, ms: number, lift?: { at: number }): Promise<Frame[]> {
  return page.evaluate(
    async ({ ms, lift }) => {
      const els = [...document.querySelectorAll<HTMLElement>('.orb-button')];
      const frames: { t: number; p: [number, number][] }[] = [];
      const t0 = performance.now();
      let focused = false;
      await new Promise<void>(done => {
        const tick = () => {
          const t = performance.now() - t0;
          if (lift && !focused && t >= lift.at) {
            focused = true;
            els[0].focus();
          }
          frames.push({ t, p: els.map(el => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }) });
          if (t < ms) requestAnimationFrame(tick);
          else done();
        };
        tick();
      });
      return frames;
    },
    { ms, lift },
  );
}

/** The most any button strays from where it was at `from`, over the frames from `from` to `to` (px). */
function strayed(frames: Frame[], from: number, to: number) {
  const inside = frames.filter(f => f.t >= from && f.t <= to);
  expect(inside.length, 'frames were drawn in the window').toBeGreaterThan(5);
  let worst = 0;
  for (const f of inside) f.p.forEach((p, i) => (worst = Math.max(worst, Math.hypot(p[0] - inside[0].p[i][0], p[1] - inside[0].p[i][1]))));
  return worst;
}

/** How React's button moves after the lift at `at`: the frames it spends between a tenth and nine tenths of the way, and its distance from where it hung. */
function liftShape(frames: Frame[], at: number) {
  const before = [...frames].reverse().find(f => f.t < at)!;
  const dist = (f: Frame) => Math.hypot(f.p[0][0] - before.p[0][0], f.p[0][1] - before.p[0][1]);
  const final = dist([...frames].reverse().find(f => f.t <= at + 800)!);
  const between = frames.filter(f => f.t >= at && f.t <= at + 800 && dist(f) > 0.1 * final && dist(f) < 0.9 * final).length;
  return { final, between };
}

test.describe('reduced motion', () => {
  const IDLE_MS = 4000;
  const LIFT_AT = 500;
  const SETTLE_AFTER_LIFT = 1500;
  const OBSERVE_MS = 3500;

  test('pendants hold still: no button strays a pixel in 4 s', async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openVeyra(page);
    await expect(page.locator(BUTTONS)).toHaveCount(12);
    // Past the first frames (the page's last settling), then watch.
    await page.waitForTimeout(1500);
    const frames = await record(page, IDLE_MS);
    const worst = strayed(frames, 0, IDLE_MS);
    test.info().annotations.push({ type: 'reduced: furthest any button strays in 4 s (px)', description: worst.toFixed(2) });
    expect(worst).toBeLessThan(1);
  });

  test('control: with motion on the same pendants move, so stillness is not an accident of the measure', async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openVeyra(page);
    await bloomed(page);
    await page.waitForTimeout(1500);
    const frames = await record(page, IDLE_MS);
    const worst = strayed(frames, 0, IDLE_MS);
    test.info().annotations.push({ type: 'motion on: furthest any button strays in 4 s (px)', description: worst.toFixed(2) });
    expect(worst).toBeGreaterThan(10);
  });

  test('reduced: a lift is instant and everything holds still after it', async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openVeyra(page);
    await expect(page.locator(BUTTONS)).toHaveCount(12);
    await page.waitForTimeout(1500);
    const frames = await record(page, OBSERVE_MS, { at: LIFT_AT });
    const shape = liftShape(frames, LIFT_AT);
    const after = strayed(frames, LIFT_AT + SETTLE_AFTER_LIFT, OBSERVE_MS);
    test.info().annotations.push({ type: 'reduced: lift distance (px), frames between 10% and 90%, stray after (px)', description: `${shape.final.toFixed(0)}, ${shape.between}, ${after.toFixed(2)}` });
    expect(shape.final, 'the lift moves the pendant a good way').toBeGreaterThan(50);
    expect(shape.between, 'it gets there in no frames between').toBeLessThanOrEqual(1);
    expect(after, 'no pendant swings on after it (px)').toBeLessThan(1);
  });

  test('control: with motion on a lift eases over several frames and the pendants keep moving after it', async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openVeyra(page);
    await bloomed(page);
    await page.waitForTimeout(1500);
    const frames = await record(page, OBSERVE_MS, { at: LIFT_AT });
    const shape = liftShape(frames, LIFT_AT);
    const after = strayed(frames, LIFT_AT + SETTLE_AFTER_LIFT, OBSERVE_MS);
    test.info().annotations.push({ type: 'motion on: lift distance (px), frames between 10% and 90%, stray after (px)', description: `${shape.final.toFixed(0)}, ${shape.between}, ${after.toFixed(2)}` });
    expect(shape.final, 'the lift moves the pendant a good way').toBeGreaterThan(50);
    expect(shape.between, 'it eases over several frames').toBeGreaterThanOrEqual(3);
    expect(after).toBeGreaterThan(5);
  });
});
