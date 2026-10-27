import * as THREE from 'three';
import { expect, test } from 'vitest';
import { type BakeRecord, bakedRelief, withBakedLight } from './bakedLight';
import { SECURITY_WORLD } from './security/config';

// The patches find their place by a chunk's include line; were three to rename the chunk, a patch
// would quietly change nothing. These check each one still lands in three's standard material.

const lights: BakeRecord['lights'] = {
  glyph: [{ position: [1, 2, 3], color: '#ff2000', intensity: 2, distance: 6 }],
  lava: [
    { position: [-2, -1, 0], color: '#ff6010', intensity: 3.4, distance: 4 },
    { position: [2, -1, 0], color: '#ff6010', intensity: 3.4, distance: 4 },
  ],
  fill: SECURITY_WORLD.lights.fill,
  surface: SECURITY_WORLD.lights.surface,
};
const standard = () => ({ fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} as Record<string, THREE.IUniform> });

test("the sheen patch changes the standard material's fragment shader, after its lightmap", () => {
  const shader = standard();
  withBakedLight(shader, null);
  expect(shader.fragmentShader).not.toBe(THREE.ShaderLib.standard.fragmentShader);
  const at = shader.fragmentShader.indexOf('#include <lights_fragment_maps>');
  expect(shader.fragmentShader.indexOf('radiance += lightMapIrradiance', at)).toBeGreaterThan(at);
});

test("the relief patch changes the standard material's fragment shader, shading the lightmap before the sheen reads it", () => {
  const sheenOnly = standard();
  withBakedLight(sheenOnly, null);
  const shader = standard();
  withBakedLight(shader, bakedRelief(lights));
  expect(shader.fragmentShader).not.toBe(sheenOnly.fragmentShader);
  const maps = shader.fragmentShader.indexOf('#include <lights_fragment_maps>');
  const relief = shader.fragmentShader.indexOf('lightMapIrradiance += relief', maps);
  expect(relief).toBeGreaterThan(maps);
  expect(shader.fragmentShader.indexOf('radiance += lightMapIrradiance', maps)).toBeGreaterThan(relief);
  // It reads both normals, which three's standard shader still names so.
  for (const name of ['nonPerturbedNormal', 'geometryNormal', 'geometryPosition', 'getDistanceAttenuation']) {
    expect(THREE.ShaderLib.standard.fragmentShader + Object.values(THREE.ShaderChunk).join(), name).toContain(name);
  }
});

test('the relief carries every baked point light and the fill, in the arrays its shader declares', () => {
  const relief = bakedRelief(lights);
  const shader = standard();
  withBakedLight(shader, relief);
  expect(shader.fragmentShader).toContain('uniform vec3 bakedLightPosition[ 3 ]');
  expect(shader.uniforms.bakedLightPosition.value).toHaveLength(3);
  expect(shader.uniforms.bakedLightColor.value).toHaveLength(3);
  expect(shader.uniforms.bakedLightReach.value).toEqual([6, 4, 4]);
  // Colours as three's lights have them: linear, times the intensity.
  expect((shader.uniforms.bakedLightColor.value as THREE.Color[])[1].equals(new THREE.Color('#ff6010').multiplyScalar(3.4))).toBe(true);
  // The fill shines from its position toward the origin, as three's directional light does.
  const [x, y, z] = SECURITY_WORLD.lights.fill.position;
  expect((shader.uniforms.bakedFillDirection.value as THREE.Vector3).distanceTo(new THREE.Vector3(x, y, z).normalize())).toBeLessThan(1e-9);
});
