import { expect, test } from 'vitest';
import { glslColour } from './colour';
import { DEFAULT_FLOOR, FLOOR_MATERIALS } from './floors';
import { mossShading } from './floors/moss';
import { sandShading } from './floors/sand';
import { floorGlows, floorShading } from './floors/shading';
import { SECURITY_WORLD } from '../../worlds/nox/place/config';
import type { WorldConfig } from './types';
import { validateWorld } from './validateWorld';

test('the floor materials are a closed table: lava-cracks (Nox’s, the default), moss and sand', () => {
  expect(Object.keys(FLOOR_MATERIALS)).toEqual(['lava-cracks', 'moss', 'sand']);
  expect(DEFAULT_FLOOR).toBe('lava-cracks');
  // Each declares the palette colours it reads: the lava floor reads its own `floorGlow`, the moss floor `moss`.
  expect(FLOOR_MATERIALS['lava-cracks'].palette).toEqual([]);
  expect(FLOOR_MATERIALS.moss.palette).toEqual(['moss']);
  expect(FLOOR_MATERIALS.sand.palette).toEqual(['sand', 'rock']);
});

test('the moss shading takes its colour from the palette, and has no glow in it', () => {
  const green = mossShading('#2c5a3a');
  expect(green).toContain(glslColour('#2c5a3a'));
  expect(mossShading('#5a2c3a')).not.toBe(green);
  expect(mossShading('color(srgb-linear 0.02 0.1 0.04)')).toContain('vec3(0.02, 0.1, 0.04)');
  expect(green).not.toMatch(/crack|lava|sheen|totalEmissiveRadiance/);
  // It shades the diffuse colour and the roughness, from the fields the floor defines.
  expect(green).toContain('diffuseColor');
  expect(green).toContain('roughnessFactor');
  expect(green).toContain('floorNoise');
  expect(green).toContain('puddle');
});

test('the sand shading takes its sand and its rock from the palette, and has no glow in it', () => {
  const dunes = sandShading('#c8b48a', '#2a2a30');
  expect(dunes).toContain(glslColour('#c8b48a'));
  expect(dunes).toContain(glslColour('#2a2a30'));
  expect(sandShading('#d8c49a', '#2a2a30')).not.toBe(dunes);
  expect(sandShading('#c8b48a', '#3a3a40')).not.toBe(dunes);
  expect(sandShading('color(srgb-linear 0.5 0.4 0.2)', '#2a2a30')).toContain('vec3(0.5, 0.4, 0.2)');
  expect(dunes).not.toMatch(/crack|lava|sheen|totalEmissiveRadiance/);
  // Like moss, it shades the diffuse colour and the roughness, from the fields the floor defines.
  for (const name of ['diffuseColor', 'roughnessFactor', 'floorNoise', 'puddle', 'vFloorWorld']) expect(dunes).toContain(name);
  // No colour of its own: every colour is one of the two it was given.
  expect(dunes.replaceAll(glslColour('#c8b48a'), '').replaceAll(glslColour('#2a2a30'), '')).not.toMatch(/vec3\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*\)/);
});

test('the floor shading is chosen by material: Nox’s lava-cracks adds nothing and keeps its glow; moss and sand add their own and drop it', () => {
  const palette = { ...SECURITY_WORLD.palette, moss: '#2c5a3a', sand: '#c8b48a', rock: '#2a2a30' };
  expect(floorShading('lava-cracks', palette)).toBe('');
  expect(floorGlows('lava-cracks')).toBe(true);
  expect(floorShading('moss', palette)).toBe(mossShading('#2c5a3a'));
  expect(floorShading('sand', palette)).toBe(sandShading('#c8b48a', '#2a2a30'));
  expect(floorGlows('moss')).toBe(false);
  expect(floorGlows('sand')).toBe(false);
  // The default is Nox's.
  expect(floorShading(undefined, palette)).toBe('');
  expect(floorGlows(undefined)).toBe(true);
});

test('a world with a sand floor validates, and the sand and rock colours are required and named by it', () => {
  const sand: WorldConfig = { ...SECURITY_WORLD, floor: { material: 'sand' }, palette: { ...SECURITY_WORLD.palette, sand: '#c8b48a', rock: '#2a2a30' } };
  expect(validateWorld(sand)).toEqual([]);
  const bad = (change: Partial<WorldConfig>) => validateWorld({ ...sand, ...change }).join('\n');
  const { sand: _sand, ...noSand } = sand.palette;
  const { rock: _rock, ...noRock } = sand.palette;
  expect(bad({ palette: noSand as WorldConfig['palette'] })).toContain('palette.sand is missing (the sand floor reads it)');
  expect(bad({ palette: noRock as WorldConfig['palette'] })).toContain('palette.rock is missing (the sand floor reads it)');
  expect(bad({ floor: { material: 'lava-cracks' } })).toContain('palette.sand is named by no light, relic or floor');
  // Nox's own config is a lava-cracks world and still validates.
  expect(SECURITY_WORLD.floor).toBeUndefined();
  expect(validateWorld(SECURITY_WORLD)).toEqual([]);
});
