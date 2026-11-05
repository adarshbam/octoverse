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

// Task 21 (spec 2.5): Aether to Nox to Aether, caught while Aether's entrance, then her ring forming, then the head's
// opening flight (the swell, through the overview) is running. Each switch is a full remount: the stage, the clocks, the
// selection and the sequences start again; the window's listeners are as they were; and Aether touches only her own
// session flag (`octoverse.aether.entranceSeen`), never Nox's or Veyra's.
const FLAGS = ['octoverse.nox.entranceSeen', 'octoverse.veyra.entranceSeen', 'octoverse.aether.entranceSeen'] as const;
const flags = (page: Page) => page.evaluate(keys => Object.fromEntries(keys.map(key => [key, sessionStorage.getItem(key)])), FLAGS);
const NONE = { 'octoverse.nox.entranceSeen': null, 'octoverse.veyra.entranceSeen': null, 'octoverse.aether.entranceSeen': null };
type Swell = { open: boolean; moving: boolean; morph: number; effect: number; push: number };
const swellOf = (page: Page) => page.evaluate(() => ((window as unknown as { __octoverse?: { swell?: unknown } }).__octoverse?.swell ?? null) as Swell | null);
const liftsOf = (page: Page) => page.evaluate(() => ((window as unknown as { __octoverse?: { lift?: unknown[] } }).__octoverse?.lift ?? []).length);
const entranceT = (page: Page) => page.evaluate(() => (window as unknown as Win).__octoverse?.entrance?.t ?? 0);

test('Aether to Nox to Aether during her entrance: each entrance starts again from its first seconds, no listener leaks, and only her own flag is ever written', async ({ page }) => {
  test.setTimeout(240_000);
  const problems = watch(page);
  await countListeners(page);
  await page.goto('/?world=aether');
  await expect(skip(page)).toBeVisible({ timeout: 90_000 });
  await drawn(page);
  await expect.poll(() => entranceT(page), { timeout: 60_000 }).toBeGreaterThan(0.6);
  expect(await page.title()).toBe('Aether · AI Playground');
  expect(await flags(page)).toEqual(NONE);
  const before = await listeners(page);

  // To Nox, mid-entrance: his own entrance plays (his flag is not set), from its start, under his own title.
  await switchTo(page, 'nox');
  await expect(skip(page)).toBeVisible({ timeout: 90_000 });
  await drawn(page);
  await expect.poll(() => entranceT(page), { timeout: 60_000 }).toBeGreaterThan(0);
  expect(await entranceT(page), "Nox's clock is his own, in its first seconds").toBeLessThan(8.4);
  expect(await page.title()).toBe('Nox · Security Lab');
  expect(await flags(page)).toEqual(NONE);
  await expect(page.getByRole('region', { name: /AI Playground/ })).toHaveCount(0);

  // And back: her entrance is not where it was left, it starts again; the page's listeners are the first visit's.
  await switchTo(page, 'aether');
  await expect(skip(page)).toBeVisible({ timeout: 90_000 });
  await drawn(page);
  await expect.poll(() => entranceT(page), { timeout: 60_000 }).toBeGreaterThan(0.6);
  expect(await page.title()).toBe('Aether · AI Playground');
  expect(await flags(page)).toEqual(NONE);
  expect(await listeners(page)).toEqual(before);

  // Once it is over (skipped) the session has seen her entrance and only hers.
  await skip(page).click();
  await expect(explore(page)).toBeVisible();
  await expect.poll(() => flags(page)).toEqual({ ...NONE, 'octoverse.aether.entranceSeen': '1' });
  expect(problems).toEqual([]);
});

test('Aether to Nox to Aether while her ring is forming (just after the entrance): back in a closed intro, nothing chosen, nothing leaked', async ({ page }) => {
  test.setTimeout(240_000);
  const problems = watch(page);
  await countListeners(page);
  await page.goto('/?world=aether');
  await expect(skip(page)).toBeVisible({ timeout: 90_000 });
  await drawn(page);
  // The entrance ends (skipped here): the ring's twinkle (1.4 s from the first frame the ring exists) begins and her flag is set.
  // The switch is made at once, well inside that 1.4 s. The ring itself has no probe: its states are the unit tests of `twinkleState`.
  await skip(page).click();
  await expect(explore(page)).toBeVisible();
  const before = await listeners(page);
  const clickedAt = Date.now();
  await switchTo(page, 'nox');
  expect(Date.now() - clickedAt, 'the switch was made inside the twinkle').toBeLessThan(1400);
  await expect(explore(page)).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.orb-button')).toHaveCount(15, { timeout: 60_000 });
  await drawn(page);
  expect(await page.title()).toBe('Nox · Security Lab');
  expect((await flags(page))['octoverse.nox.entranceSeen']).toBeNull();
  expect((await flags(page))['octoverse.veyra.entranceSeen']).toBeNull();

  await switchTo(page, 'aether');
  // Her flag says the entrance was seen, so she is in the intro (no entrance again), with the head closed and nothing chosen.
  await expect(explore(page)).toBeVisible({ timeout: 90_000 });
  await expect(skip(page)).toBeHidden();
  await drawn(page);
  await expect(page.locator('.orb-button')).toHaveCount(0);
  await expect(page.getByRole('tooltip')).toBeHidden();
  expect(await swellOf(page)).toMatchObject({ open: false, moving: false, morph: 0 });
  expect(await liftsOf(page)).toBe(0);
  expect(await page.title()).toBe('Aether · AI Playground');
  expect(await listeners(page)).toEqual(before);
  expect(await flags(page)).toEqual({ ...NONE, 'octoverse.aether.entranceSeen': '1' });
  expect(problems).toEqual([]);
});

