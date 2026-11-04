import { expect, test, type Page } from '@playwright/test';
import { overflowingElements } from './pageChecks';

// The creator composition (platform Task 10; spec 7.13, 7.15), through the temporary `?page=create` switch of src/platform/App.tsx
// (Task 14 routes it). At 390 x 844 the two panels are the tabs Octopus and Projects and the picture is the sticky top 40%; at
// 768 x 1024 and 1536 x 1024 both panels show. At 360, 390, 768, 1024 and 1536 px wide the page never scrolls sideways and every
// control is at least 44 px square. Stills only (no WebGL); run with --workers=1 (four sessions share one GPU).

const WIDTHS = [360, 390, 768, 1024, 1536] as const;
const heightFor = (width: number) => (width === 390 ? 844 : width < 768 ? 800 : 1024);

async function open(page: Page, width: number, height = heightFor(width)) {
  await page.setViewportSize({ width, height });
  await page.goto('/?page=create');
  await page.waitForSelector('#oct-main');
  await page.waitForSelector('[data-slot="preview"]');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map(i => (i.complete ? null : new Promise(done => { i.onload = i.onerror = done; })))));
}

for (const width of WIDTHS) {
  test(`creator at ${width}: no horizontal scroll, controls at least 44 px`, async ({ page }) => {
    await open(page, width);
    const measured = await page.evaluate(() => {
      const small: string[] = [];
      // On a phone the Projects panel is behind its tab, so it is measured after the tab is opened (below).
      for (const el of document.querySelectorAll<HTMLElement>('a, button, summary, input, textarea, [role="tab"]')) {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none' || r.width === 0 || r.height === 0 || el.closest('[hidden]')) continue;
        if (r.bottom <= 0) continue; // the skip link waits above the page until it has focus
        if (r.width < 44 || r.height < 44) small.push(`${el.tagName.toLowerCase()}[${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}] ${Math.round(r.width)} x ${Math.round(r.height)}`);
      }
      const root = document.documentElement;
      const scroller = document.querySelector('.oct-page')!;
      return { small, scrollWidth: Math.max(root.scrollWidth, scroller.scrollWidth), bodyScrollWidth: document.body.scrollWidth, innerWidth: window.innerWidth };
    });
    expect(measured.scrollWidth).toBeLessThanOrEqual(measured.innerWidth);
    expect(measured.bodyScrollWidth).toBeLessThanOrEqual(measured.innerWidth);
    expect(measured.small).toEqual([]);
    expect(await overflowingElements(page)).toEqual([]);
    if (width < 768) {
      await page.getByRole('tab', { name: 'Projects' }).click();
      const projects = await page.evaluate(() => {
        const small: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>('[role="tabpanel"]:not([hidden]) :is(a, button, summary, input, textarea)')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.width < 44 || r.height < 44) small.push(`${el.tagName.toLowerCase()}[${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}] ${Math.round(r.width)} x ${Math.round(r.height)}`);
        }
        return { small, scrollWidth: Math.max(document.documentElement.scrollWidth, document.querySelector('.oct-page')!.scrollWidth), innerWidth: window.innerWidth };
      });
      expect(projects.scrollWidth).toBeLessThanOrEqual(projects.innerWidth);
      expect(projects.small).toEqual([]);
    }
    // The profile fields are inside a closed section; open it and look again.
    await page.locator('summary', { hasText: 'Profile' }).click();
    const opened = await page.evaluate(() => ({ scrollWidth: Math.max(document.documentElement.scrollWidth, document.querySelector('.oct-page')!.scrollWidth), innerWidth: window.innerWidth, small: [...document.querySelectorAll<HTMLElement>('.oct-profile-fields input, .oct-profile-fields textarea')].filter(el => el.getBoundingClientRect().height < 44).length }));
    expect(opened.scrollWidth).toBeLessThanOrEqual(opened.innerWidth);
    expect(opened.small).toBe(0);
  });
}

test('on a phone the panels are the tabs Octopus and Projects and the picture is the sticky top 40%', async ({ page }) => {
  await open(page, 390, 844);
  await expect(page.getByRole('tablist')).toBeVisible();
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveText(['Octopus', 'Projects']);
  await expect(page.getByRole('tabpanel', { name: 'Octopus' })).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: 'Projects' })).toBeHidden();
  const preview = page.locator('[data-slot="preview"]');
  const before = await preview.boundingBox();
  expect(before!.y).toBeCloseTo(0, 0);
  expect(before!.height).toBeGreaterThan(844 * 0.4 - 2);
  expect(before!.height).toBeLessThan(844 * 0.4 + 2);
  // The picture sits inside the slot, below the navigation bar.
  const picture = await page.locator('.oct-creator-picture').boundingBox();
  expect(picture!.y).toBeGreaterThanOrEqual(60);
  expect(picture!.y + picture!.height).toBeLessThanOrEqual(before!.height);
  // Sticky: after scrolling the page, the slot is still at the top.
  await page.getByRole('tab', { name: 'Projects' }).click();
  // The page scrolls inside itself (index.html fixes html, body and #root at the window's height).
  await page.evaluate(() => document.querySelector('.oct-page')!.scrollTo(0, 400));
  const scrolled = await page.evaluate(() => document.querySelector('.oct-page')!.scrollTop);
  expect(scrolled).toBeGreaterThan(100);
  const after = await preview.boundingBox();
  expect(after!.y).toBeCloseTo(0, 0);
  expect(after!.height).toBeCloseTo(before!.height, 0);
});

