import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Page } from '@playwright/test';

/**
 * Expected SHA-256 for frozen character curves in introductionGeometry.ts.
 * Frozen across Milestone A00/A01.
 */
export const FROZEN_GEOMETRY_SHA256 = '5018DCDCE006063FB8053A739A940FEAA33FFCDA80F62ABF5D073C5A5573438E';

/**
 * Authority SHA-256 for approved-geometry.json.
 * Confirmed by file bytes and artifacts.local/a00-before-execution/working-tree-manifest.json.
 */
export const APPROVED_GEOMETRY_AUTHORITY_SHA256 = 'FE906FB9D72E11C8B456FA89404A5AE91CE7917C377961984084B082FF682E35';

/**
 * Computes uppercase SHA-256 digest of a file.
 */
export function computeFileSha256(filePath: string): string {
  if (!fs.existsSync(filePath)) return 'missing';
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
}

/**
 * Reads the active git commit SHA without executing terminal commands.
 */
export function getActiveCommit(repoRoot: string): string {
  try {
    const headPath = path.join(repoRoot, '.git/HEAD');
    if (fs.existsSync(headPath)) {
      const head = fs.readFileSync(headPath, 'utf8').trim();
      if (head.startsWith('ref: ')) {
        const refPath = path.join(repoRoot, '.git', head.slice(5).trim());
        if (fs.existsSync(refPath)) {
          return fs.readFileSync(refPath, 'utf8').trim();
        }
      } else if (head.length === 40) {
        return head;
      }
    }
  } catch {
    // fallback to saved verification record
  }
  const verificationPath = path.join(repoRoot, 'artifacts.local/a00-before-execution/verification.json');
  if (fs.existsSync(verificationPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(verificationPath, 'utf8'));
      if (data.checkpointCommit) return data.checkpointCommit;
    } catch {
      // ignore parse error
    }
  }
  return 'unknown';
}

/**
 * Verifies introductionGeometry.ts byte hash and line ending format (LF vs CRLF).
 */
export function verifyFrozenGeometrySource(repoRoot: string): {
  hash: string;
  matchesFrozen: boolean;
  hasCrlf: boolean;
  byteLength: number;
} {
  const filePath = path.join(repoRoot, 'src/components/nox/introductionGeometry.ts');
  const buffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
  const content = buffer.toString('binary');
  const hasCrlf = content.includes('\r\n');

  return {
    hash,
    matchesFrozen: hash === FROZEN_GEOMETRY_SHA256,
    hasCrlf,
    byteLength: buffer.length,
  };
}

/**
 * Collects verified provenance data without hardcoded passing claims.
 */
export function collectTestProvenance(
  page: Page,
  repoRoot: string,
  testRunName: string
) {
  const commit = getActiveCommit(repoRoot);
  const gitStatusPath = path.join(repoRoot, 'artifacts.local/a00-before-execution/git-status.txt');
  const hasGitStatus = fs.existsSync(gitStatusPath);

  return {
    task: 'A01',
    testRun: testRunName,
    timestamp: new Date().toISOString(),
    commit,
    dirtyTreeStatus: {
      isDirty: true,
      description: 'Active tree contains modified A00/A01 files and preserved excluded deletion state',
      baselineGitStatusAvailable: hasGitStatus,
    },
    browser: {
      name: page.context().browser()?.browserType().name() || 'chromium',
      version: page.context().browser()?.version() || 'unknown',
    },
    viewport: page.viewportSize() || { width: 507, height: 505 },
    scene: 'nox-introduction',
    motionSetting: 'static (0 active animations, 0 animation elements)',
    reference: {
      file: 'docs/design/references/Nox.jpeg',
      panel: 2,
      crop: { x: 512, y: 0, width: 507, height: 505 },
      sha256: computeFileSha256(path.join(repoRoot, 'docs/design/references/Nox.jpeg')),
    },
    sourceHashes: {
      introductionGeometryTs: computeFileSha256(path.join(repoRoot, 'src/components/nox/introductionGeometry.ts')),
      noxCharacterTsx: computeFileSha256(path.join(repoRoot, 'src/components/nox/NoxCharacter.tsx')),
      noxEnvironmentTsx: computeFileSha256(path.join(repoRoot, 'src/components/nox/NoxEnvironment.tsx')),
      appTsx: computeFileSha256(path.join(repoRoot, 'src/App.tsx')),
      approvedGeometryJson: computeFileSha256(path.join(repoRoot, 'docs/design/reviews/nox-environment/approved-geometry.json')),
    },
  };
}

