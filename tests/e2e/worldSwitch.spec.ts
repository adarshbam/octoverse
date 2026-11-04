import { type Page, expect, test } from '@playwright/test';

// Task 10: `?world=` picks the world, and switching worlds is a full unmount and remount (spec 8.3).
// The switch is development-only (`window.__octoSwitchWorld`), and its second world is Nox's bundle
// cloned as `nox-b` (`?testworld=1`): neither is in the production build.

type Win = {
  __octoSwitchWorld?: (id: string) => void;
  __octoverse?: { ready: boolean; entrance?: { loaded: boolean; t: number }; hold?: { techId: string }[] };
  __live?: (type: string) => number;
};
const TYPES = ['keydown', 'pointerdown', 'pointermove', 'resize'];

const skip = (page: Page) => page.getByRole('button', { name: 'Skip intro' });
const explore = (page: Page) => page.getByRole('button', { name: /Explore/ });

/** Counts the window's live listeners by type from the first script (the same function and capture flag added twice is one, as the browser has it). */
async function countListeners(page: Page) {
  await page.addInitScript(() => {
    const live = new Map<string, Set<string>>();
    const ids = new WeakMap<object, number>();
    let next = 0;
    const tag = (listener: object, options?: boolean | AddEventListenerOptions | EventListenerOptions) => {
      if (!ids.has(listener)) ids.set(listener, ++next);
      return `${ids.get(listener)}#${typeof options === 'boolean' ? options : Boolean(options?.capture)}`;
    };
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
      if (listener) (live.get(type) ?? live.set(type, new Set()).get(type)!).add(tag(listener, options));
      add(type, listener as EventListener, options);
    }) as typeof window.addEventListener;
    window.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) => {
      if (listener) live.get(type)?.delete(tag(listener, options));
      remove(type, listener as EventListener, options);
    }) as typeof window.removeEventListener;
    (window as unknown as Win).__live = type => live.get(type)?.size ?? 0;
  });
}
const listeners = (page: Page) => page.evaluate(types => types.map(type => (window as unknown as Win).__live!(type)), TYPES);

/** Problems the page reports: errors and uncaught exceptions (a failed resource, such as the favicon, is not one). */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) problems.push(`console.error: ${message.text()}`);
  });
  return problems;
}

/** The technologies an arm is holding (the suction hold: set while a technology is chosen). */
const held = (page: Page) => page.evaluate(() => ((window as unknown as Win).__octoverse?.hold ?? []).map(h => h.techId));

/**
 * Switches worlds. The old instance's development probes (`window.__octoverse`, a ready flag set once)
 * are cleared first, so what is read afterwards is the new instance's own: ready again only once it
 * has drawn its frames.
 */
const switchTo = (page: Page, id: string) =>
  page.evaluate(world => {
    delete (window as unknown as Win).__octoverse;
    (window as unknown as Win).__octoSwitchWorld!(world);
  }, id);

const drawn = (page: Page) =>
  page.waitForFunction(() => (window as unknown as Win).__octoverse?.ready === true && typeof (window as unknown as Win).__octoSwitchWorld === 'function', undefined, { timeout: 90_000 });

test('switching worlds is a full remount: back in the intro, nothing selected, no listener leaked', async ({ page }) => {
  test.setTimeout(150_000);
  const problems = watch(page);
  await countListeners(page);
  await page.goto('/?testworld=1&stage=intro');
  await expect(page.locator('.orb-button')).toHaveCount(15, { timeout: 60_000 });
  await drawn(page);
  await expect(explore(page)).toBeVisible();

  // The intro's own listeners (a focus adds some of its own: a stage has the listeners it needs).
  const before = await listeners(page);

  // Choose a technology: the stage is techFocus, its tooltip is up and its bubble is pressed.
  await page.getByRole('button', { name: 'Kali Linux' }).focus();
  await expect(page.getByRole('tooltip')).toContainText('Used for penetration testing', { timeout: 60_000 });
  await expect.poll(() => held(page)).toEqual(['kali']);
  const focused = await listeners(page);
  expect(focused[0], 'a page instance listens for keys').toBeGreaterThanOrEqual(1);
  expect(focused[1], 'and for presses').toBeGreaterThanOrEqual(1);

  await switchTo(page, 'nox-b');

  // The new world: its own intro (`?stage=intro` is the page's), nothing chosen, no tooltip.
  await expect(explore(page)).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.orb-button')).toHaveCount(15);
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expect(page.locator('.spike canvas')).toHaveCount(1);
  await drawn(page);
  await expect.poll(() => held(page)).toEqual([]);
  expect(await listeners(page)).toEqual(before);

  // And back again: a second remount leaks nothing either.
  await switchTo(page, 'nox');
  await expect(explore(page)).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.orb-button')).toHaveCount(15);
  await drawn(page);
  expect(await listeners(page)).toEqual(before);
  expect(problems).toEqual([]);
});

