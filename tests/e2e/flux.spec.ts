import { type Page, expect, test } from '@playwright/test';

// Flux, the Pipeline Runner (Task 17): his twelve technologies hang as orbs from his arm tips, they
// appear with the head's opening (so none in the intro), and a choice lifts the arm that holds the
// orb. The engine's own buttons, tooltip and tray carry it. Dev build, `?world=flux`.
//
// The engine reports no lift or swing probe (its `window.__octoverse.hold` is only the suction
// hold, which an arm lift never uses). What the page shows is read instead: the buttons that follow
// the orbs (their `translate` is the orb's place on the page), the tray's `aria-pressed`, the tooltip.

const NAMES = ['GitHub Actions', 'TypeScript', 'Node.js', 'Redis', 'Docker', 'Linux', 'AWS', 'MongoDB', 'Express', 'GitHub API', 'Bash', 'Git'];
const PHONE = { width: 390, height: 844 };
// `kitwait` lets the world give up on a slow kit sooner (the page can take 15 s to load under load).
const QUERY = 'world=flux&kitwait=180000';

const BUTTONS = '.orb-button';
const TRAY = '.orb-tray-item';
// The nameplate bobs with the floating character, so a click on it does not wait for it to be stable.
const explore = (page: Page) => page.getByRole('button', { name: /Explore/ });
const ready = (page: Page) => page.waitForFunction(() => (window as unknown as { __octoverse?: { ready: boolean } }).__octoverse?.ready === true, undefined, { timeout: 90_000 });

/** Problems the page reports: errors and uncaught exceptions (a failed resource, such as the favicon, is not one). */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) problems.push(`console.error: ${message.text()}`);
  });
  return problems;
}

/** Each orb button's place on the page (the `translate` the engine moves it by each frame), in the DOM's order. */
const places = (page: Page) =>
  page.locator(BUTTONS).evaluateAll(list =>
    list.map(el => {
      const [x, y] = ((el as HTMLElement).style.translate || '0px 0px').split(' ').map(parseFloat);
      return { x, y };
    }),
  );

/** The largest distance any orb has moved between two readings. */
const farthest = (a: { x: number; y: number }[], b: { x: number; y: number }[]) => Math.max(...a.map((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y)));

/** How far orb `index` is now from `from` (CSS px). */
const away = async (page: Page, index: number, from: { x: number; y: number }) => {
  const p = (await places(page))[index];
  return Math.hypot(p.x - from.x, p.y - from.y);
};

/** The overview: the intro first, then Explore (the head opens and the orbs come with it). */
async function toOverview(page: Page) {
  await page.goto(`/?${QUERY}&stage=intro`);
  await ready(page);
  await explore(page).click({ timeout: 60_000, force: true });
  await expect(page.locator(BUTTONS)).toHaveCount(12, { timeout: 60_000 });
}

