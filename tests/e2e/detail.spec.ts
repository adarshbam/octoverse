import { expect, test, type Page } from '@playwright/test';

// Task 22: the full project view (panel 5).
const detail = (page: Page) => page.getByRole('region', { name: 'Security Lab full project view' });

test('detail shows Security Lab with working links', async ({ page }) => {
  await page.goto('/?stage=detail');
  const view = detail(page);
  await expect(view.getByRole('heading', { level: 1, name: 'Security Lab' })).toBeVisible();
  await expect(view.getByRole('link', { name: /Live Demo/ })).toHaveAttribute('href', 'https://yourvaultstorage.com/');
  await expect(view.getByRole('link', { name: /GitHub/ })).toHaveAttribute('href', 'https://github.com/adarshbam/my-storage');
});

test('Escape returns to overview without replaying the entrance', async ({ page }) => {
  await page.goto('/?stage=detail');
  await expect(detail(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Security Lab overview' })).toBeVisible();
  await expect(detail(page)).toBeHidden();
  await expect(page.getByRole('button', { name: /Explore/ })).toBeHidden();
});

// Review Focus 5: a project with no sections lists none, and shows no empty navigation.
test('empty sections are not listed', async ({ page }) => {
  await page.goto('/?stage=detail&fixture=nosections');
  const view = detail(page);
  await expect(view.getByRole('heading', { level: 1, name: 'Security Lab' })).toBeVisible();
  await expect(view.getByRole('navigation', { name: 'Project sections' })).toHaveCount(0);
});
