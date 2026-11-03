import { type Page, expect, test } from '@playwright/test';

// Two instances on one page (src/app/multi.html, development only): they must share no selection,
// timer, listener, id or storage. A is a page instance, B a preview unless a test says otherwise.
// Each instance is in a cell, `[data-slot="a"]` and `[data-slot="b"]`.

const multi = (query: { a?: string; b?: string; amode?: 'page' | 'preview'; bmode?: 'page' | 'preview'; showb?: '0' } = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, value);
  return `/src/app/multi.html?${params}`;
};
const cell = (page: Page, slot: 'a' | 'b') => page.locator(`[data-slot="${slot}"]`);

type Win = { __listenerCount?: (type: string) => number; __storageCalls?: string[]; __noxReady?: boolean; __noxEntrance?: { loaded: boolean }; __octoverse?: { ready: boolean; entrance?: unknown }; __noxCamera?: unknown; __noxHold?: unknown };
const listenerCount = (page: Page, type: string) => page.evaluate(t => (window as unknown as Win).__listenerCount!(t), type);

const FOCUS_KALI = 'stage=techFocus&tech=kali&freeze';

test('(a) two instances share no id, and every reference points inside its own instance', async ({ page }) => {
  await page.goto(multi({ a: FOCUS_KALI, b: FOCUS_KALI }));
  // Each tooltip waits for its bubbles' first frame, which comes after the world's kit on a loaded machine.
  for (const slot of ['a', 'b'] as const) await expect(cell(page, slot).getByRole('tooltip')).toContainText('Used for penetration testing', { timeout: 60_000 });

  const report = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
    const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    const stray: string[] = [];
    const checked = { 'aria-controls': 0, 'aria-describedby': 0, 'aria-labelledby': 0, href: 0 };
    for (const el of document.querySelectorAll('[aria-controls], [aria-describedby], [aria-labelledby], a[href^="#"]')) {
      const owner = el.closest('[data-slot]');
      const refs: [keyof typeof checked, string][] = [];
      for (const attribute of ['aria-controls', 'aria-describedby', 'aria-labelledby'] as const) {
        for (const id of el.getAttribute(attribute)?.split(/\s+/) ?? []) if (id) refs.push([attribute, id]);
      }
      const href = el.getAttribute('href');
      if (href?.startsWith('#')) refs.push(['href', href.slice(1)]);
      for (const [kind, id] of refs) {
        checked[kind]++;
        const target = document.getElementById(id);
        if (!target || !owner?.contains(target)) stray.push(`${kind}=${id} on ${el.tagName.toLowerCase()} in ${owner?.getAttribute('data-slot')}`);
      }
    }
    return { duplicates, stray, checked };
  });
  expect(report.duplicates).toEqual([]);
  expect(report.stray).toEqual([]);
  // Not a vacuous pass: each instance has two of each reference (A and B), and the tooltips are described.
  expect(report.checked['aria-controls']).toBeGreaterThanOrEqual(2);
  expect(report.checked['aria-describedby']).toBeGreaterThanOrEqual(2);
  expect(report.checked.href).toBeGreaterThanOrEqual(2);
});

test("(b) choosing a technology in A leaves B's buttons, tray and tooltip as they were", async ({ page }) => {
  await page.goto(multi({ a: 'stage=intro&freeze', b: 'stage=intro&freeze' }));
  const aKali = cell(page, 'a').getByRole('button', { name: 'Kali Linux' });
  await expect(aKali).toHaveCount(1);
  await expect(cell(page, 'b').locator('.orb-button')).toHaveCount(15);
  // Focus is how a keyboard visitor chooses an orb (the pointer's own click lands on whichever bubble is drawn there).
  await aKali.focus();
  await expect(cell(page, 'a').getByRole('tooltip')).toContainText('Used for penetration testing', { timeout: 60_000 });
  await expect(cell(page, 'a').locator('.orb-button[aria-describedby]')).toHaveCount(1);
  // The other instance has chosen nothing, and has no tooltip to show.
  await page.waitForTimeout(600);
  const b = cell(page, 'b');
  await expect(b.locator('.orb-button[aria-pressed="true"]')).toHaveCount(0);
  await expect(b.locator('.orb-tray-item[aria-pressed="true"]')).toHaveCount(0);
  await expect(b.locator('[aria-describedby]')).toHaveCount(0);
  await expect(b.locator('.tech-tooltip')).toHaveCount(0);
  // B is not dead: choosing in B shows B's tooltip, and A keeps its own.
  await b.locator('.orb-button').first().focus();
  await expect(b.getByRole('tooltip')).toBeVisible();
  await expect(cell(page, 'a').getByRole('tooltip')).toContainText('Used for penetration testing');
});

for (const input of ['a key', 'a pointer press'] as const) {
  test(`(c) ${input} while both instances are entering skips A, a page, and not B, a preview`, async ({ page }) => {
    await page.goto(multi());
    await page.waitForFunction(() => (window as unknown as Win).__noxEntrance?.loaded === true, undefined, { timeout: 60_000 });
    const skipA = cell(page, 'a').locator('.skip-entrance');
    const skipB = cell(page, 'b').locator('.skip-entrance');
    await expect(skipA).not.toHaveClass(/is-hidden/);
    await expect(skipB).not.toHaveClass(/is-hidden/);
    if (input === 'a key') await page.keyboard.press('x');
    else await page.mouse.click(12, 400);
    await expect(skipA).toHaveClass(/is-hidden/);
    // A has landed in the intro; B is still on its entrance a while later.
    await page.waitForTimeout(1200);
    await expect(skipB).not.toHaveClass(/is-hidden/);
  });
}

