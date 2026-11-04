import { expect, test } from '@playwright/test';

// Aether's intro offers no technology choice (spec 7.5; spec 8 item 14, a stage with zero choosable
// artifacts): the gold ring's beads are not buttons, there is no tray, and a keyboard-only visitor
// goes from the skip link straight to Explore, the way on to the overview.
for (const motion of ['freeze', 'moving'] as const) {
  test(`Aether intro (${motion}): no orb buttons or tray; after the skip link the first stop is Explore`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/?world=aether&stage=intro${motion === 'freeze' ? '&freeze' : ''}`);
    const explore = page.getByRole('button', { name: /Explore/ });
    await expect(explore).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('.orb-buttons')).toHaveCount(0);
    await expect(page.locator('.orb-button')).toHaveCount(0);
    await expect(page.locator('.orb-tray')).toHaveCount(0);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /Skip to project details/ })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(explore).toBeFocused();
    // The ring sways for a moment (with motion) without an error.
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });
}
