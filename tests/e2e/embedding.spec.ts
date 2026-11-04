import { type Page, expect, test } from '@playwright/test';

// The host as a platform page embeds it (amendment A2, Task 8b), on the development page
// src/app/multi.html?embed=1 (src/app/embedding.tsx): a page instance in cell `a`, and, when asked,
// one preview in cell `b`. The page's own buttons and cards drive the instance through
// `useInstanceApi()`; the stages it is told of are logged in `window.__embed.stages`.

const embed = (query: Record<string, string> = {}) => `/src/app/multi.html?${new URLSearchParams({ embed: '1', ...query })}`;
const cell = (page: Page, slot: 'a' | 'b') => page.locator(`[data-slot="${slot}"]`);
/** The stages the page was told of, once they are these (a busy page answers slowly). */
const toldStages = (page: Page, expected: string[]) => expect.poll(() => stages(page), { timeout: 20_000 }).toEqual(expected);
const stages = (page: Page) => page.evaluate(() => (window as unknown as { __embed?: { stages: string[] } }).__embed?.stages ?? []);

type Attention = { gazeX: number; reachArm: number; tips: { x: number; y: number }[]; target: { x: number; y: number } };
const attention = (page: Page) => page.evaluate(() => (window as unknown as { __octoverse?: { attention?: Attention } }).__octoverse?.attention ?? null);
/** The arm whose tip is nearest the point reached for. */
const nearest = (seen: Attention) => seen.tips.map((tip, i) => [Math.hypot(tip.x - seen.target.x, tip.y - seen.target.y), i] as const).sort((x, y) => x[0] - y[0])[0][1];

/** What `ui: 'none'` leaves out (spec 19, P1): the title, nameplate, overview panel and the skip controls. */
const LEFT_OUT = '.title, .nameplate, .overview-panel, .skip-entrance, .skip-link';

test("a page instance with ui none draws no title, nameplate, overview panel or skip, keeps the orb buttons and the detail panel, and its children drive it through the API", async ({ page }) => {
  await page.goto(embed({ ui: 'none', opts: 'freeze' }));
  const a = cell(page, 'a');
  await a.locator('canvas').waitFor();
  await expect(a.getByTestId('stage')).toHaveText('intro');
  await expect(a.locator(LEFT_OUT)).toHaveCount(0);
  await expect(a.locator('.exit-link')).toHaveCount(0);
  // The artifacts are governed by `artifacts`, not by `ui`: the buttons are there, and so is the detail panel.
  await expect(a.locator('.orb-button')).toHaveCount(15);
  await expect(a.locator('.project-detail')).toHaveCount(1);
  await a.getByTestId('explore').click();
  await expect(a.getByTestId('stage')).toHaveText('overview');
  await expect(a.locator(LEFT_OUT)).toHaveCount(0);
  await a.getByTestId('back').click();
  await expect(a.getByTestId('stage')).toHaveText('intro');

  // The same page with the engine's UI has all of it: the check above is not a vacuous pass.
  await page.goto(embed({ ui: 'engine', opts: 'freeze' }));
  await cell(page, 'a').locator('canvas').waitFor();
  for (const selector of ['.title', '.nameplate', '.overview-panel', '.project-detail', '.skip-link', '.skip-entrance', '.orb-buttons']) await expect(cell(page, 'a').locator(selector), selector).toHaveCount(1);
});

test('a preview with its artifacts hidden has no orb buttons; settled has them', async ({ page }) => {
  await page.goto(embed({ ui: 'none', prev: 'hidden', pstage: 'intro', opts: 'freeze' }));
  const b = cell(page, 'b');
  await b.locator('canvas').waitFor();
  // The preview's engine UI is on (the default), so the buttons would be here unless the artifacts are hidden.
  await expect(b.locator('.title')).toHaveCount(1);
  await expect(b.locator('.orb-button')).toHaveCount(0);
  await expect(b.locator('.orb-tray-item')).toHaveCount(0);
  // It opened on its stage: no entrance to skip.
  await expect(b.locator('.skip-entrance:not(.is-hidden)')).toHaveCount(0);

  await page.goto(embed({ ui: 'none', prev: 'settled', pstage: 'intro', opts: 'freeze' }));
  await expect(cell(page, 'b').locator('.orb-button')).toHaveCount(15);
});

