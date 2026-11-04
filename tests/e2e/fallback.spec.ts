import { expect, test } from '@playwright/test';

// Task 27: without WebGL the page shows the poster and the HTML overlays, and the content stays reachable.
test('nowebgl shows the poster and working links', async ({ page }) => {
  await page.goto('/?nowebgl');
  await expect(page.locator('canvas')).toHaveCount(0);
  const poster = page.getByRole('img', { name: /Nox/ }).first();
  await expect(poster).toBeVisible();
  await expect(poster).toHaveAttribute('src', /poster-intro\.webp/);
  await expect.poll(() => poster.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  // The intro is up with no entrance to wait for; the overview and the detail follow.
  await page.getByRole('button', { name: /Explore/ }).click();
  const overview = page.getByRole('region', { name: 'Security Lab overview' });
  await expect(overview).toBeVisible();
  await overview.getByRole('button', { name: /View Project/ }).click();
  const detail = page.getByRole('region', { name: 'Security Lab full project view' });
  await expect(detail.getByRole('link', { name: /Live Demo/ })).toHaveAttribute('href', 'https://yourvaultstorage.com/');
  await expect(detail.getByRole('link', { name: /GitHub/ })).toHaveAttribute('href', 'https://github.com/adarshbam/my-storage');
  await expect(detail.getByRole('heading', { level: 1, name: 'Security Lab' })).toBeVisible();
});

test('a browser with no webgl2 context gets the same fallback', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof original;
  });
  await page.goto('/?world=nox');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('img', { name: /Nox/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Explore/ })).toBeVisible();
});

test('the overview in the fallback lists every technology', async ({ page }) => {
  await page.goto('/?nowebgl&stage=overview');
  await expect(page.locator('.orb-tray-item')).toHaveCount(15);
  await page.locator('.orb-tray-item[aria-label="Kali Linux"]').click();
  await expect(page.getByRole('tooltip')).toContainText('Used for penetration testing');
});
