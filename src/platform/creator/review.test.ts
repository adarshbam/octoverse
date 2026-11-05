import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateBundle } from '../../engine/types/bundle';
import { PERSONALITIES } from './personalities';
import { DEFAULT_PERSONALITY, creatorReviewBundle } from './review';
import { parseCreatorParam } from './reviewParam';
import { PALETTE_IDS, TEMPLATE_IDS } from './types';

const ROOT = resolve(__dirname, '../../..');

describe('?creator=<template>.<palette>', () => {
  it('parses a template and a palette, in dev', () => {
    expect(parseCreatorParam('?creator=nox.rose', true)).toEqual({ template: 'nox', palette: 'rose' });
    expect(parseCreatorParam('?stage=intro&freeze&creator=aether.lilacGrey&solo', true)).toEqual({ template: 'aether', palette: 'lilacGrey' });
    expect(parseCreatorParam('?creator=veyra.original', true)).toEqual({ template: 'veyra', palette: 'original' });
  });

  it('is ignored in a production build (dev false), whatever it says', () => {
    for (const t of TEMPLATE_IDS) for (const p of PALETTE_IDS) expect(parseCreatorParam(`?creator=${t}.${p}`, false), `${t}.${p}`).toBeNull();
  });

  it('rejects anything but a known template and palette', () => {
    for (const bad of ['', '?creator=', '?creator=nox', '?creator=nox.', '?creator=.rose', '?creator=kraken.rose', '?creator=nox.plaid', '?creator=nox.rose.x', '?creator=NOX.rose', '?world=nox', '?creator=__proto__.rose']) {
      expect(parseCreatorParam(bad, true), bad).toBeNull();
    }
  });

  it('the guard in main.tsx is the build\'s own import.meta.env.DEV, in literal form, on both the parse and the mount', () => {
    const main = readFileSync(resolve(ROOT, 'src/app/main.tsx'), 'utf8');
    expect(main).toMatch(/parseCreatorParam\(\s*window\.location\.search\s*,\s*import\.meta\.env\.DEV\s*\)/);
    expect(main).toMatch(/if\s*\(\s*import\.meta\.env\.DEV\s*&&\s*creator\b/);
    // The review bundle is a dynamic import under that guard, never a static one (the landing must not load the templates).
    expect(main).not.toMatch(/from\s+['"][./]*platform\/creator\/review['"]/);
    expect(main).toMatch(/import\(\s*['"]\.\.\/platform\/creator\/review['"]\s*\)/);
    // ?world= is untouched.
    expect(main).toContain('isWorldReview(window.location.pathname, window.location.search)');
  });
});

describe('creatorReviewBundle', () => {
  it('all 36 stills (4 templates x 9 palettes) are valid bundles named u-review, with the template\'s own personality', () => {
    let count = 0;
    for (const template of TEMPLATE_IDS) {
      for (const palette of PALETTE_IDS) {
        const bundle = creatorReviewBundle({ template, palette });
        expect(() => validateBundle(bundle), `${template}.${palette}`).not.toThrow();
        expect(bundle.id).toBe('u-review');
        expect(bundle.content.project.name).toBe('Untitled project');
        expect(bundle.content.technologies).toEqual([]);
        expect(bundle.character.personality).toEqual(PERSONALITIES[DEFAULT_PERSONALITY[template]]);
        count += 1;
      }
    }
    expect(count).toBe(36);
  });
});
