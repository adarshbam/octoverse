import { expect, test, type Page } from '@playwright/test';

// Task 23: the entrance (panel 1). Each test runs in a fresh browser context, so a first visit.
const skip = (page: Page) => page.getByRole('button', { name: 'Skip intro' });
const title = (page: Page) => page.getByRole('heading', { level: 1, name: 'Security Lab' });
// The stage's first render: the skip control, when there is one, comes with it.
const opened = (page: Page) => page.locator('.spike canvas').waitFor();

test('first visit shows the entrance, a reload in the same session goes straight to intro', async ({ page }) => {
  await page.goto('/');
  await opened(page);
  await expect(skip(page)).toBeVisible();
  await expect(title(page)).toBeHidden();
  // Nox swims in for 2.5 s, then the intro's words come in.
  await expect(title(page)).toBeVisible({ timeout: 10_000 });
  await expect(skip(page)).toBeHidden();
  await page.reload();
  await opened(page);
  await expect(skip(page)).toHaveCount(0);
  await expect(title(page)).toBeVisible();
});

test('reduced motion skips the entrance', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await opened(page);
  await expect(skip(page)).toHaveCount(0);
  await expect(title(page)).toBeVisible();
});

test('Skip intro, a click anywhere or a key ends the entrance at once', async ({ browser }) => {
  for (const how of ['button', 'click', 'key'] as const) {
    const page = await browser.newPage();
    // The page's clock stands still, so only the skip can end the entrance.
    await page.clock.install();
    await page.goto('/');
    await opened(page);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    await expect(skip(page), how).toBeVisible();
    if (how === 'button') await skip(page).click();
    else if (how === 'click') await page.mouse.click(200, 200);
    else await page.keyboard.press('Space');
    await expect(title(page), how).toBeVisible();
    await expect(skip(page), how).toBeHidden();
    await page.close();
  }
});