test("(d) a preview adds and removes no window listener, and the page's Escape still closes its own detail", async ({ page }) => {
  await page.goto(multi({ a: 'stage=detail&freeze', b: 'stage=detail&freeze', showb: '0' }));
  const openA = cell(page, 'a').locator('.project-detail.is-open');
  await expect(openA).toHaveCount(1);
  // The character lives in the canvas, which mounts after the page's own controls: count once it is ready.
  await page.waitForFunction(() => (window as unknown as Win).__noxReady === true, undefined, { timeout: 90_000 });
  const TYPES = ['keydown', 'pointerdown'];
  const before = await Promise.all(TYPES.map(type => listenerCount(page, type)));
  // The page instance is listening (Escape, the skip, the rest wake-up): not a vacuous zero.
  expect(before[0]).toBeGreaterThanOrEqual(2);

  await page.getByRole('button', { name: 'Mount B' }).click();
  const openB = cell(page, 'b').locator('.project-detail.is-open');
  await expect(openB).toHaveCount(1);
  expect(await Promise.all(TYPES.map(type => listenerCount(page, type)))).toEqual(before);

  // With the preview mounted, the page's Escape closes the page's detail and does not touch the preview's.
  await page.keyboard.press('Escape');
  await expect(openA).toHaveCount(0);
  await expect(openB).toHaveCount(1);

  await page.getByRole('button', { name: 'Unmount B' }).click();
  await expect(cell(page, 'b')).toHaveCount(0);
  expect(await Promise.all(TYPES.map(type => listenerCount(page, type)))).toEqual(before);

  // Still the page's own: a second Escape steps A from the overview to the intro, and the listeners are intact.
  await page.keyboard.press('Escape');
  await expect(cell(page, 'a').getByRole('region', { name: 'Security Lab overview' })).toBeHidden();
  expect(await Promise.all(TYPES.map(type => listenerCount(page, type)))).toEqual(before);
});

test('(d) mount, unmount and mount the preview leaves one registration of each kind live', async ({ page }) => {
  await page.goto(multi({ a: 'stage=intro&freeze', b: 'stage=intro&freeze', showb: '0' }));
  await expect(cell(page, 'a').locator('.orb-button')).toHaveCount(15);
  await page.waitForFunction(() => (window as unknown as Win).__noxReady === true, undefined, { timeout: 90_000 });
  const before = [await listenerCount(page, 'keydown'), await listenerCount(page, 'pointerdown'), await listenerCount(page, 'pointermove')];
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Mount B' }).click();
    await expect(cell(page, 'b').locator('.orb-button')).toHaveCount(15);
    await page.getByRole('button', { name: 'Unmount B' }).click();
    await expect(cell(page, 'b')).toHaveCount(0);
  }
  expect([await listenerCount(page, 'keydown'), await listenerCount(page, 'pointerdown'), await listenerCount(page, 'pointermove')]).toEqual(before);
});

test('(e) a preview instance never writes sessionStorage, touches the location or sets a debug hook', async ({ page }) => {
  await page.goto(multi({ amode: 'preview', bmode: 'preview' }));
  const start = page.url();
  await page.waitForFunction(() => document.querySelectorAll('canvas').length === 2);
  // Skip both entrances (the page's own instance would record that the entrance was seen), and follow a skip link.
  for (const slot of ['a', 'b'] as const) {
    await cell(page, slot).locator('.skip-entrance').click();
    await expect(cell(page, slot).getByRole('button', { name: /Explore/ })).toBeVisible();
  }
  await cell(page, 'a').getByRole('link', { name: 'Skip to project details' }).focus();
  await page.keyboard.press('Enter');
  await expect(cell(page, 'a').locator('.project-detail.is-open')).toHaveCount(1);
  // Let both draw frames, so anything they would write each frame is written.
  await page.waitForTimeout(2500);
  const seen = await page.evaluate(() => ({
    storage: (window as unknown as Win).__storageCalls,
    length: sessionStorage.length,
    href: location.href,
    ready: (window as unknown as Win).__noxReady,
    octoverse: (window as unknown as Win).__octoverse,
    camera: (window as unknown as Win).__noxCamera,
    hold: (window as unknown as Win).__noxHold,
  }));
  expect(seen.storage).toEqual([]);
  expect(seen.length).toBe(0);
  expect(seen.href).toBe(start);
  expect(seen.ready).toBeUndefined();
  expect(seen.octoverse).toBeUndefined();
  expect(seen.camera).toBeUndefined();
  expect(seen.hold).toBeUndefined();
});

test('(e) control: a page instance does record the entrance as seen and does report ready', async ({ page }) => {
  await page.goto(multi({ showb: '0' }));
  await cell(page, 'a').locator('.skip-entrance').click();
  await expect(cell(page, 'a').getByRole('button', { name: /Explore/ })).toBeVisible();
  await page.waitForFunction(() => (window as unknown as Win).__noxReady === true, undefined, { timeout: 90_000 });
  const seen = await page.evaluate(() => ({
    calls: (window as unknown as Win).__storageCalls,
    flag: sessionStorage.getItem('octoverse.nox.entranceSeen'),
    ready: (window as unknown as Win).__octoverse?.ready,
    sameEntrance: (window as unknown as Win).__octoverse?.entrance === (window as unknown as Win).__noxEntrance,
  }));
  expect(seen.calls).toContain('setItem octoverse.nox.entranceSeen');
  expect(seen.flag).toBe('1');
  expect(seen.ready).toBe(true);
  expect(seen.sameEntrance).toBe(true);
});
