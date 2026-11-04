import { expect, test } from 'vitest';
import { glslColour } from './colour';
import { DEFAULT_FLOOR, FLOOR_MATERIALS } from './floors';
import { mossShading } from './floors/moss';

test('the floor materials are a closed table: lava-cracks (Nox’s, the default) and moss', () => {
  expect(Object.keys(FLOOR_MATERIALS)).toEqual(['lava-cracks', 'moss']);
  expect(DEFAULT_FLOOR).toBe('lava-cracks');
  // Each declares the palette colours it reads: the lava floor reads its own `floorGlow`, the moss floor `moss`.
  expect(FLOOR_MATERIALS['lava-cracks'].palette).toEqual([]);
  expect(FLOOR_MATERIALS.moss.palette).toEqual(['moss']);
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
