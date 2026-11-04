import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from './manifest.json';
import { stillFor, type StillKey } from './stills';

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