/** Explore by keyboard: her nameplate rides her float, so a pointer click never finds it still (Playwright waits for a stable box). */
const pressExplore = async (page: Page) => {
  await explore(page).focus();
  await page.keyboard.press('Enter');
};

test('Aether to Nox to Aether during the opening flight (swell mid-way) and with an orb chosen: closed and in the intro each time, no lift, no listener leaked', async ({ page }) => {
  test.setTimeout(240_000);
  const problems = watch(page);
  await countListeners(page);
  // Her entrance is seen (it is not the subject here), so she opens in the intro.
  await page.addInitScript(() => sessionStorage.setItem('octoverse.aether.entranceSeen', '1'));
  await page.goto('/?world=aether');
  await expect(explore(page)).toBeVisible({ timeout: 90_000 });
  await drawn(page);
  const before = await listeners(page);

  // Click Explore, and switch from inside the page at the first frame the head is mid-opening: the swell moving and the synapse effect
  // under way (its sheet runs 0.2 to 1.35 s: the flight is in the air). A page-side watcher, so a slow runner cannot miss the moment.
  await page.evaluate(() => {
    type Mid = { morph: number; effect: number };
    const w = window as unknown as Win & { __midFlight?: Mid | null; __octoverse?: { swell?: { moving: boolean; morph: number; effect: number } } };
    w.__midFlight = null;
    const tick = () => {
      const s = w.__octoverse?.swell;
      if (s && s.moving && s.morph > 0.35 && s.morph < 1.2 && s.effect > 0.05 && s.effect < 0.95) {
        w.__midFlight = { morph: s.morph, effect: s.effect };
        delete w.__octoverse;
        w.__octoSwitchWorld!('nox');
      } else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await pressExplore(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __midFlight?: unknown }).__midFlight ?? null), { timeout: 60_000 }).not.toBeNull();
  const caught = await page.evaluate(() => (window as unknown as { __midFlight: { morph: number; effect: number } }).__midFlight);
  test.info().annotations.push({ type: 'switched mid-flight at', description: JSON.stringify(caught) });
  await expect(explore(page)).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.orb-button')).toHaveCount(15, { timeout: 60_000 });
  await drawn(page);
  expect(await page.title()).toBe('Nox · Security Lab');
  expect(await swellOf(page)).toMatchObject({ open: false, morph: 0 });

  await switchTo(page, 'aether');
  await expect(explore(page)).toBeVisible({ timeout: 90_000 });
  await drawn(page);
  expect(await swellOf(page), 'her head is closed again, not where the flight left it').toMatchObject({ open: false, moving: false, morph: 0, effect: 0 });
  await expect(page.locator('.orb-button')).toHaveCount(0);
  expect(await listeners(page)).toEqual(before);

  // The sequences are loaded again and work: open the overview, let the orbs land, choose OpenAI (its arm lifts).
  await pressExplore(page);
  await expect(page.locator('.orb-button')).toHaveCount(10, { timeout: 60_000 });
  await expect.poll(() => swellOf(page), { timeout: 60_000 }).toMatchObject({ open: true, moving: false, morph: 1 });
  await page.getByRole('button', { name: 'OpenAI' }).focus();
  await expect(page.getByRole('tooltip')).toContainText('Function calling', { timeout: 60_000 });
  await expect.poll(() => liftsOf(page)).toBe(1);

  // Switch with the choice up: Nox, then Aether again: nothing is chosen (no tooltip, no lift, no orb), she is in the intro.
  await switchTo(page, 'nox');
  await expect(explore(page)).toBeVisible({ timeout: 90_000 });
  await drawn(page);
  await expect(page.getByRole('tooltip')).toBeHidden();
  await switchTo(page, 'aether');
  await expect(explore(page)).toBeVisible({ timeout: 90_000 });
  await drawn(page);
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expect(page.locator('.orb-button')).toHaveCount(0);
  expect(await liftsOf(page)).toBe(0);
  expect(await swellOf(page)).toMatchObject({ open: false, morph: 0 });
  expect(await listeners(page)).toEqual(before);
  // Neither of the other worlds' flags was written by her.
  const seen = await flags(page);
  expect(seen['octoverse.nox.entranceSeen']).toBeNull();
  expect(seen['octoverse.veyra.entranceSeen']).toBeNull();
  expect(problems).toEqual([]);
});
