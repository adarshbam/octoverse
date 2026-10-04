import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { collectTestProvenance } from './helpers/geometry-extractor.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../');
const OUTPUT_DIR = path.join(REPO_ROOT, 'test-output/visual');

test.describe('Nox Responsive Viewport Verification (390x844 Phone)', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  });

  test('verifies centered fixed-proportion layout without overflow at 390x844', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });

    expect(consoleErrors, 'Console errors encountered on mobile viewport').toEqual([]);

    const scene = page.locator('svg[data-scene="nox-introduction"]');
    await expect(scene).toBeVisible();

    const box = await scene.boundingBox();
    expect(box, 'Scene bounding box not found').not.toBeNull();

    if (box) {
      // Width should fill 390px
      expect(Math.round(box.width)).toBe(390);

      // Height should follow 507:505 aspect ratio: 390 * 505 / 507 ≈ 388.46px
      const expectedHeight = (390 * 505) / 507;
      expect(Math.abs(box.height - expectedHeight)).toBeLessThan(1.5);

      // Vertically centered within 844px height container: (844 - 388.46) / 2 ≈ 227.77px
      const expectedY = (844 - box.height) / 2;
      expect(Math.abs(box.y - expectedY)).toBeLessThan(2.0);
    }

    // Verify zero horizontal page overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow, 'Document has horizontal overflow').toBe(false);

    // Capture fresh responsive screenshot into ignored test-output/
    const screenshotPath = path.join(OUTPUT_DIR, 'narrow-390x844.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Record verified provenance
    const provenance = {
      ...collectTestProvenance(page, REPO_ROOT, 'nox-responsive'),
      hasHorizontalOverflow,
      renderedBox: box,
    };
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'responsive-provenance.json'),
      JSON.stringify(provenance, null, 2) + '\n'
    );
  });
});
