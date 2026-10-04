import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { collectTestProvenance } from './helpers/geometry-extractor.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../');
const OUTPUT_DIR = path.join(REPO_ROOT, 'test-output/visual');

test.describe('Nox Multi-Instance Collision Verification', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  });

  test('verifies two instances on same page have zero duplicate IDs, isolated references, and isolated ARIA ownership', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.setViewportSize({ width: 1040, height: 600 });
    await page.goto('/?fixture=two-instance', { waitUntil: 'networkidle' });

    expect(consoleErrors, 'Console errors encountered on two-instance fixture').toEqual([]);

    const inst1 = page.locator('[data-instance="instance-1"] svg[data-scene="nox-introduction"]');
    const inst2 = page.locator('[data-instance="instance-2"] svg[data-scene="nox-introduction"]');

    await expect(inst1).toBeVisible();
    await expect(inst2).toBeVisible();

    // 1. Both instances have exactly 8 tentacles
    const inst1Arms = await inst1.locator('[data-tentacle]').count();
    const inst2Arms = await inst2.locator('[data-tentacle]').count();
    expect(inst1Arms).toBe(8);
    expect(inst2Arms).toBe(8);

    // 2. Global check: Zero duplicate IDs on the entire page
    const duplicateIds = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('[id]'));
      const idCount: Record<string, number> = {};
      const dups: string[] = [];
      for (const el of allElements) {
        idCount[el.id] = (idCount[el.id] || 0) + 1;
        if (idCount[el.id] === 2) dups.push(el.id);
      }
      return dups;
    });
    expect(duplicateIds, 'Duplicate IDs detected between instances').toEqual([]);

    // 3. Strict local reference isolation:
    // Checks fill, stroke, filter, clip-path, clipPath, and mask for url(#id)
    // Checks aria-labelledby, aria-describedby, aria-controls, aria-owns for IDREF ownership
    // Inspects all elements including each SVG root itself
    const isolationLeaks = await page.evaluate(() => {
      const leaks: string[] = [];
      const instances = ['instance-1', 'instance-2'];
      const urlRegex = /url\(#([^)]+)\)/g;
      const urlAttrs = ['fill', 'stroke', 'filter', 'clip-path', 'clipPath', 'mask'];
      const ariaIdrefAttrs = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns'];

      for (const instName of instances) {
        const root = document.querySelector(`[data-instance="${instName}"]`);
        if (!root) {
          leaks.push(`Missing instance container: ${instName}`);
          continue;
        }

        // Include the container, the SVG root, and all descendants
        const allElements = [root, ...Array.from(root.querySelectorAll('*'))];

        for (const el of allElements) {
          // Check URL references in geometric/visual attributes
          for (const attr of urlAttrs) {
            const val = el.getAttribute(attr);
            if (!val) continue;
            let match: RegExpExecArray | null;
            urlRegex.lastIndex = 0;
            while ((match = urlRegex.exec(val)) !== null) {
              const targetId = match[1];
              // Must target an element with the matching instance prefix
              if (!targetId.startsWith(`${instName}-`)) {
                leaks.push(
                  `${instName} leaked URL reference to foreign target #${targetId} via ${el.tagName}[${attr}="${val}"]`
                );
              }
              // Must resolve to an element within the same instance container
              const targetEl = root.querySelector(`#${CSS.escape(targetId)}`);
              if (!targetEl) {
                leaks.push(
                  `${instName} URL reference #${targetId} not found within its own container`
                );
              }
            }
          }

          // Check ARIA IDREF ownership (e.g. aria-labelledby="instance-1-title instance-1-description")
          for (const ariaAttr of ariaIdrefAttrs) {
            const val = el.getAttribute(ariaAttr);
            if (!val) continue;
            const idrefs = val.trim().split(/\s+/).filter(Boolean);
            for (const idref of idrefs) {
              if (!idref.startsWith(`${instName}-`)) {
                leaks.push(
                  `${instName} leaked ARIA IDREF to foreign target #${idref} via ${el.tagName}[${ariaAttr}="${val}"]`
                );
              }
              const targetEl = root.querySelector(`#${CSS.escape(idref)}`);
              if (!targetEl) {
                leaks.push(
                  `${instName} ARIA target #${idref} referenced by ${el.tagName}[${ariaAttr}] not found within container`
                );
              }
            }
          }
        }
      }
      return leaks;
    });
    expect(isolationLeaks, 'Cross-instance reference or ARIA leakage detected').toEqual([]);

    // 4. Capture screenshot of the two-instance fixture into ignored test-output/
    const screenshotPath = path.join(OUTPUT_DIR, 'two-instance-fixture.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // 5. Record verified provenance for multi-instance run
    const provenance = {
      ...collectTestProvenance(page, REPO_ROOT, 'nox-multi-instance'),
      instancesVerified: ['instance-1', 'instance-2'],
      duplicateIdsCount: duplicateIds.length,
      isolationLeaksCount: isolationLeaks.length,
    };
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'multi-instance-provenance.json'),
      JSON.stringify(provenance, null, 2) + '\n'
    );
  });
});
