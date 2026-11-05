import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from './manifest.json';
import { PALETTE_IDS, TEMPLATE_IDS } from '../creator/types';
import { stillFor, stillKey, type StillKey } from './stills';

const MAX_BYTES = 60 * 1024;
const ROOT = resolve(__dirname, '../../..');
const WORLDS = ['nox', 'veyra', 'flux', 'aether'] as const;

describe('world stills', () => {
  it.each(WORLDS)('resolves the %s world key', (world) => {
    const key: StillKey = { kind: 'world', world };
    const still = stillFor(key);
    expect(still.src).toBe(`/platform/stills/${world}.webp`);
    expect(still.width).toBeGreaterThan(0);
    expect(still.height).toBeGreaterThan(0);
  });

  it('records bundle, commit, date and bytes for every world still', () => {
    for (const world of WORLDS) {
      const entry = manifest.entries.find((e) => e.key === `world:${world}`);
      expect(entry, world).toBeDefined();
      expect(entry!.bundle).toBe(world);
      expect(entry!.commit).toMatch(/^[0-9a-f]{7,}$/);
      expect(entry!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(typeof manifest.assumption).toBe('string');
  });
});

describe('creator stills', () => {
  const combinations = TEMPLATE_IDS.flatMap(template => PALETTE_IDS.map(palette => [template, palette] as const));

  it('are 4 templates x 9 palettes, Original included', () => {
    expect(combinations).toHaveLength(36);
    expect(PALETTE_IDS).toContain('original');
  });

  it.each(combinations)('resolves %s in %s', (template, palette) => {
    const key: StillKey = { kind: 'creator', template, palette };
    expect(stillKey(key)).toBe(`creator:${template}:${palette}`);
    const still = stillFor(key);
    expect(still.src).toBe(`/platform/stills/creator-${template}-${palette}.webp`);
    expect(still.width).toBe(manifest.width);
    expect(still.height).toBe(manifest.height);
    const path = resolve(ROOT, 'public', still.src.slice(1));
    expect(existsSync(path), still.src).toBe(true);
    expect(statSync(path).size, still.src).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('records bundle, commit, date and bytes for every creator still, and nothing else of that kind', () => {
    const entries = manifest.entries.filter(e => e.key.startsWith('creator:'));
    expect(entries.map(e => e.key).sort()).toEqual(combinations.map(([t, p]) => `creator:${t}:${p}`).sort());
    for (const entry of entries) {
      expect(entry.bundle, entry.key).toBe('u-review');
      expect(entry.commit).toMatch(/^[0-9a-f]{7,}$/);
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('keeps the four world stills beside them', () => {
    for (const world of WORLDS) expect(manifest.entries.some(e => e.key === `world:${world}`), world).toBe(true);
  });

  it('throws for a combination the manifest does not hold', () => {
    expect(() => stillFor({ kind: 'creator', template: 'nox', palette: 'gold' as never })).toThrow(/no still recorded/);
  });
});

describe('manifest files', () => {
  it('exist on disk, at most 60 KB, with the recorded byte count', () => {
    expect(manifest.entries.length).toBeGreaterThan(0);
    for (const entry of manifest.entries) {
      const path = resolve(ROOT, 'public/platform/stills', entry.file);
      expect(existsSync(path), entry.file).toBe(true);
      const bytes = statSync(path).size;
      expect(bytes, entry.file).toBeLessThanOrEqual(MAX_BYTES);
      expect(bytes, entry.file).toBe(entry.bytes);
      expect(readFileSync(path).subarray(8, 12).toString('ascii'), entry.file).toBe('WEBP');
    }
  });

  it('never points into the reference art', () => {
    for (const entry of manifest.entries) {
      expect(entry.file).not.toMatch(/references/i);
      expect(entry.file).not.toMatch(/[\/]/);
    }
  });
});
