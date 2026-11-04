import * as icons from 'simple-icons';
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { noxTechnologies } from '../../worlds/nox/content/noxTechnologies';
import { LOGO_SLUGS, holeMask, logoColour, logoDrawColour, logoInnerColour } from './logoTexture';

test('every Nox technology has a logo slug that resolves in simple-icons', () => {
  for (const technology of noxTechnologies) {
    const slug = LOGO_SLUGS[technology.iconKey];
    expect(slug, technology.iconKey).toBeDefined();
    expect((icons as Record<string, unknown>)[slug], slug).toBeDefined();
  }
});

test('logos keep their brand colour, but near-black marks turn white so they show on dark glass', () => {
  expect(logoColour('html')).toBe('#E34F26');
  expect(logoColour('github')).toBe('#FFFFFF');
  expect(logoColour('express')).toBe('#FFFFFF');
  expect(logoColour('kali')).toBe('#FFFFFF');
});

test('logos are drawn more saturated than their brand colour, so they stay vivid inside the glass', () => {
  const hsl = (hex: string) => new THREE.Color(hex).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);
  for (const key of ['typescript', 'css', 'node', 'html']) {
    const brand = hsl(logoColour(key));
    const drawn = hsl(logoDrawColour(key));
    expect(Math.abs(drawn.h - brand.h), key).toBeLessThan(0.01);
    expect(drawn.s, key).toBeGreaterThanOrEqual(Math.min(1, brand.s * 1.2) - 0.01);
  }
  expect(logoDrawColour('github')).toBe('#ffffff');
  // Muted brands are lifted towards the painting's neon, not just scaled.
  expect(hsl(logoDrawColour('node')).s).toBeGreaterThanOrEqual(0.6);
});

test('holeMask finds the enclosed gaps of a mark (its letters), not the space round it', () => {
  // A 10 x 10 square ring: solid border 2 px wide, empty 6 x 6 middle, on a 14 x 14 canvas.
  const size = 14;
  const alpha = new Uint8ClampedArray(size * size);
  for (let y = 2; y < 12; y++) for (let x = 2; x < 12; x++) if (x < 4 || x > 9 || y < 4 || y > 9) alpha[y * size + x] = 255;
  const holes = holeMask(alpha, size);
  expect(holes[7 * size + 7]).toBe(1);
  expect(holes[4 * size + 4]).toBe(1);
  expect(holes[0]).toBe(0);
  expect(holes[7 * size + 1]).toBe(0);
  expect(holes[7 * size + 2]).toBe(0);
  expect(holes.reduce((n, v) => n + v, 0)).toBe(36);
});

test('badge logos fill their letters as the painting does', () => {
  expect(logoInnerColour('html')).toBe('#ffffff');
  expect(logoInnerColour('typescript')).toBe('#ffffff');
  expect(logoInnerColour('javascript')).toBe('#1a1a1a');
  expect(logoInnerColour('node')).toBeUndefined();
});
