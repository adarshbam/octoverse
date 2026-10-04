import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { mantleContour } from '../../src/components/nox/introductionGeometry.ts';
import {
  extractRenderedGeometry,
  verifyFrozenGeometrySource,
  collectTestProvenance,
  APPROVED_GEOMETRY_AUTHORITY_SHA256,
} from './helpers/geometry-extractor.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../');
const OUTPUT_DIR = path.join(REPO_ROOT, 'test-output/visual');
const APPROVED_GEOMETRY_PATH = path.join(
  REPO_ROOT,
  'docs/design/reviews/nox-environment/approved-geometry.json'
);

test.describe('Nox Canonical Visual & Geometry Verification', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  });

  test('verifies frozen source geometry file hash and line endings', () => {
    const check = verifyFrozenGeometrySource(REPO_ROOT);
    expect(check.hasCrlf, 'introductionGeometry.ts should use LF line endings, not CRLF').toBe(false);
    expect(
      check.hash,
      `introductionGeometry.ts SHA-256 hash changed! Expected 5018DCDCE006063FB8053A739A940FEAA33FFCDA80F62ABF5D073C5A5573438E, got ${check.hash}`
    ).toBe('5018DCDCE006063FB8053A739A940FEAA33FFCDA80F62ABF5D073C5A5573438E');
    expect(check.matchesFrozen).toBe(true);
  });

  test('renders canonical scene cleanly and validates against approved DOM baseline', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Viewport set to canonical 507x505
    await page.setViewportSize({ width: 507, height: 505 });
    await page.goto('/', { waitUntil: 'networkidle' });

    // 1. Console & Page Errors
    expect(consoleErrors, 'Browser console emitted errors').toEqual([]);
    expect(pageErrors, 'Uncaught page errors were thrown').toEqual([]);
    expect(consoleWarnings, 'Browser console emitted warnings').toEqual([]);

    // 2. Scene Root Presence
    const scene = page.locator('svg[data-scene="nox-introduction"]');
    await expect(scene).toBeVisible();

    // 3. Assert Frozen Authority Hash on approved-geometry.json
    const approvedRaw = fs.readFileSync(APPROVED_GEOMETRY_PATH, 'utf8');
    const approvedHash = crypto
      .createHash('sha256')
      .update(approvedRaw)
      .digest('hex')
      .toUpperCase();
    expect(
      approvedHash,
      `approved-geometry.json must match authority SHA-256 ${APPROVED_GEOMETRY_AUTHORITY_SHA256}`
    ).toBe(APPROVED_GEOMETRY_AUTHORITY_SHA256);

    // 4. Extract Live Rendered Geometry
    const liveGeometry = await extractRenderedGeometry(page, 'svg[data-scene="nox-introduction"]');
    const approvedGeometry = JSON.parse(approvedRaw);

    // 5. Compare Live Geometry with Historical Schema without Rewriting
    expect(liveGeometry.viewBox).toBe(approvedGeometry.viewBox);
    expect(liveGeometry.characterTransform).toBe(approvedGeometry.characterTransform);
    expect(liveGeometry.arms.length).toBe(8);
    expect(liveGeometry.arms).toEqual(approvedGeometry.arms);
    expect(liveGeometry.face).toEqual(approvedGeometry.face);
    expect(liveGeometry.nameplate).toEqual(approvedGeometry.nameplate);
    expect(liveGeometry.title).toEqual(approvedGeometry.title);
    expect(liveGeometry).toEqual(approvedGeometry);

    // 6. Explicit Structural Invariants
    expect(liveGeometry.face.length, 'Face group must have exactly 34 descendants').toBe(34);
    expect(liveGeometry.title.length, 'Title group must have exactly 6 direct children').toBe(6);
    expect(liveGeometry.nameplate.length, 'Nameplate group must have exactly 5 direct children').toBe(5);

    // 7. Separately Verify DOM Arm Paint Order & Depth Attributes
    const domArmOrder = await page.evaluate(() => {
      const arms = Array.from(document.querySelectorAll('svg[data-scene="nox-introduction"] [data-tentacle]'));
      return {
        ids: arms.map((a) => a.getAttribute('data-tentacle')),
        depths: arms.map((a) => a.getAttribute('data-depth')),
      };
    });
    expect(domArmOrder.ids, 'DOM arm paint order must match canonical sequence T1-T8').toEqual([
      'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8',
    ]);
    expect(domArmOrder.depths, 'DOM arm depth sequence must be rear,rear,middle,middle,middle,middle,front,front').toEqual([
      'rear', 'rear', 'middle', 'middle', 'middle', 'middle', 'front', 'front',
    ]);

    // 8. Separately Verify Ancestor & Arm Transforms
    const transforms = await page.evaluate(() => {
      const sceneEl = document.querySelector('svg[data-scene="nox-introduction"]');
      const characterEl = document.querySelector('[data-character="nox"]');
      const armRoots = Array.from(document.querySelectorAll('[data-tentacle]'));
      return {
        sceneTransform: sceneEl?.getAttribute('transform') || null,
        characterTransform: characterEl?.getAttribute('transform') || null,
        armTransforms: armRoots.map((a) => a.getAttribute('transform') || null),
      };
    });
    expect(transforms.sceneTransform, 'Scene root must have null transform').toBeNull();
    expect(transforms.characterTransform, 'Character root must have null transform').toBeNull();
    expect(transforms.armTransforms, 'Tentacle root groups must have null direct transforms').toEqual(
      new Array(8).fill(null)
    );

    // 9. Separately Verify Live Mantle against Frozen Authored Geometry
    const liveMantleD = await page.evaluate(() => {
      const mantleGroup = document.querySelector('g[id$="-mantle"]');
      const firstMantlePath = mantleGroup?.querySelector('path');
      return firstMantlePath?.getAttribute('d') || null;
    });
    expect(liveMantleD, 'Rendered mantle path d must match frozen authored mantleContour').toBe(mantleContour);

    // 10. Invariants: Zero Embedded Images, Zero Animations
    const embeddedImages = await page.evaluate(() => document.querySelectorAll('image, img').length);
    expect(embeddedImages, 'Zero images may be embedded in scene').toBe(0);

    const animationElements = await page.evaluate(
      () => document.querySelectorAll('animate, animateTransform, animateMotion, set').length
    );
    expect(animationElements, 'Zero SVG animation elements permitted').toBe(0);

    const activeWebAnimations = await page.evaluate(() => document.getAnimations().length);
    expect(activeWebAnimations, 'Zero active CSS/web animations permitted').toBe(0);

    // 11. Invariants: Zero Duplicate IDs
    const duplicateIds = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('[id]'));
      const idMap: Record<string, number> = {};
      const dups: string[] = [];
      for (const el of allElements) {
        const id = el.id;
        idMap[id] = (idMap[id] || 0) + 1;
        if (idMap[id] === 2) dups.push(id);
      }
      return dups;
    });
    expect(duplicateIds, 'Found duplicate element IDs in canonical DOM').toEqual([]);

    // 12. Invariants: Valid Local SVG References (including mask)
    const brokenRefs = await page.evaluate(() => {
      const broken: string[] = [];
      const urlRegex = /url\(#([^)]+)\)/g;
      const attrsToCheck = ['fill', 'stroke', 'filter', 'clip-path', 'clipPath', 'mask'];

      for (const el of Array.from(document.querySelectorAll('svg *'))) {
        for (const attr of attrsToCheck) {
          const val = el.getAttribute(attr);
          if (!val) continue;
          let match: RegExpExecArray | null;
          urlRegex.lastIndex = 0;
          while ((match = urlRegex.exec(val)) !== null) {
            const targetId = match[1];
            if (!document.getElementById(targetId)) {
              broken.push(`${el.tagName}[${attr}="${val}"] -> missing #${targetId}`);
            }
          }
        }
      }
      return broken;
    });
    expect(brokenRefs, 'Found unresolved local SVG url(#id) references').toEqual([]);

    // 13. Capture Fresh Evidence into Ignored test-output/ (Never overwrite historical review files)
    const freshScreenshotPath = path.join(OUTPUT_DIR, 'canonical-507x505.png');
    await scene.screenshot({ path: freshScreenshotPath });

    const freshGeometryPath = path.join(OUTPUT_DIR, 'fresh-geometry.json');
    fs.writeFileSync(freshGeometryPath, JSON.stringify(liveGeometry, null, 2) + '\n');

    // 14. Record Full Verified Provenance (no hardcoded passing claims)
    const provenance = {
      ...collectTestProvenance(page, REPO_ROOT, 'nox-canonical'),
      extractedGeometrySha256: crypto
        .createHash('sha256')
        .update(JSON.stringify(liveGeometry, null, 2))
        .digest('hex')
        .toUpperCase(),
      approvedGeometryBaselineSha256: approvedHash,
      checks: {
        armsCount: liveGeometry.arms.length,
        armsIdentical: liveGeometry.arms.length === 8,
        faceDescendantsCount: liveGeometry.face.length,
        nameplateChildrenCount: liveGeometry.nameplate.length,
        titleChildrenCount: liveGeometry.title.length,
        viewBoxIdentical: liveGeometry.viewBox === approvedGeometry.viewBox,
        duplicateIdsCount: duplicateIds.length,
        brokenRefsCount: brokenRefs.length,
        embeddedImagesCount: embeddedImages,
        animationElementsCount: animationElements,
        activeWebAnimationsCount: activeWebAnimations,
      },
    };

    const provenancePath = path.join(OUTPUT_DIR, 'provenance.json');
    fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + '\n');
  });
});
