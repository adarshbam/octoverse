import * as THREE from 'three';
import { expect, test, vi } from 'vitest';
import { isColour, isWorldColour, setWorldColour } from './colour';

test('a hex colour is read as sRGB and a linear colour as it stands', () => {
  expect(setWorldColour(new THREE.Color(), '#ff0000').toArray()).toEqual(new THREE.Color('#ff0000').toArray());
  const linear = setWorldColour(new THREE.Color(), 'color(srgb-linear 0.052 0.0252 0.06)');
  // The components are exactly what is written: no 8-bit step in between.
  expect(linear.toArray()).toEqual([0.052, 0.0252, 0.06]);
});

test('only colours it can read are colours', () => {
  for (const ok of ['#fff', '#1a2b3c', 'color(srgb-linear 0.1 0 1)']) expect(isWorldColour(ok), ok).toBe(true);
  for (const bad of ['', 'red', '#12', '#12345g', 'color(srgb-linear 0.1 0)', 'color(srgb-linear NaN 0 0)', 'color(srgb-linear -1 0 0)', 7, null, undefined]) expect(isWorldColour(bad), String(bad)).toBe(false);
});

test("isColour reads exactly what three's Color.set reads, CSS names included", () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  /** Whether three sets a colour from `text` (a colour three cannot read is left as it was: NaN here). */
  const threeReads = (text: string) => {
    const c = new THREE.Color();
    c.r = c.g = c.b = Number.NaN;
    c.setStyle(text);
    return !Number.isNaN(c.r);
  };
  const samples = [
    '#fff', '#1a2b3c', '#A1B2C3', 'rgb(10, 20, 30)', 'rgba(255,24,44,0.5)', 'rgba(26, 20, 40, 0.92)', 'rgb(10%, 20%, 30%)', 'hsl(120, 50%, 50%)', 'hsla(350, 90%, 50%, 0.5)', 'violet', 'Teal', 'rebeccapurple',
    '', '#12', '#12345g', '#ff4a3080', 'rgb(255 0 0)', 'rgb(1.5, 2, 3)', 'hsl(350deg, 90%, 50%)', 'oklch(0.6 0.2 20)', 'violetish', 'color(srgb-linear 0.1 0.2 0.3)',
  ];
  for (const text of samples) expect(isColour(text), text).toBe(threeReads(text));
  expect(samples.filter(isColour)).toHaveLength(12);
  for (const bad of [7, null, undefined]) expect(isColour(bad)).toBe(false);
  warn.mockRestore();
});
