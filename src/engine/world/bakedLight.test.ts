import * as THREE from 'three';
import { expect, test } from 'vitest';
import { type Relief, withBakedLight } from './bakedLight';

// The patches find their place by a chunk's include line; were three to rename the chunk, a patch
// would quietly change nothing. These check each one still lands in three's standard material.

const relief = (): Relief => ({ map: new THREE.Texture(), scale: 0.5 });
const standard = () => ({ fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} as Record<string, THREE.IUniform> });
const gate = { value: 1 };
const loops = (glsl: string) => glsl.match(/\bfor\s*\(/g)?.length ?? 0;

test("the sheen patch changes the standard material's fragment shader, after its lightmap", () => {
  const shader = standard();
  withBakedLight(shader, null, gate);
  expect(shader.fragmentShader).not.toBe(THREE.ShaderLib.standard.fragmentShader);
  const at = shader.fragmentShader.indexOf('#include <lights_fragment_maps>');
  expect(shader.fragmentShader.indexOf('radiance += lightMapIrradiance', at)).toBeGreaterThan(at);
});

test("the relief patch changes the standard material's fragment shader, shading the lightmap before the sheen reads it", () => {
  const sheenOnly = standard();
  withBakedLight(sheenOnly, null, gate);
  const shader = standard();
  withBakedLight(shader, relief(), gate);
  expect(shader.fragmentShader).not.toBe(sheenOnly.fragmentShader);
  const maps = shader.fragmentShader.indexOf('#include <lights_fragment_maps>');
  const shaded = shader.fragmentShader.indexOf('lightMapIrradiance += relief', maps);
  expect(shaded).toBeGreaterThan(maps);
  expect(shader.fragmentShader.indexOf('radiance += lightMapIrradiance', maps)).toBeGreaterThan(shaded);
  // It reads both normals and the lightmap's UVs, which three's standard shader still names so.
  for (const name of ['nonPerturbedNormal', 'geometryNormal', 'vLightMapUv', 'BRDF_GGX']) {
    expect(THREE.ShaderLib.standard.fragmentShader + Object.values(THREE.ShaderChunk).join(), name).toContain(name);
  }
});

test('the relief reads its map through the lightmap UVs, with no loop over lights', () => {
  const r = relief();
  const shader = standard();
  withBakedLight(shader, r, gate);
  expect(shader.fragmentShader).toContain('uniform sampler2D bakedReliefMap;');
  expect(shader.fragmentShader).toContain('texture2D( bakedReliefMap, vLightMapUv )');
  // R36: no per-fragment light loop, so no light arrays (which could not be declared empty).
  const sheenOnly = standard();
  withBakedLight(sheenOnly, null, gate);
  expect(loops(shader.fragmentShader)).toBe(loops(sheenOnly.fragmentShader));
  expect(shader.fragmentShader).not.toMatch(/uniform \w+ \w+\[/);
  expect(shader.uniforms.bakedReliefMap.value).toBe(r.map);
  expect(shader.uniforms.bakedReliefScale.value).toBe(0.5);
});

test('each relief has uniforms of its own, so materials sharing a program keep their own maps', () => {
  const [a, b] = [standard(), standard()];
  const [ra, rb] = [relief(), relief()];
  withBakedLight(a, ra, gate);
  withBakedLight(b, rb, gate);
  expect(a.fragmentShader).toBe(b.fragmentShader);
  expect(a.uniforms.bakedReliefMap).not.toBe(b.uniforms.bakedReliefMap);
  // The gate is the instance's own object, shared by every material of that instance.
  expect(a.uniforms.bakedReliefOn).toBe(gate);
  expect(b.uniforms.bakedReliefOn).toBe(gate);
  expect(b.uniforms.bakedReliefMap.value).toBe(rb.map);
});