test('with exit set, the exit link is the first focusable element in the instance, with or without the engine UI', async ({ page }) => {
  for (const ui of ['none', 'engine'] as const) {
    await page.goto(embed({ ui, exit: '1', opts: 'freeze' }));
    const a = cell(page, 'a');
    await a.locator('canvas').waitFor();
    const link = a.getByRole('link', { name: 'Back to the hub' });
    await expect(link).toHaveAttribute('href', '#hub');
    const first = await a.evaluate(el => {
      const focusable = [...el.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')].filter(node => node.tabIndex >= 0 && !node.closest('[inert]'));
      return focusable[0]?.textContent;
    });
    expect(first, ui).toBe('Back to the hub');
    // And the browser agrees: focusing the link and pressing Tab leaves it for the next one, not the reverse.
    await link.focus();
    await expect(link).toBeFocused();
  }
});

test('attend turns the gaze toward a focused card and reaches the nearest arm; attend(null) lets both go', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(embed({ ui: 'none', init: 'overview', opts: 'freeze' }));
  const a = cell(page, 'a');
  await a.locator('canvas').waitFor();
  await page.waitForFunction(() => (window as unknown as { __octoverse?: { ready: boolean } }).__octoverse?.ready === true, undefined, { timeout: 60_000 });
  // Nothing attended: no arm reaches in the overview.
  await expect.poll(async () => (await attention(page))?.reachArm, { timeout: 5_000 }).toBe(-1);

  await a.locator('[data-card="left"]').focus();
  await expect.poll(async () => (await attention(page))?.gazeX ?? 0, { timeout: 1_000 }).toBeLessThan(-0.1);
  await expect.poll(async () => (await attention(page))?.reachArm ?? -1, { timeout: 1_000 }).toBeGreaterThanOrEqual(0);
  const left = (await attention(page))!;
  expect(left.reachArm).toBe(nearest(left));
  expect(left.target.x).toBeLessThan(0);

  await a.locator('[data-card="right"]').focus();
  await expect.poll(async () => (await attention(page))?.gazeX ?? 0, { timeout: 1_000 }).toBeGreaterThan(0.1);
  await expect.poll(async () => (await attention(page))?.target.x ?? 0, { timeout: 1_000 }).toBeGreaterThan(0);
  const right = (await attention(page))!;
  expect(right.reachArm).toBeGreaterThanOrEqual(0);
  expect(right.reachArm).toBe(nearest(right));
  expect(right.reachArm).not.toBe(left.reachArm);

  await a.locator('[data-card="right"]').blur();
  await expect.poll(async () => (await attention(page))?.reachArm, { timeout: 1_000 }).toBe(-1);
  // The eyes let go too: with nothing to follow they come back to the middle (the frozen page rests them ahead).
  await expect.poll(async () => Math.abs((await attention(page))?.gazeX ?? 1), { timeout: 3_000 }).toBeLessThan(0.1);
});

test('a forced reach yields to a focused technology: no arm reaches for the card while a bubble is chosen', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(embed({ ui: 'none', init: 'overview', opts: 'freeze' }));
  const a = cell(page, 'a');
  await a.locator('canvas').waitFor();
  await page.waitForFunction(() => (window as unknown as { __octoverse?: { ready: boolean } }).__octoverse?.ready === true, undefined, { timeout: 60_000 });
  // Hovering (not focusing) the card keeps the attention on it while a bubble is chosen with the keyboard.
  const box = (await a.locator('[data-card="left"]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(async () => (await attention(page))?.reachArm ?? -1, { timeout: 2_000 }).toBeGreaterThanOrEqual(0);
  await a.locator('.orb-button').first().focus();
  await expect(a.getByTestId('stage')).toHaveText('techFocus');
  await expect.poll(async () => (await attention(page))?.reachArm, { timeout: 2_000 }).toBe(-1);
});

test('onStageChange fires on each change; a stageRequest to intro closes an open detail; a request for the current stage does nothing', async ({ page }) => {
  await page.goto(embed({ ui: 'engine', init: 'intro', opts: 'freeze' }));
  const a = cell(page, 'a');
  await a.locator('canvas').waitFor();
  // The stage it started in is not announced.
  await toldStages(page, []);
  await page.locator('[data-request="detail"]').click();
  await expect(a.getByTestId('stage')).toHaveText('detail');
  await expect(a.locator('.project-detail.is-open')).toHaveCount(1);
  await toldStages(page, ['detail']);
  // The browser's Back: the page asks for the intro, and the open detail closes.
  await page.locator('[data-request="intro"]').click();
  await expect(a.getByTestId('stage')).toHaveText('intro');
  await expect(a.locator('.project-detail.is-open')).toHaveCount(0);
  await toldStages(page, ['detail', 'intro']);
  // Asking again for where it is changes nothing.
  await page.locator('[data-request="intro"]').click();
  await page.waitForTimeout(300);
  await toldStages(page, ['detail', 'intro']);
  // The engine's own moves are announced too: Explore, then Escape.
  await a.getByTestId('explore').click();
  await expect(a.getByTestId('stage')).toHaveText('overview');
  await page.keyboard.press('Escape');
  await expect(a.getByTestId('stage')).toHaveText('intro');
  await toldStages(page, ['detail', 'intro', 'overview', 'intro']);
});

test('initialStage opens the instance on that stage, never the entrance', async ({ page }) => {
  await page.goto(embed({ ui: 'none', init: 'detail', opts: 'freeze' }));
  await expect(cell(page, 'a').getByTestId('stage')).toHaveText('detail');
  await toldStages(page, []);
});

test('a page with a page instance and one preview has two live canvases, no more', async ({ page }) => {
  await page.goto(embed({ ui: 'none', prev: 'settled', opts: 'freeze' }));
  await cell(page, 'a').locator('canvas').waitFor();
  await cell(page, 'b').locator('canvas').waitFor();
  await page.waitForTimeout(500);
  await expect(page.locator('canvas')).toHaveCount(2);
});

test('a new bundle object of the same world replaces the instance (the old world is not kept)', async ({ page }) => {
  await page.goto(embed({ ui: 'none', opts: 'freeze' }));
  const a = cell(page, 'a');
  await a.locator('canvas').waitFor();
  await a.getByTestId('explore').click();
  await expect(a.getByTestId('stage')).toHaveText('overview');
  const accent = () => a.locator('.spike').evaluate(el => getComputedStyle(el).getPropertyValue('--oct-accent').trim());
  expect(await accent()).toBe('#ff3b5c');
  await a.locator('canvas').evaluate(el => el.setAttribute('data-first', '1'));
  await page.getByTestId('replace').click();
  // The theme of the new bundle is in force, on a new canvas, and the instance began again (the intro).
  await expect.poll(accent, { timeout: 10_000 }).toBe('#00c2ff');
  await expect(a.locator('canvas[data-first]')).toHaveCount(0);
  await expect(a.locator('canvas')).toHaveCount(1);
  await expect(a.getByTestId('stage')).toHaveText('intro');
});
