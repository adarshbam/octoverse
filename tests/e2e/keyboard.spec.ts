import { expect, test } from '@playwright/test';

// Review Focus 3: a keyboard-only visitor reaches every orb, its tooltip opens on focus, and
// Escape closes the tooltip without losing their place.
test('keyboard: Tab reaches the Kali orb, its tooltip opens, Escape closes it and focus stays', async ({ page }) => {
  await page.goto('/?stage=overview');
  const kali = page.getByRole('button', { name: 'Kali Linux' });
  for (let i = 0; i < 40 && !(await kali.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(kali).toBeFocused();
  await expect(page.getByRole('tooltip')).toContainText('Used for penetration testing');
  // The suction hold: an arm has pulled the Kali bubble to its tip and holds it, and only it.
  const held = () => page.evaluate(() => (window as unknown as { __noxHold?: { techId: string; pull: number; release: number }[] }).__noxHold ?? []);
  await expect.poll(held).toEqual([{ techId: 'kali', pull: 1, release: 0 }]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expect(kali).toBeFocused();
  // Escape releases it back to its orbit.
  await expect.poll(held).toEqual([]);
});

// Bubbles orbit Nox from the intro: a keyboard-only visitor tabs to every one, and the tooltip of
// the one reached describes it; the focus lets go to the intro, not the overview.
test('keyboard reaches every bubble from the intro', async ({ page }) => {
  // Fifteen focuses, each a stage change and a tooltip: slow on a busy machine.
  test.setTimeout(120_000);
  await page.goto('/?stage=intro&freeze');
  const buttons = page.locator('.orb-button');
  await expect(buttons).toHaveCount(15);
  const names = await buttons.evaluateAll(list => list.map(el => el.getAttribute('aria-label')));
  const seen = new Set<string>();
  for (let i = 0; i < 80 && seen.size < names.length; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => (document.activeElement?.classList.contains('orb-button') ? document.activeElement.getAttribute('aria-label') : null));
    if (label) seen.add(label);
  }
  expect([...seen].sort()).toEqual([...names].sort());
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toBeHidden();
  // Letting go returns to the intro: its title is still there and its nameplate is the way on.
  await expect(page.getByRole('button', { name: /Explore/ })).toBeVisible();
});

// The head swell (Task 24): the nameplate is the head's button. A keyboard-only visitor tabs to it
// and presses Enter: the head squeezes, swells past full and settles open with its glyphs; Escape
// plays it back to closed.
test('keyboard opens the head swell from the intro, and Escape closes it', async ({ page }) => {
  // The swell runs on frame time: slow on a busy machine.
  test.setTimeout(120_000);
  await page.goto('/?stage=intro');
  const explore = page.getByRole('button', { name: /Explore/ });
  for (let i = 0; i < 40 && !(await explore.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(explore).toBeFocused();
  type Swell = { open: boolean; moving: boolean; morph: number; effect: number; push: number };
  const swell = () => page.evaluate(() => (window as unknown as { __noxSwell?: Swell }).__noxSwell ?? null);
  await expect.poll(swell).toMatchObject({ open: false, morph: 0 });
  await page.keyboard.press('Enter');
  // It runs past full on the way (the overshoot), then settles open with the glyphs and the bubbles pushed out.
  let peak = 0;
  await expect.poll(async () => {
    const s = await swell();
    peak = Math.max(peak, s?.morph ?? 0);
    return s;
  }, { intervals: [30], timeout: 45_000 }).toMatchObject({ open: true, moving: false, morph: 1, effect: 1 });
  expect(peak).toBeGreaterThan(1);
  expect((await swell())!.push).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect.poll(swell, { timeout: 45_000 }).toMatchObject({ open: false, moving: false, morph: 0, effect: 0, push: 0 });
  await expect(page.getByRole('button', { name: /Explore/ })).toBeVisible();
});
