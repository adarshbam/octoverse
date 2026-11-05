import { expect, test } from '@playwright/test';
import { ARM_IDS } from '../../src/engine/config/types';
import { AETHER_POSES } from '../../src/worlds/aether/poses';

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

type Probe = { ready?: boolean; attention?: { tips: { x: number; y: number }[] }; camera?: { position: number[]; fov: number; offsetY: number }; hold?: { techId: string; pull: number }[] };

// Task 13 fix round 2: which arm holds the chosen orb on the real page (the engine's own hold path).
// A frozen tech focus with OpenAI (it hangs from T1@0.9, her left) should hold it on T1; measured
// as the drawn arm tip (`__octoverse.attention.tips`, the arms' space, placed by the overview's body
// and seen through the reported stage camera) nearest the OpenAI orb button's centre. The camera's
// small pitch is left out; the margin is wide (2026-11-05: T4's tip 49 px from the orb, the next 221).
// KNOWN ENGINE BUG, expected to fail until the engine follow-up "The suction hold picks its arm
// before the orbit point is written" (MORNING-REVIEW-aether.md) lands: today T4 holds OpenAI, beside
// her left eye. When the engine is fixed this test passes, Playwright reports the expected failure as
// unexpected, and the `test.fail` line comes out.
test('Aether tech focus, frozen: OpenAI is held near T1, the arm it hangs from [engine follow-up: the suction hold picks its arm before the orbit point is written]', async ({ page }) => {
  test.fail(true, 'Engine follow-up: the suction hold picks its arm before the orbit point is written (T4 holds OpenAI today).');
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/?world=aether&stage=techFocus&tech=openai&freeze');
  await page.waitForFunction(() => (window as unknown as { __octoverse?: Probe }).__octoverse?.ready === true, undefined, { timeout: 60_000 });
  const orb = page.locator('.orb-button[aria-label="OpenAI"]');
  await expect(orb).toHaveCount(1, { timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => ((window as unknown as { __octoverse?: Probe }).__octoverse?.hold ?? []).map(h => `${h.techId} ${h.pull}`)), { timeout: 30_000 }).toEqual(['openai 1']);
  await page.waitForTimeout(500);
  const probe = await page.evaluate(() => { const o = (window as unknown as { __octoverse: Probe }).__octoverse; return { tips: o.attention!.tips, camera: o.camera! }; });
  const box = (await orb.boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const { body } = AETHER_POSES.overview;
  const [cx, cy, cz] = probe.camera.position;
  const k = 1024 / (2 * Math.tan((probe.camera.fov * Math.PI) / 360) * cz);
  const screen = probe.tips.map(t => ({ x: 768 + (body.x + body.scale * t.x - cx) * k, y: 512 - (body.y + body.scale * t.y - cy) * k - probe.camera.offsetY }));
  const distance = screen.map(s => Math.hypot(s.x - at.x, s.y - at.y));
  const nearest = distance.indexOf(Math.min(...distance));
  test.info().annotations.push({ type: 'hold', description: JSON.stringify({ orb: [Math.round(at.x), Math.round(at.y)], tipDistances: distance.map(Math.round), nearest: ARM_IDS[nearest] }) });
  expect(ARM_IDS[nearest]).toBe('T1');
});

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
