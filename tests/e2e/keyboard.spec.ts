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
