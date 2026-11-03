import * as THREE from 'three';
import { expect, test } from 'vitest';
import { isWorldColour, setWorldColour } from './colour';

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
