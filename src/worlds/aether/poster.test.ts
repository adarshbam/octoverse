import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import sharp from 'sharp';
import { expect, test } from 'vitest';
import { AETHER_THEME } from './theme';

// Spec 7.11: a browser with no WebGL gets a still of her intro (the engine's Poster, under the same overlays).
// The theme names the file; this pins that the file is there, is the size the theme says, and is small.
const file = (src: string) => new URL(`../../../public/${src}`, import.meta.url);

test("the theme's poster file exists, is a WebP of the size the theme says, and is small", async () => {
  const { src, width, height, alt } = AETHER_THEME.poster;
  expect(src).toBe('aether/poster-intro.webp');
  expect(existsSync(file(src)), `public/${src} is missing: the no-WebGL page would show a broken image`).toBe(true);
  const bytes = statSync(file(src)).size;
  expect(bytes).toBeGreaterThan(20_000);
  expect(bytes).toBeLessThan(150_000);
  const meta = await sharp(readFileSync(file(src))).metadata();
  expect(meta.format).toBe('webp');
  expect({ width: meta.width, height: meta.height }).toEqual({ width, height });
  expect(alt).toMatch(/Aether/);
});

test("the poster is her own intro, not a copy of Nox's or Veyra's", () => {
  const hash = (src: string) => createHash('sha256').update(readFileSync(file(src))).digest('hex');
  const mine = hash(AETHER_THEME.poster.src);
  expect(mine).not.toBe(hash('nox/poster-intro.webp'));
  expect(mine).not.toBe(hash('veyra/poster-intro.webp'));
});