test('the phone tabs work by keyboard, one tab stop, the panel follows', async ({ page }) => {
  await open(page, 390, 844);
  const tab = (name: string) => page.getByRole('tab', { name });
  await tab('Octopus').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab('Projects')).toBeFocused();
  await expect(tab('Projects')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'Projects' })).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: 'Octopus' })).toBeHidden();
  await page.keyboard.press('Home');
  await expect(tab('Octopus')).toBeFocused();
  await page.keyboard.press('End');
  await expect(tab('Projects')).toBeFocused();
});

for (const [width, height] of [[1536, 1024], [768, 1024]] as const) {
  test(`at ${width} x ${height} both panels, the picture and the actions are visible and there are no tabs`, async ({ page }) => {
    await open(page, width, height);
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your Octopus', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your Projects', exact: true })).toBeVisible();
    await expect(page.locator('[data-slot="preview"]')).toBeVisible();
    await expect(page.getByRole('link', { name: /See live preview/ })).toBeVisible();
    const publish = page.getByRole('button', { name: 'Publishing arrives with accounts' });
    await expect(publish).toBeVisible();
    await expect(publish).toBeDisabled();
    // The two panels do not overlap, and the picture is between or above them.
    const left = (await page.locator('.oct-octopus-panel').boundingBox())!;
    const right = (await page.locator('.oct-projects-panel').boundingBox())!;
    const centre = (await page.locator('[data-slot="preview"]').boundingBox())!;
    expect(left.x + left.width).toBeLessThanOrEqual(right.x);
    if (width === 1536) {
      expect(left.x + left.width).toBeLessThanOrEqual(centre.x);
      expect(centre.x + centre.width).toBeLessThanOrEqual(right.x);
    } else {
      expect(centre.y + centre.height).toBeLessThanOrEqual(left.y + 1);
    }
  });
}

test('the presets work: a template, a swatch and a personality press and Name edits the caption; nothing is a colour picker', async ({ page }) => {
  await open(page, 1536, 1024);
  await expect(page.locator('input[type=color], input[type=range], input[type=file], select')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Peach' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Teal' }).click();
  await expect(page.getByRole('button', { name: 'Teal' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Peach' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Calm' }).click();
  await expect(page.getByRole('button', { name: 'Calm' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-template="nox"]').click();
  await expect(page.locator('.oct-creator-caption span')).toHaveText('Nox · Teal · Calm');
  await page.getByLabel('Name', { exact: true }).fill('Kelp');
  await expect(page.locator('.oct-creator-caption b')).toHaveText('Kelp');
  // Add a project (+): the new, untitled one is selected.
  await page.getByRole('button', { name: 'Add project' }).click();
  await expect(page.getByLabel('Title')).toHaveValue('');
  await expect(page.locator('.oct-project-row')).toHaveCount(2);
});

test('every control is reachable by keyboard in reading order, with the lavender focus ring', async ({ page }) => {
  await open(page, 1536, 1024);
  const seen: string[] = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return '';
      return el.getAttribute('data-template') ?? el.getAttribute('data-palette') ?? el.getAttribute('data-personality') ?? el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 30);
    });
    seen.push(label);
  }
  const first = (name: string) => seen.indexOf(name);
  // Templates, then swatches, then personality, then the name, then the projects, then See live preview.
  expect([first('veyra'), first('original'), first('calm'), first('Add project'), first('See live preview →')].every(i => i >= 0)).toBe(true);
  const order = [first('veyra'), first('original'), first('calm'), first('Add project'), first('See live preview →')];
  expect(order).toEqual([...order].sort((a, b) => a - b));
  // Publish is disabled: never in the focus order.
  expect(seen).not.toContain('Publishing arrives with accounts');
  await page.locator('[data-palette="teal"]').focus();
  const ring = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as HTMLElement);
    return { width: style.outlineWidth, color: style.outlineColor, style: style.outlineStyle };
  });
  expect(ring.style).toBe('solid');
  expect(ring.width).toBe('3px');
  expect(ring.color).toBe('rgb(216, 200, 255)');
});
