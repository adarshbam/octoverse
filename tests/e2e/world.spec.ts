import { expect, test, type Browser } from '@playwright/test';

// The HQ panel 2 framing that scripts/world-capture.mjs uses, at a quarter of its size: small, so
// it stays light beside the other specs (the entrance's timing check runs alongside it).
const VIEW = '-3.8318,2.4225,3.6792,-2.5848';

/** A frozen silhouette capture (white Nox on black) of the intro, with `extra` added to the query. */
async function silhouette(browser: Browser, extra: string) {
  const page = await browser.newPage({ viewport: { width: 384, height: 256 }, deviceScaleFactor: 1 });
  await page.goto(`/?stage=intro&freeze&mask&view=${VIEW}${extra}`);
  const canvas = page.locator('.spike canvas');
  await canvas.waitFor();
  await page.waitForTimeout(2500);
  const png = await canvas.screenshot();
  await page.close();
  return png;
}

test('a silhouette capture has no aura, glow light or grade in it: it is pure grey', async ({ browser }) => {
  const png = await silhouette(browser, '');
  const page = await browser.newPage();
  const grey = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let white = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] !== d[i + 1] || d[i] !== d[i + 2]) return -1;
      if (d[i] > 200) white++;
    }
    return white;
  }, png.toString('base64'));
  await page.close();
  expect(grey, 'every pixel grey (no tint)').toBeGreaterThanOrEqual(0);
  expect(grey, 'Nox is in the capture').toBeGreaterThan(100);
});

// Review Focus 5: the stage must stay usable when the world's files do not load.
test('stage stays usable when world assets fail', async ({ page }) => {
  await page.route('**/nox/world/**', route => route.abort());
  await page.goto('/');
  await expect(page.locator('.spike canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip intro' })).toBeVisible();
  // On a busy machine the entrance can end by itself first (and the button goes): the heading comes either way.
  await page.getByRole('button', { name: 'Skip intro' }).click({ timeout: 3_000 }).catch(() => {});
  await expect(page.getByRole('heading', { level: 1, name: 'Security Lab' })).toBeVisible();
  await page.goto('/?stage=overview');
  await expect(page.locator('.spike canvas')).toBeVisible();
  await expect(page.locator('.orb-button').first()).toBeVisible();
  expect(await page.locator('.orb-button').count()).toBeGreaterThan(0);
});

test('stage stays usable when only near.glb fails: kit.glb lights the world', async ({ page }) => {
  test.setTimeout(120_000);
  await page.route('**/nox/world/security/near.glb', route => route.abort());
  await page.goto('/?stage=overview');
  await expect(page.locator('.spike canvas')).toBeVisible();
  await expect(page.locator('.orb-button').first()).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { __noxReady?: boolean }).__noxReady === true, undefined, { timeout: 60_000 });
});
