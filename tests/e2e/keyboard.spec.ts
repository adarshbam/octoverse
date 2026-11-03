import { expect, test } from '@playwright/test';

// Review Focus 3: a keyboard-only visitor reaches every orb, its tooltip opens on focus, and
// Escape closes the tooltip without losing their place.
test('keyboard: Tab reaches the Kali orb, its tooltip opens, Escape closes it and focus stays', async ({ page }) => {
  await page.goto('/?stage=overview');
  const kali = page.getByRole('button', { name: 'Kali Linux' });
  for (let i = 0; i < 40 && !(await kali.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(kali).toBeFocused();
  await expect(page.getByRole('tooltip')).toContainText('Used for penetration testing');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expect(kali).toBeFocused();
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
