import { expect, test, type Page } from '@playwright/test';

// The entrance (design 9.6, Task 19): Nox swims in out of the murk for 8.4 s, opens his arms, spins into place and
// settles; the intro's words come in as he settles. Each test runs in a fresh browser context, so a
// first visit.
const skip = (page: Page) => page.getByRole('button', { name: 'Skip intro' });
const title = (page: Page) => page.getByRole('heading', { level: 1, name: 'Security Lab' });
// The stage's first render: the skip control, when there is one, comes with it.
const opened = (page: Page) => page.locator('.spike canvas').waitFor();
// The page's clock stands still from its first script and moves only when a test steps it, so
// the entrance, timed on that clock, cannot run out before a check however slow the machine is.
const T0 = Date.UTC(2026, 9, 26, 9);
// The installed clock runs until the pause, so the pause is a minute on: a busy machine can take
// longer than a moment between the two calls, and a pause already passed throws.
const holdClock = async (page: Page) => {
  await page.clock.install({ time: T0 });
  await page.clock.pauseAt(T0 + 60_000);
};
// Stepping the clock renders each frame in the step there and then, so a step's wall time depends
// on how busy the GPU is. Waits on the page are counted in steps, and the test's own time limit
// grows with the steps it may take, so a busy machine slows the test without failing it. (Not
// expect.poll: it sleeps up to a second of wall time between steps, 8 s of its budget here.)
const STEP_MS = 250;
/** Steps the first visit may take for the words to come in: 10 s of page time; they come at 7.4 s, as Nox settles. */
const ENTRANCE_STEPS = 40;
/** Wall time allowed per step (15 frames at most 0.25 s each), and for the rest of the test. */
const STEP_WALL_MS = 4_000;
const REST_WALL_MS = 30_000;

/** The entrance's state, as the development build reports it (App.tsx). */
type EntranceDebug = { loaded: boolean; t: number; spin: number; settle: number };
const entrance = (page: Page) => page.evaluate(() => (window as unknown as { __noxEntrance?: EntranceDebug }).__noxEntrance ?? null);
/**
 * Steps the page's clock a frame at a time until the entrance's sheet is in (Theatre readies its
 * project on a timer, so the paused clock must move; the files come over the network in wall time).
 * The entrance's clock starts on the first frame drawn with it, and runs on frame time.
 */
async function sheetLoaded(page: Page) {
  const until = Date.now() + 20_000;
  while (!(await entrance(page))?.loaded) {
    expect(Date.now(), "the entrance's sheet within 20 s").toBeLessThan(until);
    await page.clock.runFor(16);
  }
}
/**
 * Steps the page's clock until the world is drawn (`__noxReady`): the boot veil holds the entrance's
 * clock until then, so it plays from its start on screen rather than under the dark.
 */
async function worldReady(page: Page) {
  const until = Date.now() + 60_000;
  while (!(await page.evaluate(() => (window as unknown as { __noxReady?: boolean }).__noxReady))) {
    expect(Date.now(), 'the world drawn within 60 s').toBeLessThan(until);
    await page.clock.runFor(16);
  }
}
/** Steps the page's clock until the entrance's own clock reaches `seconds` (it runs on frame time). */
async function entranceAt(page: Page, seconds: number, steps = 40) {
  for (let i = 0; ((await entrance(page))?.t ?? 0) < seconds; i++) {
    expect(i, `the entrance at ${seconds} s within ${steps} steps`).toBeLessThan(steps);
    await page.clock.runFor(Math.max(16, Math.min(STEP_MS, (seconds - ((await entrance(page))?.t ?? 0)) * 1000)));
  }
}

