import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

// Task 27: the phone, in the world. The tray holds every technology, the panels are bottom sheets,
// the world draws lightly, and the page keeps the technology in focus through a resize.
const PHONE = { width: 390, height: 844 };
const TRAY = '.orb-tray-item';

async function trayOpen(page: Page) {
  await expect(page.locator('.orb-tray.is-open')).toBeVisible();
  // The tray fades in after the dome forms.
  await expect.poll(() => page.locator('.orb-tray').evaluate(el => getComputedStyle(el).opacity), { timeout: 30_000 }).toBe('1');
}

test.describe('phone', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });
  test.setTimeout(120_000);

  test('phone overview shows a tray of 15 orb buttons at least 44 px', async ({ page }) => {
    await page.goto('/?stage=overview&freeze');
    await trayOpen(page);
    const buttons = page.locator(TRAY);
    await expect(buttons).toHaveCount(15);
    // One round trip: the page is busy drawing the world.
    const boxes = await buttons.evaluateAll(els => els.map(el => el.getBoundingClientRect().toJSON() as { x: number; y: number; width: number; height: number }));
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(48);
      expect(box.height).toBeGreaterThanOrEqual(48);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width);
      expect(box.y + box.height).toBeLessThanOrEqual(PHONE.height);
    }
    // The overview is a sheet along the bottom with its own close button.
    const sheet = page.getByRole('region', { name: 'Security Lab overview' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Close overview' })).toBeVisible();
    const sheetBox = (await sheet.boundingBox())!;
    expect(Math.round(sheetBox.x)).toBe(0);
    expect(Math.round(sheetBox.width)).toBe(PHONE.width);
    expect(Math.round(sheetBox.y + sheetBox.height)).toBe(PHONE.height);
    // The tray clears the sheet.
    expect(Math.max(...boxes.map(box => box.y + box.height))).toBeLessThanOrEqual(sheetBox.y);
    // The world draws at its lowest: no fish, no motes.
    const world = await page.evaluate(() => (window as unknown as { __noxWorldTier?: { fish: boolean; motes: boolean } }).__noxWorldTier);
    expect(world).toMatchObject({ fish: false, motes: false });
    // The sheet's close button goes back to the intro.
    await sheet.getByRole('button', { name: 'Close overview' }).tap();
    await expect(sheet).toBeHidden();
  });

  test('touch tap opens a tooltip and a second tap closes it', async ({ page }) => {
    await page.goto('/?stage=overview&freeze');
    await trayOpen(page);
    for (const name of ['Kali Linux', 'Docker']) {
      const item = page.locator(`${TRAY}[aria-label="${name}"]`);
      await item.tap();
      const tip = page.getByRole('tooltip');
      await expect(tip).toBeVisible();
      await expect(tip).toContainText(name);
      // The tooltip's id is unique to its instance (useId), so the button names whatever id the tooltip has.
      await expect(item).toHaveAttribute('aria-describedby', (await tip.getAttribute('id'))!);
      // The tooltip does not cover the buttons (the tray drops as the sheet leaves): the same one can be tapped again.
      await expect
        .poll(async () => {
          const tipBox = await tip.boundingBox();
          const itemBox = await item.boundingBox();
          return Boolean(tipBox && itemBox && (tipBox.y >= itemBox.y + itemBox.height || tipBox.y + tipBox.height <= itemBox.y));
        })
        .toBe(true);
      await item.tap();
      await expect(tip).toBeHidden();
    }
  });
});

test('resize from desktop to phone keeps the focused technology', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?stage=techFocus&tech=kali&freeze');
  // The tooltip waits for the bubbles' first frame, which comes after the world's kit on a loaded machine.
  await expect(page.getByRole('tooltip')).toContainText('Used for penetration testing', { timeout: 30_000 });
  await page.setViewportSize(PHONE);
  await expect(page.getByRole('tooltip')).toContainText('Used for penetration testing');
  const item = page.locator(`${TRAY}[aria-label="Kali Linux"]`);
  await expect(item).toHaveCount(1);
  await expect(item).toHaveAttribute('aria-describedby', (await page.getByRole('tooltip').getAttribute('id'))!);
  await expect(page.locator(TRAY)).toHaveCount(15);
  // The tooltip is inside the window.
  const box = (await page.getByRole('tooltip').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(PHONE.height);
});

test('the skip link is the first focusable element and goes to the project details', async ({ page }) => {
  await page.goto('/?stage=intro&freeze');
  await page.keyboard.press('Tab');
  const link = page.getByRole('link', { name: 'Skip to project details' });
  await expect(link).toBeFocused();
  await expect(link).toBeVisible();
  await page.keyboard.press('Enter');
  const view = page.getByRole('region', { name: 'Security Lab full project view' });
  await expect(view).toBeVisible();
  await expect(view.getByRole('heading', { level: 1, name: 'Security Lab' })).toBeFocused();
});

// Review Focus 2: with the camera at full hover, no edge of the window shows the clear colour.
const CLEAR = [0x07, 0x15, 0x35];
for (const size of [{ width: 2560, height: 1080 }, PHONE]) {
  test(`wide and tall windows show no void at full hover (${size.width}x${size.height})`, async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    await page.goto('/?stage=intro&freeze&hover=0.9,0.3,1.2');
    await page.waitForFunction(() => (window as unknown as { __noxReady?: boolean }).__noxReady === true, undefined, { timeout: 90_000 });
    await page.waitForTimeout(500);
    const png = await page.screenshot();
    await page.close();
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => [0, 1, 2].map(c => data[(y * info.width + x) * info.channels + c]);
    const isClear = (p: number[]) => p.every((v, c) => Math.abs(v - CLEAR[c]) <= 2);
    // A band 2 px in along each edge; a void is a run of clear colour, not a stray pixel.
    const edges: Record<string, number[][]> = { top: [], bottom: [], left: [], right: [] };
    for (let x = 0; x < info.width; x += 4) {
      edges.top.push(at(x, 2));
      edges.bottom.push(at(x, info.height - 3));
    }
    for (let y = 0; y < info.height; y += 4) {
      edges.left.push(at(2, y));
      edges.right.push(at(info.width - 3, y));
    }
    for (const [edge, pixels] of Object.entries(edges)) {
      const share = pixels.filter(isClear).length / pixels.length;
      expect(share, `${edge} edge shows the clear colour`).toBeLessThan(0.05);
    }
  });
}
