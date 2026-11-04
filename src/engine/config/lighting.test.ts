import * as THREE from 'three';
import { expect, test } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import { INTRO_LIGHTING } from './lighting';
import { createSkinUniforms } from '../character/skinMaterial';

const luminance = (hex: string, intensity: number) => {
  const c = new THREE.Color(hex);
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) * intensity;
};

test('one strong key light, a subtler warm underglow, and gentle bounce light', () => {
  const l = INTRO_LIGHTING;
  const key = luminance(l.key.color, l.key.intensity);
  expect(key).toBeGreaterThan(2 * luminance(l.underglow.color, l.underglow.intensity));
  expect(key).toBeGreaterThan(3 * luminance(l.ambient.sky, l.ambient.intensity));
  expect(key).toBeGreaterThan(3 * luminance(l.ambient.ground, l.ambient.intensity));
  // The key comes from above, in front and to the left; the underglow from below.
  expect(l.key.direction[1]).toBeGreaterThan(0);
  expect(l.key.direction[0]).toBeLessThan(0);
  expect(l.key.direction[2]).toBeGreaterThan(0);
});

test('the warm underglow is warm and the bounce from above is cool', () => {
  const warm = new THREE.Color(INTRO_LIGHTING.underglow.color);
  const sky = new THREE.Color(INTRO_LIGHTING.ambient.sky);
  expect(warm.r).toBeGreaterThan(warm.b);
  expect(sky.b).toBeGreaterThan(sky.r);
});

test('the skin reads its lighting from the stage lighting', () => {
  const u = createSkinUniforms(NOX, INTRO_LIGHTING);
  const l = INTRO_LIGHTING;
  expect(u.uKeyDir.value.toArray().map(v => +v.toFixed(6))).toEqual(new THREE.Vector3(...l.key.direction).normalize().toArray().map(v => +v.toFixed(6)));
  expect(u.uKeyLight.value.getHexString()).toBe(new THREE.Color(l.key.color).multiplyScalar(l.key.intensity).getHexString());
  expect(u.uUnderglow.value.toArray()).toEqual([...new THREE.Color(l.underglow.color).multiplyScalar(l.underglow.intensity).toArray(), l.underglow.wrap]);
  expect(u.uWrap.value).toBe(l.key.wrap);
  expect(u.uHaze.value.toArray()).toEqual([l.haze.near, l.haze.far, l.haze.strength]);
});
