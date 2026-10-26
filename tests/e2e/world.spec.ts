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

test('a silhouette capture is the same with the world switched on: no aura, glow light or grade in it', async ({ browser }) => {
  const plain = await silhouette(browser, '');
  const world = await silhouette(browser, '&world');
  expect(world.equals(plain)).toBe(true);
});
