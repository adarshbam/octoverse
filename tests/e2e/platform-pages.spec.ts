import { expect, test, type Page } from '@playwright/test';
import { overflowingElements, scrollToBottom } from './pageChecks';

// The platform's static pages (platform Task 9; spec 2.5, 7.8, 7.11, 7.12): the profile, Explore and the not-found page, through the
// temporary `?page=` switch of src/platform/App.tsx (Task 14 routes them). Every page, at 360, 390, 768, 1024 and 1536 px wide:
// the page never scrolls sideways, and every link, button and tab is at least 44 px square. Plus the profile's tabs by keyboard.
// These pages draw stills only (no WebGL), so they are quick; run with --workers=1 (four sessions share one GPU).

const WIDTHS = [360, 390, 768, 1024, 1536] as const;
const PAGES = [
  { name: 'profile veyra', query: 'page=profile&handle=veyra' },
  { name: 'profile flux', query: 'page=profile&handle=flux' },
  { name: 'profile nox', query: 'page=profile&handle=nox' },
  { name: 'profile aether', query: 'page=profile&handle=aether' },
  { name: 'explore', query: 'page=explore' },
  { name: 'not found', query: 'page=notfound' },
  { name: 'unknown handle', query: 'page=profile&handle=nobody' },
];

async function open(page: Page, query: string, width: number) {
  await page.setViewportSize({ width, height: width < 768 ? 800 : 1024 });
  await page.goto(`/?${query}`);
  await page.waitForSelector('#oct-main');
  await page.evaluate(() => Promise.all([...document.images].map(i => (i.complete ? null : new Promise(done => { i.onload = i.onerror = done; })))));
}

for (const p of PAGES) {
  for (const width of WIDTHS) {
    test(`${p.name} at ${width}: no horizontal scroll, targets at least 44 px`, async ({ page }) => {
      await open(page, p.query, width);
      const measured = await page.evaluate(() => {
        const small: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>('a, button, [role="tab"]')) {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (style.visibility === 'hidden' || style.display === 'none' || r.width === 0 || r.height === 0 || el.closest('[hidden]')) continue;
          if (r.bottom <= 0) continue; // the skip link waits above the page until it has focus
          if (r.width < 44 || r.height < 44) small.push(`${el.tagName.toLowerCase()}[${(el.textContent ?? '').trim().slice(0, 24)}] ${Math.round(r.width)} x ${Math.round(r.height)}`);
        }
        const root = document.documentElement;
        return { small, scrollWidth: Math.max(root.scrollWidth, document.querySelector('.oct-page')!.scrollWidth), bodyScrollWidth: document.body.scrollWidth, innerWidth: window.innerWidth };
      });
      expect(measured.scrollWidth).toBeLessThanOrEqual(measured.innerWidth);
      expect(measured.bodyScrollWidth).toBeLessThanOrEqual(measured.innerWidth);
      expect(measured.small).toEqual([]);
      // The page wrapper hides sideways overflow, so scrollWidth cannot show cut-off content: every element must fit the window.
      expect(await overflowingElements(page)).toEqual([]);
    });
  }
}

// index.html fixes html, body and #root at the window's height with overflow hidden: a page taller than the window scrolls inside
// `.oct-page`. At 390 x 844 every page's content can be scrolled to its bottom, and the footer or last element is then on screen.
for (const p of PAGES) {
  test(`${p.name} scrolls at 390 x 844: its content can be scrolled to the bottom`, async ({ page }) => {
    await open(page, p.query, 390);
    await page.setViewportSize({ width: 390, height: 844 });
    const result = await scrollToBottom(page);
    if (p.name.startsWith('profile') || p.name === 'explore') {
      expect(result.tall).toBe(true);
      expect(result.after).toBeGreaterThan(result.before + 100);
    }
    expect(result.lastVisible).toBe(true);
    expect(result.windowScrollY).toBe(0);
  });
}

test('the nav stays at the top while the page scrolls, and the skip link still jumps to the main landmark', async ({ page }) => {
  await open(page, 'page=explore', 390);
  await page.evaluate(() => document.querySelector('.oct-page')!.scrollTo(0, 600));
  const nav = await page.locator('.oct-nav').boundingBox();
  expect(nav!.y).toBeLessThan(20);
  await page.evaluate(() => document.querySelector('.oct-page')!.scrollTo(0, 0));
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('#oct-main')).toBeFocused();
});

test('the profile tabs work by keyboard: arrows move and select, Home and End jump, only the selected panel shows', async ({ page }) => {
  await open(page, 'page=profile&handle=veyra', 1536);
  const tab = (name: string) => page.getByRole('tab', { name });
  await tab('Projects (1)').focus();
  await expect(tab('Projects (1)')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(tab('About')).toBeFocused();
  await expect(tab('About')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'About' })).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: 'Projects (1)' })).toBeHidden();
  await page.keyboard.press('End');
  await expect(tab('Tech Stack')).toBeFocused();
  await expect(page.getByRole('tabpanel', { name: 'Tech Stack' })).toBeVisible();
  await expect(page.locator('[data-tech]')).toHaveCount(12);
  await page.keyboard.press('ArrowRight');
  await expect(tab('Projects (1)')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(tab('Tech Stack')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(tab('Projects (1)')).toBeFocused();
  // One tab stop in the list: Tab leaves it for the selected panel (the ARIA pattern), not the next tab.
  await page.keyboard.press('Tab');
  await expect(tab('About')).not.toBeFocused();
  await expect(page.getByRole('tabpanel', { name: 'Projects (1)' })).toBeFocused();
});

test('every tile and the primary action are reachable by keyboard, in reading order', async ({ page }) => {
  await open(page, 'page=explore', 1536);
  const hrefs: string[] = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const href = await page.evaluate(() => (document.activeElement as HTMLAnchorElement | null)?.getAttribute('href') ?? '');
    hrefs.push(href);
  }
  // The skip link, then the nav (the wordmark, Explore, Create), then the five tiles.
  expect(hrefs.slice(0, 9)).toEqual(['#oct-main', '/', '/explore', '/create', '/@veyra', '/@flux', '/@nox', '/@aether', '/create']);
  await open(page, 'page=profile&handle=flux', 1536);
  await expect(page.getByRole('link', { name: "Enter Flux's world" })).toHaveAttribute('href', '/@flux/github-pipeline-engine');
});