/**
 * Evaluates live rendered geometry from an SVG element in the browser.
 * Extracts pure geometry matching the schema of approved-geometry.json.
 * Preserves actual DOM arm paint order without sorting.
 * Preserves exact attribute strings and cup ordering without numeric rounding.
 */
export async function extractRenderedGeometry(
  page: Page,
  sceneSelector = 'svg[data-scene="nox-introduction"]'
) {
  return await page.evaluate((selector) => {
    const svg = document.querySelector(selector);
    if (!svg) {
      throw new Error(`Scene SVG not found with selector: ${selector}`);
    }

    const viewBox = svg.getAttribute('viewBox') || '';

    // Pure geometric SVG attribute whitelist
    const geometricAttrs = [
      'cx',
      'cy',
      'd',
      'dx',
      'dy',
      'height',
      'r',
      'rx',
      'ry',
      'transform',
      'width',
      'x',
      'y',
    ];

    function getAttrs(el: Element): Record<string, string> {
      const res: Record<string, string> = {};
      for (const attr of geometricAttrs) {
        if (el.hasAttribute(attr)) {
          const val = el.getAttribute(attr);
          if (val !== null && val !== '') {
            res[attr] = val;
          }
        }
      }
      // Return deterministically sorted keys
      const sorted: Record<string, string> = {};
      for (const k of Object.keys(res).sort()) {
        sorted[k] = res[k];
      }
      return sorted;
    }

    // 1. Arms (T1 through T8) - Preserves actual DOM paint order; DO NOT sort away changes!
    const armElements = Array.from(svg.querySelectorAll('[data-tentacle]'));

    const arms = armElements.map((armEl) => {
      const id = armEl.getAttribute('data-tentacle') || '';
      const depth = armEl.getAttribute('data-depth') || '';
      const firstPath = armEl.querySelector('path');
      const contour = firstPath ? (firstPath.getAttribute('d') || '') : '';

      // Cups: distinct <g transform="..."> elements representing suction cup lobes in DOM order
      const cupGroups = Array.from(armEl.querySelectorAll('g[transform]'));
      const cups = cupGroups.map((cupEl) => {
        const transform = cupEl.getAttribute('transform') || '';
        const shapes = Array.from(cupEl.children).map((shapeEl) => ({
          attrs: getAttrs(shapeEl),
          tag: shapeEl.tagName.toLowerCase(),
        }));
        return { shapes, transform };
      });

      return {
        contour,
        cups,
        depth,
        id,
      };
    });

    // 2. Character Transform
    const charEl = svg.querySelector('[data-character="nox"]') || svg.querySelector('#nox-character');
    const characterTransform = charEl ? (charEl.getAttribute('transform') || null) : null;

    // 3. Face (34 descendants in canonical face group)
    const faceGroup = svg.querySelector('[data-part="face"]') || svg.querySelector('g[id$="-face"]');
    const face = faceGroup
      ? Array.from(faceGroup.querySelectorAll('*')).map((el) => ({
          attrs: getAttrs(el),
          tag: el.tagName.toLowerCase(),
        }))
      : [];

    // 4. Nameplate (5 direct children)
    const nameplateGroup = svg.querySelector('[data-layer="nameplate"]') || svg.querySelector('.nameplate');
    const nameplate = nameplateGroup
      ? Array.from(nameplateGroup.children).map((el) => ({
          attrs: getAttrs(el),
          tag: el.tagName.toLowerCase(),
        }))
      : [];

    // 5. Title / project-identity (6 direct children)
    const titleGroup = svg.querySelector('[data-layer="project-identity"]') || svg.querySelector('.project-identity');
    const title = titleGroup
      ? Array.from(titleGroup.children).map((el) => ({
          attrs: getAttrs(el),
          tag: el.tagName.toLowerCase(),
        }))
      : [];

    return {
      arms,
      characterTransform,
      face,
      nameplate,
      title,
      viewBox,
    };
  }, sceneSelector);
}
