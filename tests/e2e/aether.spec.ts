import { expect, test } from '@playwright/test';
import { ARM_IDS } from '../../src/engine/config/types';
import { AETHER } from '../../src/worlds/aether/character';
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

type Lift = { techId: string; arm: string; releasing: boolean; tip: number };
type Probe = { ready?: boolean; attention?: { tips: { x: number; y: number }[] }; camera?: { position: number[]; quaternion: number[]; fov: number; offsetY: number }; hold?: { techId: string; pull: number }[]; lift?: Lift[] };
const lifts = (page: import('@playwright/test').Page) => page.evaluate(() => ((window as unknown as { __octoverse?: Probe }).__octoverse?.lift ?? []).map(l => `${l.techId} ${l.arm} ${l.releasing ? 'down' : l.tip >= 0.999 ? 'up' : 'rising'}`));

// Task 13 fix round 2, Task 19: which arm holds the chosen orb on the real page. A frozen tech focus
// with OpenAI (it hangs from T1@0.9, her left) holds it on T1; measured as the drawn arm tip
// (`__octoverse.attention.tips`, the arms' space, placed by the overview's body and seen through the
// reported stage camera) nearest the OpenAI orb button's centre. The camera's small pitch is left
// out. Until Task 19 this was an expected failure (the suction hold picked T4, its arm chosen before
// the orbit point was written); the arm lift lifts the arm the orb hangs from, so it passes.
test('Aether tech focus, frozen: OpenAI is lifted by T1, the arm it hangs from, and held near its tip', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/?world=aether&stage=techFocus&tech=openai&freeze');
  await page.waitForFunction(() => (window as unknown as { __octoverse?: Probe }).__octoverse?.ready === true, undefined, { timeout: 60_000 });
  const orb = page.locator('.orb-button[aria-label="OpenAI"]');
  await expect(orb).toHaveCount(1, { timeout: 30_000 });
  await expect.poll(() => lifts(page), { timeout: 30_000 }).toEqual(['openai T1 up']);
  // Nothing is held by the suction hold: the arm lift replaces it.
  expect(await page.evaluate(() => (window as unknown as { __octoverse?: Probe }).__octoverse?.hold ?? [])).toEqual([]);
  await page.waitForTimeout(500);
  const probe = await page.evaluate(() => { const o = (window as unknown as { __octoverse: Probe }).__octoverse; return { tips: o.attention!.tips, camera: o.camera! }; });
  const box = (await orb.boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const { body } = AETHER_POSES.overview;
  const [cx, cy, cz] = probe.camera.position;
  // The camera's small pitch (its quaternion about x) is applied: left out, it puts every point about 100 px too high, and the
  // curled T1 tip (over the top of the orb, P4) then reads farther from the orb than T2's.
  const pitch = 2 * Math.atan2(probe.camera.quaternion[0], probe.camera.quaternion[3]);
  const f = 1024 / (2 * Math.tan((probe.camera.fov * Math.PI) / 360));
  const screen = probe.tips.map(t => {
    const x = body.x + body.scale * t.x - cx;
    const y = body.y + body.scale * t.y - cy;
    const z = -cz;
    const yc = y * Math.cos(pitch) + z * Math.sin(pitch);
    const zc = -y * Math.sin(pitch) + z * Math.cos(pitch);
    return { x: 768 + (x / -zc) * f, y: 512 - (yc / -zc) * f - probe.camera.offsetY };
  });
  const distance = screen.map(s => Math.hypot(s.x - at.x, s.y - at.y));
  const nearest = distance.indexOf(Math.min(...distance));
  test.info().annotations.push({ type: 'hold', description: JSON.stringify({ orb: [Math.round(at.x), Math.round(at.y)], tipDistances: distance.map(Math.round), nearest: ARM_IDS[nearest] }) });
  expect(ARM_IDS[nearest]).toBe('T1');
  // The tip curls over the top of the orb (P4): it ends above the orb's centre, within an orb's width of it.
  expect(screen[0].y).toBeLessThan(at.y);
  expect(distance[0]).toBeLessThan(box.width);
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

  // Spec 7.5: on a phone the tray stays, and choosing from it plays the same lift (with motion: it rises, then is up).
  test('choosing OpenAI from the tray plays the lift on T1 and shows its usage notes', async ({ page }) => {
    await page.goto('/?world=aether&stage=overview');
    await expect(page.locator('.orb-tray.is-open')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('.orb-tray-item')).toHaveCount(10);
    await page.locator('.orb-tray-item[aria-label="OpenAI"]').click();
    await expect(page.getByRole('tooltip')).toContainText('Function calling', { timeout: 30_000 });
    await expect.poll(() => lifts(page), { timeout: 30_000 }).toEqual(['openai T1 up']);
  });
});