test('the intro has no orb buttons; Explore brings twelve, each its own', async ({ page }) => {
  test.setTimeout(150_000);
  const problems = watch(page);
  await page.goto(`/?${QUERY}&stage=intro`);
  await ready(page);
  await expect(explore(page)).toBeVisible({ timeout: 60_000 });
  // Flux does not let a technology be chosen in the intro (`choosableIn: ['overview']`): no buttons are drawn, not even hidden ones.
  await expect(page.locator(BUTTONS)).toHaveCount(0);
  // Settled, nothing has changed: a second look a moment later (the entrance flag, the pulses) still finds none.
  await page.waitForTimeout(1500);
  await expect(page.locator(BUTTONS)).toHaveCount(0);

  await explore(page).click({ force: true });
  await expect(page.locator(BUTTONS)).toHaveCount(12, { timeout: 60_000 });
  const names = await page.locator(BUTTONS).evaluateAll(list => list.map(el => el.getAttribute('aria-label')));
  expect(new Set(names).size, 'twelve different names').toBe(12);
  expect([...names].sort()).toEqual([...NAMES].sort());
  // Every orb is in the tab order (tabindex 0), and the page has no more than these twelve.
  const tabIndexes = await page.locator(BUTTONS).evaluateAll(list => list.map(el => (el as HTMLElement).tabIndex));
  expect(tabIndexes.every(t => t === 0)).toBe(true);
  // The tray is not the way here on a desktop: the twelve fit on the arms, nothing overflows.
  await expect(page.locator(TRAY)).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('tabbing to an orb shows its tooltip, and Escape clears it', async ({ page }) => {
  test.setTimeout(150_000);
  const problems = watch(page);
  await toOverview(page);
  const actions = page.getByRole('button', { name: 'GitHub Actions' });
  const index = (await page.locator(BUTTONS).evaluateAll(list => list.map(el => el.getAttribute('aria-label')))).indexOf('GitHub Actions');
  // Let the orbs come in (a button is live only while its orb is drawn), then note where GitHub Actions hangs.
  await expect.poll(() => page.locator(BUTTONS).evaluateAll(list => list.filter(el => (el as HTMLElement).style.pointerEvents !== 'none').length), { timeout: 30_000 }).toBe(12);
  const hung = (await places(page))[index];
  for (let i = 0; i < 60 && !(await actions.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(actions).toBeFocused();
  // P4's list for GitHub Actions (the storyboard copy, a placeholder in the dev build).
  const tip = page.getByRole('tooltip');
  await expect(tip).toBeVisible({ timeout: 30_000 });
  await expect(tip).toContainText('GitHub Actions');
  await expect(tip).toContainText('Trigger builds via webhooks');
  await expect(actions).toHaveAttribute('aria-describedby', (await tip.getAttribute('id'))!);
  // The choice lifts its arm: the orb that hung at its tip moves far beyond the swing (up to about 45 px measured) of an idle orb.
  await expect.poll(() => away(page, index, hung), { timeout: 15_000 }).toBeGreaterThan(120);
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await expect(actions).toBeFocused();
  expect(problems).toEqual([]);
});

// The pointer's rest is the choice: a pointer that glides over an orb chooses none, one that comes to
// rest on an orb chooses it. The orbs hang from swinging arms, so the anchor moves under the
// pointer the whole time; the choice made at rest must hold steady (no flicker) while it does.
// (The engine's unit tests cover the other half: an orb that drifts under a still pointer is not chosen.)
test('hover intent with a moving anchor: a pass chooses none, a rest chooses one, and the choice does not flicker', async ({ page }) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await toOverview(page);
  const tip = page.getByRole('tooltip');
  await expect(tip).toBeHidden();

  // The anchor moves: the buttons follow the orbs, which hang from the arms and sway with them.
  const first = await places(page);
  let travelled = 0;
  for (let i = 0; i < 12 && travelled < 1; i++) {
    await page.waitForTimeout(250);
    travelled = Math.max(travelled, farthest(first, await places(page)));
  }
  expect(travelled, 'the orbs move on the page (a moving anchor)').toBeGreaterThan(1);

  // 1. Glide across the orb, having come from outside: it must not be chosen.
  const typescript = page.getByRole('button', { name: 'TypeScript' });
  // Where the orb is now (it moves): read again right before each approach.
  const live = async () => {
    const b = (await typescript.boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  await page.mouse.move(40, 40);
  const { x, y } = await live();
  // A quick pass over the orb that does not stop: no tooltip.
  await page.mouse.move(x - 120, y, { steps: 4 });
  await page.mouse.move(x + 120, y, { steps: 8 });
  // ...and out again to bare water (the pass must not end at rest on a neighbouring orb, which would be a choice).
  await page.mouse.move(40, 40, { steps: 8 });
  await page.waitForTimeout(600);
  await expect(tip).toBeHidden();

  // 2. Come to rest on one (the orb is under the pointer when it stops): it is chosen once and stays chosen.
  const at = await live();
  await page.mouse.move(at.x, at.y, { steps: 6 });
  await expect(tip).toBeVisible({ timeout: 10_000 });
  await expect(tip).toContainText('TypeScript');

  // 3. Hold the pointer there while the orb goes on swaying: sample the tooltip for two seconds. Visible every time:
  // the choice does not drop and come back (a flicker) as the anchor moves off and under the pointer.
  const states: string[] = [];
  for (let i = 0; i < 40; i++) {
    states.push((await tip.count()) === 1 && (await tip.isVisible()) ? await tip.innerText().then(t => t.split('\n')[0]) : 'none');
    await page.waitForTimeout(50);
  }
  expect([...new Set(states)], 'the same one tooltip throughout').toEqual(['TypeScript']);
  expect(problems).toEqual([]);
});

test.describe('phone', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  // On a phone the orbs are too small to tap: the tray lists every technology, and choosing from it
  // is the way (the sheet and the tray cover the arm tips there: a known limit of the phone overview).
  test('the tray lists twelve, and choosing one lifts its arm', async ({ page }) => {
    test.setTimeout(180_000);
    const problems = watch(page);
    await page.goto(`/?${QUERY}&stage=overview`);
    await ready(page);
    await expect(page.locator('.orb-tray.is-open')).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => page.locator('.orb-tray').evaluate(el => getComputedStyle(el).opacity), { timeout: 30_000 }).toBe('1');
    const items = page.locator(TRAY);
    await expect(items).toHaveCount(12);
    expect(await items.evaluateAll(list => list.map(el => el.getAttribute('aria-label')))).toEqual(expect.arrayContaining(NAMES));
    // None of the orbs' own buttons is in play on a phone held upright.
    await expect(page.locator('.orb-buttons.is-open')).toHaveCount(0);
    for (const box of await items.evaluateAll(list => list.map(el => el.getBoundingClientRect().toJSON() as { x: number; width: number; height: number }))) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width);
    }

    // Choosing GitHub Actions lifts its arm (T8 in P4) and presses its button; a second tap lets go.
    const actions = page.locator(`${TRAY}[aria-label="GitHub Actions"]`);
    await expect(actions).toHaveAttribute('aria-pressed', 'false');
    await actions.tap();
    await expect(actions).toHaveAttribute('aria-pressed', 'true');
    const tip = page.getByRole('tooltip');
    await expect(tip).toBeVisible({ timeout: 30_000 });
    await expect(tip).toContainText('Trigger builds via webhooks');
    await expect(actions).toHaveAttribute('aria-describedby', (await tip.getAttribute('id'))!);
    // Only the one is pressed; choosing another moves the lift.
    await expect(page.locator(`${TRAY}[aria-pressed="true"]`)).toHaveCount(1);
    // The four-line tooltip of the first sits over the tray's first row (an engine layout limit on the phone: it covers
    // TypeScript to Linux), so the second choice is taken from the second row, which it leaves clear.
    const aws = page.locator(`${TRAY}[aria-label="AWS"]`);
    await aws.tap();
    await expect(aws).toHaveAttribute('aria-pressed', 'true');
    await expect(actions).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator(`${TRAY}[aria-pressed="true"]`)).toHaveCount(1);
    await aws.tap();
    await expect(aws).toHaveAttribute('aria-pressed', 'false');
    expect(problems).toEqual([]);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });

  // With reduced motion the entrance is skipped and the orbs are simply there. This test claims only that: twelve live
  // orb buttons and no Skip control, the orbs' drift bounded, and a choice lifting its arm far beyond that drift.
  // It does NOT show "no swing". The engine holds the pendants' swing at zero in reduced motion (`pendantSwing`,
  // unit-tested), but the engine has no swing probe, the page cannot read the swing apart from the arms, and the arm
  // tip curl (`curl: live * personality.curl` in Octopus.tsx, not gated by reduced motion) drifts the orbs by about
  // 45 px, about what the idle sway does with motion on: the bounds below cannot tell the two apart.
  test('the orbs show, their drift is bounded, and a choice lifts the arm', async ({ page }) => {
    test.setTimeout(150_000);
    const problems = watch(page);
    await page.goto(`/?${QUERY}&stage=overview`);
    await ready(page);
    await expect(page.locator(BUTTONS)).toHaveCount(12, { timeout: 60_000 });
    // Shown: a button is live (not inert) only while its orb is drawn.
    await expect.poll(() => page.locator(BUTTONS).evaluateAll(list => list.filter(el => (el as HTMLElement).style.pointerEvents !== 'none').length), { timeout: 30_000 }).toBe(12);
    await expect(page.getByRole('button', { name: 'Skip intro' })).toHaveCount(0);

    // The orbs' places for about five seconds: finite, and no orb jumps (a bound on the drift, not a proof of stillness).
    const first = await places(page);
    expect(first.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    let last = first;
    let widest = 0;
    let step = 0;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(500);
      const now = await places(page);
      step = Math.max(step, farthest(last, now));
      widest = Math.max(widest, farthest(first, now));
      last = now;
    }
    test.info().annotations.push({ type: 'reduced-motion drift', description: `largest step in 0.5 s ${step.toFixed(1)} px, widest from the start ${widest.toFixed(1)} px` });
    expect(step, 'no orb jumps within half a second (bound only)').toBeLessThan(60);
    expect(widest, 'the drift stays bounded (bound only)').toBeLessThan(120);

    // Choosing one lifts its arm at once, far beyond that drift.
    const names = await page.locator(BUTTONS).evaluateAll(list => list.map(el => el.getAttribute('aria-label')));
    const redis = names.indexOf('Redis');
    const hung = (await places(page))[redis];
    await page.getByRole('button', { name: 'Redis' }).focus();
    await expect(page.getByRole('tooltip')).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => away(page, redis, hung), { timeout: 10_000 }).toBeGreaterThan(widest + 40);
    expect(problems).toEqual([]);
  });
});