test('first visit shows the entrance, a reload in the same session goes straight to intro', async ({ page }) => {
  test.setTimeout(REST_WALL_MS + ENTRANCE_STEPS * STEP_WALL_MS);
  await holdClock(page);
  await page.goto('/?world=nox');
  await opened(page);
  await sheetLoaded(page);
  await worldReady(page);
  // Half a second in, Nox is coming out of the murk: the skip control shows and the intro's words do not.
  await entranceAt(page, 0.5);
  await expect(skip(page)).toBeVisible();
  await expect(title(page)).toBeHidden();
  // Nox swims in, spins and settles; the intro's words come in as he settles.
  let steps = 0;
  while (!(await title(page).isVisible())) {
    expect(steps++, `the intro's words within ${ENTRANCE_STEPS} steps of ${STEP_MS} ms`).toBeLessThan(ENTRANCE_STEPS);
    await page.clock.runFor(STEP_MS);
  }
  // They came as he settled (7.4 s), not before.
  expect((await entrance(page))?.settle ?? 0).toBeGreaterThan(0);
  await expect(skip(page)).toBeHidden();
  // The entrance runs its course (8.4 s) into the intro; the session remembers it.
  await entranceAt(page, 8.4);
  await page.clock.runFor(STEP_MS);
  await page.reload();
  await opened(page);
  await expect(skip(page)).toHaveCount(0);
  await expect(title(page)).toBeVisible();
});

test('the boot veil shows the title from the first paint, holds the entrance, and leaves when the world is drawn', async ({ page }) => {
  test.setTimeout(REST_WALL_MS + 60_000);
  await page.addInitScript(() => {
    const seen = window as unknown as { __fadeAt?: number | null };
    seen.__fadeAt = null;
    new MutationObserver(() => {
      const veil = document.getElementById('boot-veil');
      if (veil?.classList.contains('is-fading') && seen.__fadeAt == null) seen.__fadeAt = (window as unknown as { __noxEntrance?: { t: number } }).__noxEntrance?.t ?? 0;
    }).observe(document, { subtree: true, attributes: true, childList: true });
  });
  await page.goto('/?world=nox', { waitUntil: 'commit' });
  const veil = page.locator('#boot-veil');
  await expect(veil.getByText('Security Lab')).toBeVisible();
  await expect(veil.getByText('OCTOVERSE')).toBeVisible();
  // The entrance's water, not white, and not in the way: no press, no focus.
  expect(await veil.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(7, 21, 53)');
  expect(await veil.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  expect(await veil.getAttribute('aria-hidden')).toBe('true');
  // The world drawn: the veil goes, the canvas is up, and the entrance has not run under the veil.
  await page.waitForFunction(() => (window as unknown as { __noxReady?: boolean }).__noxReady, undefined, { timeout: 60_000 });
  await expect(veil).toHaveCount(0, { timeout: 3_000 });
  await expect(page.locator('.spike canvas')).toBeVisible();
  const fadeAt = await page.evaluate(() => (window as unknown as { __fadeAt?: number | null }).__fadeAt);
  expect(fadeAt, 'the entrance clock when the veil began to fade').not.toBeNull();
  expect(fadeAt ?? 99).toBeLessThan(0.6);
});

test('reduced motion skips the entrance', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?world=nox');
  await opened(page);
  await expect(skip(page)).toHaveCount(0);
  await expect(title(page)).toBeVisible();
});

test('skip mid-spin lands in the intro', async ({ page }) => {
  test.setTimeout(REST_WALL_MS + 20 * STEP_WALL_MS);
  await holdClock(page);
  await page.goto('/?world=nox');
  await opened(page);
  await sheetLoaded(page);
  await worldReady(page);
  // 6.9 s in, on the paused clock: Nox is half way round his turn (6.4 to 7.4 s).
  await entranceAt(page, 6.9);
  const now = await entrance(page);
  expect(now?.spin ?? 0).toBeGreaterThan(0.1);
  expect(now?.spin ?? 1).toBeLessThan(0.9);
  await expect(skip(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(title(page)).toBeVisible();
  await expect(skip(page)).toBeHidden();
});

test('Skip intro, a click anywhere or a key ends the entrance at once', async ({ browser }) => {
  for (const how of ['button', 'click', 'key'] as const) {
    const page = await browser.newPage();
    // The page's clock stands still after the swim's first half second, so only the skip can end it.
    await holdClock(page);
    await page.goto('/?world=nox');
    await opened(page);
    await page.clock.runFor(500);
    await expect(skip(page), how).toBeVisible();
    if (how === 'button') await skip(page).click();
    else if (how === 'click') await page.mouse.click(200, 200);
    else await page.keyboard.press('Space');
    await expect(title(page), how).toBeVisible();
    await expect(skip(page), how).toBeHidden();
    await page.close();
  }
});