// Task 19 (spec 7.5, "Choosing an orb"): her technologies become choosable in the overview, each
// lifted by the arm it hangs from. The intro still offers none: clicking her head opens the overview.
test('Aether intro, frozen: clicking her head opens the overview, whose orbs are buttons', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/?world=aether&stage=intro&freeze');
  await page.waitForFunction(() => (window as unknown as { __octoverse?: Probe }).__octoverse?.ready === true, undefined, { timeout: 60_000 });
  await expect(page.locator('.orb-button')).toHaveCount(0);
  const camera = await page.evaluate(() => (window as unknown as { __octoverse: Probe }).__octoverse.camera!);
  const { body } = AETHER_POSES.intro;
  const [cx, cy, cz] = camera.position;
  const pitch = 2 * Math.atan2(camera.quaternion[0], camera.quaternion[3]);
  const f = 1024 / (2 * Math.tan((camera.fov * Math.PI) / 360));
  // The head's middle (arms' space), seen through the stage camera (with its small pitch).
  const x = body.x + body.scale * AETHER.head.centerX - cx;
  const y = body.y + body.scale * (AETHER.head.top + AETHER.head.bottom) / 2 - cy;
  const yc = y * Math.cos(pitch) - cz * Math.sin(pitch);
  const zc = -y * Math.sin(pitch) - cz * Math.cos(pitch);
  await page.mouse.click(768 + (x / -zc) * f, 512 - (yc / -zc) * f - camera.offsetY);
  await expect(page.locator('.orb-button')).toHaveCount(10, { timeout: 30_000 });
});

const ORDER = ['OpenAI', 'Python', 'TypeScript', 'React', 'Next.js', 'PostgreSQL', 'Redis', 'Docker', 'AWS', 'Vector DB'];

test('Aether overview, keyboard: Tab reaches each orb in slot order, each lifts on its own arm with its usage notes; Escape lets go', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/?world=aether&stage=overview&freeze');
  await page.waitForFunction(() => (window as unknown as { __octoverse?: Probe }).__octoverse?.ready === true, undefined, { timeout: 60_000 });
  await expect(page.locator('.orb-button')).toHaveCount(10, { timeout: 30_000 });
  const reached: string[] = [];
  for (let i = 0; i < 40 && reached.length < ORDER.length; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => (document.activeElement?.classList.contains('orb-button') ? document.activeElement.getAttribute('aria-label') : null));
    if (label && reached[reached.length - 1] !== label) reached.push(label);
  }
  expect(reached).toEqual(ORDER);
  // Back to OpenAI: Enter shows its tooltip with P4's usage notes, and T1 lifts it; one choice at a time.
  const openai = page.locator('.orb-button[aria-label="OpenAI"]');
  await openai.focus();
  await page.keyboard.press('Enter');
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('Function calling', { timeout: 30_000 });
  await expect(tooltip).toContainText('Prompt engineering');
  await expect.poll(() => lifts(page), { timeout: 30_000 }).toEqual(['openai T1 up']);
  // Python hangs from T8: choosing it lowers OpenAI and lifts T8 (a still: at once).
  await page.locator('.orb-button[aria-label="Python"]').focus();
  await expect(tooltip).toContainText('Model experiments', { timeout: 30_000 });
  await expect.poll(() => lifts(page), { timeout: 30_000 }).toEqual(['python T8 up']);
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();
  await expect.poll(() => lifts(page), { timeout: 30_000 }).toEqual([]);
});
