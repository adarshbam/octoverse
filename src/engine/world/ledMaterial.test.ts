import * as THREE from 'three';
import { expect, test } from 'vitest';
import { SECURITY_WORLD } from '../../worlds/nox/place/config';
import { LED_EDGE_SECONDS, LED_GLSL, type LedParams, ledBrightest, ledLevel, ledRate, makeLedMaterial } from './ledMaterial';
import { kitMaterialBrightest, kitMaterialFor, makeKitMaterial } from './kitMaterials';
import type { WorldConfig } from './types';
import { validateWorld } from './validateWorld';

const LED: LedParams = { intensity: 1.4, rate: [0.5, 3], duty: 0.35 };

/** A material's shader as three would hand it to onBeforeCompile: the built-in program's text for its type, and fresh uniforms. */
function compiled(material: THREE.Material) {
  const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} as Record<string, THREE.IUniform> };
  material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, undefined as unknown as THREE.WebGLRenderer);
  return shader;
}

test('ledLevel is 0 or 1 away from its edges, with a 40 ms soft edge', () => {
  expect(LED_EDGE_SECONDS).toBe(0.04);
  const rate = 2;
  const duty = 0.4;
  // On well inside the duty, off well outside it (phase 0: the cycle starts at t = 0).
  expect(ledLevel(0.1, 0, rate, duty)).toBe(1);
  expect(ledLevel(0.15, 0, rate, duty)).toBe(1);
  expect(ledLevel(0.3, 0, rate, duty)).toBe(0);
  expect(ledLevel(0.45, 0, rate, duty)).toBe(0);
  // The edge is centred on the duty's end (cycle 0.4, t = 0.2): half way there, and 40 ms wide.
  expect(ledLevel(0.2, 0, rate, duty)).toBeCloseTo(0.5, 9);
  expect(ledLevel(0.2 - 0.0201, 0, rate, duty)).toBe(1);
  expect(ledLevel(0.2 + 0.0201, 0, rate, duty)).toBe(0);
  // Every value stays in [0, 1], and the edge takes 40 ms: samples 4 ms apart never jump by more than 0.35.
  let previous = ledLevel(0, 0.3, rate, duty);
  let soft = 0;
  for (let t = 0.004; t < 5; t += 0.004) {
    const level = ledLevel(t, 0.3, rate, duty);
    expect(level).toBeGreaterThanOrEqual(0);
    expect(level).toBeLessThanOrEqual(1);
    expect(Math.abs(level - previous)).toBeLessThan(0.35);
    if (level > 0 && level < 1) soft++;
    previous = level;
  }
  // Each of the 20 edges in 5 s is soft for about 40 ms (10 samples at 4 ms).
  expect(soft).toBeGreaterThan(120);
  expect(soft).toBeLessThan(280);
  // Periodic in 1 / rate.
  for (const t of [0.013, 0.2, 1.37]) expect(ledLevel(t + 1 / rate, 0.6, rate, duty)).toBeCloseTo(ledLevel(t, 0.6, rate, duty), 9);
});

test('ledLevel averages duty over 10 s within 0.05, for any phase and rate in range', () => {
  for (const duty of [0.1, 0.35, 0.5, 0.8]) {
    for (const rate of [0.5, 1.7, 3, 8]) {
      for (const phase of [0, 0.13, 0.5, 0.97]) {
        let sum = 0;
        const steps = 10000;
        for (let k = 0; k < steps; k++) sum += ledLevel((k + 0.5) * (10 / steps), phase, rate, duty);
        expect(Math.abs(sum / steps - duty), `duty ${duty} rate ${rate} phase ${phase}`).toBeLessThan(0.05);
      }
    }
  }
});

test('under reduced motion ledLevel is the constant duty', () => {
  for (const t of [0, 0.3, 7.7, 1e5]) for (const phase of [0, 0.4, 0.9]) expect(ledLevel(t, phase, 2, 0.35, 0)).toBe(0.35);
  const led = makeLedMaterial(LED);
  led.update(12.3, 0);
  expect(led.uniforms.uMotion.value).toBe(0);
  expect(led.uniforms.uLedDuty.value).toBe(0.35);
  expect(LED_GLSL).toContain('mix(uLedDuty');
});

test('each light has its own rate within the params range, from its phase', () => {
  const rates = Array.from({ length: 200 }, (_, k) => ledRate(k / 200, LED.rate));
  for (const r of rates) {
    expect(r).toBeGreaterThanOrEqual(0.5);
    expect(r).toBeLessThanOrEqual(3);
  }
  expect(Math.max(...rates) - Math.min(...rates)).toBeGreaterThan(2);
  expect(ledRate(0.31, LED.rate)).toBe(ledRate(0.31, LED.rate));
});

