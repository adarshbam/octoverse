import * as THREE from 'three';
import { expect, test } from 'vitest';
import { SECURITY_WORLD } from '../../worlds/nox/place/config';
import { glslColour, glslFloat } from './colour';
import { createWaterEnvironmentMaterial } from './textures';
import type { WorldConfig } from './types';
import { validateWorld } from './validateWorld';

// The world's look as place data (fix wave A): the colours the water, its environment map, the
// floor and the live elements were drawn with are the world's, so a world without red has none.

const problems = (world: WorldConfig) => validateWorld(world).join('\n');
/** No channel of `c` leans red: red is no higher than green or blue (black has none). */
const noRed = (c: THREE.Color) => c.r <= c.g || c.r <= c.b || c.r === 0;

test("Nox's water colours are the literals the water was drawn with, verbatim", () => {
  expect(SECURITY_WORLD.water.colours).toEqual({ deep: '#03050f', zenith: '#0c2468', glow: '#3f8cff', opening: '#3fd0ff', rays: '#4f86ff', raysWide: '#4fc0ff', fish: '#0c1838' });
  expect(SECURITY_WORLD.water.environment).toEqual({ top: '#2a5cff', horizon: '#0a1840', low: '#0b0712', seabedGlow: '#ff2030' });
});

test('validateWorld names each water colour that is missing or not a colour', () => {
  const water = SECURITY_WORLD.water;
  expect(problems({ ...SECURITY_WORLD, water: { ...water, colours: { ...water.colours, zenith: 'blue-ish' } } })).toContain('water.colours.zenith');
  expect(problems({ ...SECURITY_WORLD, water: { ...water, colours: { ...water.colours, fish: undefined as unknown as string } } })).toContain('water.colours.fish');
  expect(problems({ ...SECURITY_WORLD, water: { ...water, colours: undefined as unknown as WorldConfig['water']['colours'] } })).toContain('water.colours is missing');
  expect(problems({ ...SECURITY_WORLD, water: { ...water, environment: { ...water.environment, horizon: '#0a18' } } })).toContain('water.environment.horizon');
  expect(problems({ ...SECURITY_WORLD, water: { ...water, environment: { ...water.environment, seabedGlow: 'red' } } })).toContain('water.environment.seabedGlow');
  expect(problems({ ...SECURITY_WORLD, water: { ...water, environment: undefined as unknown as WorldConfig['water']['environment'] } })).toContain('water.environment is missing');
  // No seabed glow at all is a choice, not a fault.
  expect(problems({ ...SECURITY_WORLD, water: { ...water, environment: { ...water.environment, seabedGlow: null } } })).toBe('');
});

test("the environment map takes the world's colours: Nox's carries the red seabed band, a world with no seabed glow none, its reflections kept", () => {
  const sun = new THREE.Vector3(...SECURITY_WORLD.water.surfaceDir);
  const nox = createWaterEnvironmentMaterial(SECURITY_WORLD.water.environment, sun);
  expect((nox.uniforms.uRed.value as THREE.Color).getHexString()).toBe('ff2030');
  expect((nox.uniforms.uTop.value as THREE.Color).getHexString()).toBe('2a5cff');
  expect((nox.uniforms.uHorizon.value as THREE.Color).getHexString()).toBe('0a1840');
  expect((nox.uniforms.uLow.value as THREE.Color).getHexString()).toBe('0b0712');
  nox.dispose();

  const teal = { top: '#2cc8b8', horizon: '#06302e', low: '#03100e', seabedGlow: null };
  const clear = createWaterEnvironmentMaterial(teal, sun);
  expect((clear.uniforms.uRed.value as THREE.Color).toArray()).toEqual([0, 0, 0]);
  for (const name of ['uTop', 'uHorizon', 'uLow', 'uRed']) expect(noRed(clear.uniforms[name].value as THREE.Color), name).toBe(true);
  // The reflections stay: the top is still a light, not black.
  expect((clear.uniforms.uTop.value as THREE.Color).getHexString()).toBe('2cc8b8');
  clear.dispose();
});

test('a colour compiled into a shader keeps the text it had: linear components as they are, hex as three reads it', () => {
  expect(glslColour('color(srgb-linear 1 0.09 0.05)')).toBe('vec3(1.0, 0.09, 0.05)');
  expect(glslColour('color(srgb-linear 0.002 0.0015 0.004)')).toBe('vec3(0.002, 0.0015, 0.004)');
  expect(glslColour('color(srgb-linear 0 0 0)')).toBe('vec3(0.0, 0.0, 0.0)');
  expect(glslColour('#ffffff')).toBe('vec3(1.0, 1.0, 1.0)');
  expect(glslFloat(1e-7)).not.toContain('e');
  expect(Number(glslFloat(1e-7))).toBeCloseTo(1e-7, 12);
});