test("the switched-to world plays its own entrance under its own flag (octoverse.nox-b.entranceSeen), and Nox's flag is untouched", async ({ page }) => {
  test.setTimeout(150_000);
  const problems = watch(page);
  // This session has seen Nox's entrance, not nox-b's.
  await page.addInitScript(() => {
    sessionStorage.setItem('octoverse.nox.entranceSeen', '1');
    sessionStorage.removeItem('octoverse.nox-b.entranceSeen');
  });
  await page.goto('/?testworld=1');
  await expect(explore(page)).toBeVisible({ timeout: 90_000 });
  await expect(skip(page)).toBeHidden();
  await drawn(page);
  const flag = (key: string) => page.evaluate(k => sessionStorage.getItem(k), key);
  expect(await flag('octoverse.nox-b.entranceSeen')).toBeNull();

  await switchTo(page, 'nox-b');

  // nox-b's entrance plays: the skip control is up, its clock runs from the start, its flag is not yet set.
  await expect(skip(page)).toBeVisible({ timeout: 90_000 });
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__octoverse?.entrance?.t ?? 0), { timeout: 60_000 }).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as Win).__octoverse?.entrance?.t ?? 0), 'a new clock, still in the first seconds').toBeLessThan(8.4);
  expect(await flag('octoverse.nox-b.entranceSeen')).toBeNull();

  // Once it is over (here, skipped) the session has seen nox-b's entrance; Nox's flag is as it was.
  await skip(page).click();
  await expect(explore(page)).toBeVisible();
  await expect.poll(() => flag('octoverse.nox-b.entranceSeen')).toBe('1');
  expect(await flag('octoverse.nox.entranceSeen')).toBe('1');
  expect(problems).toEqual([]);
});

test('?world=nope loads Nox and logs the warning; ?world=nox is Nox; the test world is only there behind ?testworld=1', async ({ page }) => {
  test.setTimeout(150_000);
  const warnings: string[] = [];
  const problems = watch(page);
  page.on('console', message => message.type() === 'warning' && warnings.push(message.text()));

  await page.goto('/?world=nope&stage=intro');
  await expect(page.locator('.orb-button')).toHaveCount(15, { timeout: 60_000 });
  await expect(explore(page)).toBeVisible();
  expect(warnings.filter(text => text.includes('nope'))).toHaveLength(1);

  warnings.length = 0;
  await page.goto('/?world=nox&stage=intro');
  await expect(page.locator('.orb-button')).toHaveCount(15, { timeout: 60_000 });
  expect(warnings.filter(text => text.includes('Unknown world'))).toEqual([]);

  // Without ?testworld=1, nox-b is an unknown id: Nox, with the warning; and the switch refuses it (it warns and stays on Nox).
  warnings.length = 0;
  await page.goto('/?world=nox-b&stage=intro');
  await expect(page.locator('.orb-button')).toHaveCount(15, { timeout: 60_000 });
  expect(warnings.filter(text => text.includes('nox-b'))).toHaveLength(1);
  await drawn(page);
  await page.evaluate(() => (window as unknown as Win).__octoSwitchWorld!('no-such-world'));
  expect(warnings.filter(text => text.includes('no-such-world'))).toHaveLength(1);
  await expect(page.locator('.orb-button')).toHaveCount(15);
  await expect(explore(page)).toBeVisible();
  expect(problems).toEqual([]);
});

test("another world's boot veil and title carry none of Nox: no Security Lab, no flame, not his water; Nox's own veil is as it was", async ({ page }) => {
  test.setTimeout(150_000);
  const problems = watch(page);
  await page.goto('/?world=nox-b&testworld=1', { waitUntil: 'commit' });
  const veil = page.locator('#boot-veil');
  await expect(veil.getByText('OCTOVERSE')).toBeVisible();
  await expect(veil.getByText('Security Lab')).toHaveCount(0);
  await expect(veil.locator('svg')).toHaveCount(0);
  expect(await veil.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgb(7, 21, 53)');
  expect(await page.title()).not.toMatch(/Nox|Security Lab/);
  // Once the world is up the title is the world's own (the test world names itself), still not Nox's.
  await expect.poll(() => page.title(), { timeout: 90_000 }).toBe('OctoVerse test world');
  await drawn(page);

  // Nox's page keeps its veil words and its title.
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('#boot-veil').getByText('Security Lab')).toBeVisible();
  expect(await page.title()).toBe('Nox · Security Lab');
  expect(problems).toEqual([]);
});