test('the led material takes colour from the vertex colour and phase from _phase; its program holds no colour', () => {
  const led = makeLedMaterial(LED);
  const other = makeLedMaterial({ intensity: 0.5, rate: [1, 2], duty: 0.6 });
  expect(led.material).toBeInstanceOf(THREE.MeshStandardMaterial);
  expect((led.material as THREE.MeshStandardMaterial).vertexColors).toBe(true);
  expect(led.uniforms.uLedDuty.value).toBe(0.35);
  expect(led.uniforms.uLedRate.value.toArray()).toEqual([0.5, 3]);
  const shader = compiled(led.material);
  expect(shader.vertexShader).toContain('attribute float _phase;');
  expect(shader.vertexShader).toContain('vLedPhase = _phase;');
  expect(shader.fragmentShader).toContain(LED_GLSL);
  expect(shader.fragmentShader).toContain('vColor');
  expect(shader.uniforms.uTime).toBe(led.uniforms.uTime);
  // One program for every led, whatever the params.
  expect(compiled(other.material).fragmentShader).toBe(shader.fragmentShader);
  expect(led.material.customProgramCacheKey()).toBe(other.material.customProgramCacheKey());
  expect(LED_GLSL).not.toMatch(/#[0-9a-fA-F]{6}\b|0x[0-9a-fA-F]{6}/);
  expect(LED_GLSL).not.toMatch(/vec[34]\(\s*[0-9.]+\s*,\s*[0-9.]+\s*,\s*[0-9.]+/);
  // The clock and whether motion runs.
  led.update(4.5, 1);
  expect(led.uniforms.uTime.value).toBe(4.5);
  expect(led.uniforms.uMotion.value).toBe(1);
});

test('the led brightest value is its intensity: a vertex colour is at most white', () => {
  expect(ledBrightest(LED)).toBe(1.4);
  expect(kitMaterialBrightest({ node: 'tower_a', material: 'led', params: LED })).toBe(1.4);
  expect(makeKitMaterial({ node: 'tower_a', material: 'led', params: LED }).material).toBeInstanceOf(THREE.MeshStandardMaterial);
  expect(kitMaterialFor([{ node: 'tower_a', material: 'led', params: LED }], 'tower_a_lod1')?.material).toBe('led');
});

test('a world assigning led validates; a missing node fails with the node name; bad params are named', () => {
  const base: WorldConfig = { ...SECURITY_WORLD, materials: [{ node: 'pillar_a', material: 'led', params: LED }] };
  expect(validateWorld(base)).toEqual([]);
  const problems = (materials: WorldConfig['materials']) => validateWorld({ ...base, materials }).join('\n');
  expect(problems([{ node: 'tower_z', material: 'led', params: LED }])).toContain('materials[0] (tower_z) names the kit node "tower_z", which is not in the kit');
  const bad = (params: Partial<LedParams>) => problems([{ node: 'pillar_a', material: 'led', params: { ...LED, ...params } }]);
  expect(bad({ intensity: -1 })).toContain('.params.intensity must be 0 or more');
  expect(bad({ duty: 0 })).toContain('.params.duty must be above 0 and below 1');
  expect(bad({ duty: 1 })).toContain('.params.duty must be above 0 and below 1');
  expect(bad({ rate: [3, 0.5] })).toContain('.params.rate must be two rates above 0, the slower first');
  expect(bad({ rate: [0, 2] })).toContain('.params.rate');
  expect(bad({ rate: [1] as unknown as LedParams['rate'] })).toContain('.params.rate');
  expect(bad({ rate: undefined })).toContain('.params.rate');
  expect(problems([{ node: 'pillar_a', material: 'neon' as 'led', params: LED }])).toContain('which is not one of membrane, glow, led');
});

test('an emissive drive on a led node is refused by name: a led sets its own level', () => {
  const base: WorldConfig = { ...SECURITY_WORLD, materials: [{ node: 'pillar_a', material: 'led', params: LED }] };
  const driven = (drive: 'emissive' | 'rotateZ'): WorldConfig => ({ ...base, props: [{ id: 'flash', node: 'pillar_a', drive }] });
  expect(validateWorld(driven('emissive')).join('\n')).toContain('props[0] (flash) drives the emissive of "pillar_a", which has a led material');
  expect(validateWorld(driven('rotateZ'))).toEqual([]);
});
