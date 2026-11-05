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

// Spec 7.11 (Task 13): on a phone held upright her orbs are in the tray. The overview's tray lists
// all ten of her technologies, in the project's order, as 44 px buttons inside the screen, riding
// above the overview's bottom sheet.
test.describe('Aether on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test.setTimeout(120_000);

  test('the overview tray lists her ten technologies above the bottom sheet', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?world=aether&stage=overview&freeze');
    await expect(page.locator('.orb-tray.is-open')).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => page.locator('.orb-tray').evaluate(el => getComputedStyle(el).opacity), { timeout: 30_000 }).toBe('1');
    const items = page.locator('.orb-tray-item');
    await expect(items).toHaveCount(10);
    expect(await items.evaluateAll(els => els.map(el => el.getAttribute('aria-label')))).toEqual(['OpenAI', 'Python', 'TypeScript', 'React', 'Next.js', 'PostgreSQL', 'Redis', 'Docker', 'AWS', 'Vector DB']);
    const boxes = await items.evaluateAll(els => els.map(el => el.getBoundingClientRect().toJSON() as { x: number; y: number; width: number; height: number }));
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
    const sheet = page.getByRole('region', { name: 'AI Playground overview' });
    await expect(sheet).toBeVisible();
    const sheetBox = (await sheet.boundingBox())!;
    expect(Math.max(...boxes.map(box => box.y + box.height))).toBeLessThanOrEqual(sheetBox.y);
    expect(errors).toEqual([]);
  });
});
