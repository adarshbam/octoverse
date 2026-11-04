import { expect, test } from 'vitest';
import * as THREE from 'three';
import { SECURITY_WORLD } from '../../worlds/nox/place/config';
import { GLOW_GLSL, type GlowParams, glowBrightest, glowPulse, makeGlowMaterial } from './glowMaterial';
import { KIT_MATERIAL_IDS, KIT_MATERIAL_VARIANTS, type KitMaterialAssignment, kitMaterialBrightest, kitMaterialFor, makeKitMaterial } from './kitMaterials';
import { MEMBRANE_GLSL, type MembraneParams, makeMembraneMaterial, membraneBrightest, membraneFlow } from './membraneMaterial';
import type { WorldConfig } from './types';
import { validateWorld } from './validateWorld';

const MEMBRANE: MembraneParams = { color: '#0a5a6a', edge: '#40d8e8', flowSpeed: 0.08, flowScale: 1, flash: 0.25 };
const GLOW: GlowParams = { color: '#30e0a0', strength: 1.2, tips: 1.1, pulse: 0.3, period: 7 };

/** A material's shader as three would hand it to onBeforeCompile: the built-in program's text for its type, and fresh uniforms. */
function compiled(material: THREE.Material, lib: 'lambert' | 'standard') {
  const shader = { vertexShader: THREE.ShaderLib[lib].vertexShader, fragmentShader: THREE.ShaderLib[lib].fragmentShader, uniforms: {} as Record<string, THREE.IUniform> };
  material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, undefined as unknown as THREE.WebGLRenderer);
  return shader;
}

test('the kit-material variants are a closed table: membrane, glow and led', () => {
  expect(KIT_MATERIAL_IDS).toEqual(['membrane', 'glow', 'led']);
  expect(Object.keys(KIT_MATERIAL_VARIANTS)).toEqual(KIT_MATERIAL_IDS);
});

test('membraneFlow(t) stays in [0, 1], wraps once a cycle and holds at speed 0', () => {
  const ts = [0, 0.001, 1, 7.25, 12.5, 59.99, 3600, 86400 * 30, -1, -12.3, 1e12, -1e12, Number.MAX_VALUE, Infinity, -Infinity, NaN];
  for (const speed of [0, 0.08, 0.5, 1, 3]) {
    for (const t of ts) {
      const f = membraneFlow(t, speed);
      expect(f, `t ${t} speed ${speed}`).toBeGreaterThanOrEqual(0);
      expect(f, `t ${t} speed ${speed}`).toBeLessThanOrEqual(1);
    }
  }
  for (let t = 0; t < 40; t += 0.37) expect(membraneFlow(t, 0.25)).toBeCloseTo(membraneFlow(t + 4, 0.25), 9);
  expect(membraneFlow(2.5, 0.1)).toBeCloseTo(0.25, 12);
  expect(membraneFlow(123.4, 0)).toBe(0);
});

test('the membrane takes its colours and flow from its params; its program text is the same for any params and holds no colour', () => {
  const a = makeMembraneMaterial(MEMBRANE);
  const b = makeMembraneMaterial({ color: '#203040', edge: '#a0b0c0', flowSpeed: 1, flowScale: 2, flash: 0 });
  expect(a.uniforms.uMembraneColor.value.getHexString()).toBe('0a5a6a');
  expect(a.uniforms.uMembraneEdge.value.getHexString()).toBe('40d8e8');
  expect(a.uniforms.uFlowScale.value).toBe(1);
  expect(a.uniforms.uFlashCap.value).toBe(1.25);
  const sa = compiled(a.material, 'lambert');
  const sb = compiled(b.material, 'lambert');
  expect(sa.vertexShader).toBe(sb.vertexShader);
  expect(sa.fragmentShader).toBe(sb.fragmentShader);
  expect(a.material.customProgramCacheKey()).toBe(b.material.customProgramCacheKey());
  // Every splice landed (three's anchors are there), and the uniforms are the material's own objects.
  expect(sa.vertexShader).toContain('vFlow = uv1;');
  expect(sa.fragmentShader).toContain('uniform vec3 uMembraneEdge;');
  expect(sa.fragmentShader).toContain(MEMBRANE_GLSL);
  expect(sa.uniforms.uFlow).toBe(a.uniforms.uFlow);
  // No colour in the shader: no hex, no coloured float triple (the colours are uniforms).
  for (const glsl of [MEMBRANE_GLSL, GLOW_GLSL]) {
    expect(glsl).not.toMatch(/#[0-9a-fA-F]{6}\b|0x[0-9a-fA-F]{6}/);
    expect(glsl).not.toMatch(/vec[34]\(\s*[0-9.]+\s*,\s*[0-9.]+\s*,\s*[0-9.]+/);
  }
  // The flow moves with the world's time and holds while its motion does.
  a.update(12.5, 1);
  expect(a.uniforms.uFlow.value).toBeCloseTo(membraneFlow(12.5, 0.08), 12);
  a.update(12.5, 0);
  expect(a.uniforms.uFlow.value).toBe(0);
});

test("the membrane's brightest value is its brighter colour at a full flash, and the shader never draws more", () => {
  const lum = (hex: string) => {
    const c = new THREE.Color(hex);
    return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  };
  expect(membraneBrightest(MEMBRANE)).toBeCloseTo(lum('#40d8e8') * 1.25, 12);
  expect(membraneBrightest({ ...MEMBRANE, color: '#ffffff', flash: 0 })).toBeCloseTo(1, 12);
  // The level is capped at 1 + flash however far the emissive drive pushes it, and the strength is at most 1 before it.
  expect(MEMBRANE_GLSL).toContain('clamp(totalEmissiveRadiance.g, 0.0, uFlashCap)');
  expect(MEMBRANE_GLSL).toContain('* (0.32 + 0.68 * lit) * level');
  expect(MEMBRANE_GLSL).toContain('float lit = clamp(max(edge, lines), 0.0, 1.0);');
});

test('the glow pulses between 1 - pulse and 1 on each piece\'s own beat, holds at its middle when still, and only dims', () => {
  for (let t = 0; t < 30; t += 0.21) {
    for (const phase of [0, 1.3, 4]) {
      const f = glowPulse(GLOW, t, phase, 1);
      expect(f).toBeGreaterThanOrEqual(1 - GLOW.pulse - 1e-12);
      expect(f).toBeLessThanOrEqual(1 + 1e-12);
    }
  }
  expect(glowPulse(GLOW, 3, 0, 0)).toBeCloseTo(1 - GLOW.pulse / 2, 12);
  expect(glowPulse(GLOW, 0, 0, 1)).toBeCloseTo(glowPulse(GLOW, GLOW.period, 0, 1), 12);
  expect(glowBrightest(GLOW)).toBeCloseTo((0.2126 * new THREE.Color(GLOW.color).r + 0.7152 * new THREE.Color(GLOW.color).g + 0.0722 * new THREE.Color(GLOW.color).b) * 1.2, 12);
  const tips = makeGlowMaterial(GLOW);
  const even = makeGlowMaterial({ ...GLOW, tips: 0 });
  expect(tips.material.vertexColors).toBe(true);
  expect(tips.material.defines).toEqual({ TIPS: '' });
  expect(even.material.vertexColors).toBe(false);
  expect((tips.material as THREE.MeshStandardMaterial).emissive.getHexString()).toBe('30e0a0');
  expect((tips.material as THREE.MeshStandardMaterial).emissiveIntensity).toBe(1.2);
  const shader = compiled(tips.material, 'standard');
  expect(shader.fragmentShader).toContain(GLOW_GLSL);
  expect(shader.vertexShader).toContain('vGlowPhase = modelMatrix[3].x');
});

test('an assignment is found by node name, a piece\'s for its lod1; each variant measures its own brightest value', () => {
  const materials: KitMaterialAssignment[] = [
    { node: 'membrane', material: 'membrane', params: MEMBRANE },
    { node: 'glowplant_a', material: 'glow', params: GLOW },
  ];
  expect(kitMaterialFor(materials, 'membrane')?.material).toBe('membrane');
  expect(kitMaterialFor(materials, 'glowplant_a_lod1')?.node).toBe('glowplant_a');
  expect(kitMaterialFor(materials, 'arch')).toBeUndefined();
  expect(kitMaterialFor(undefined, 'membrane')).toBeUndefined();
  expect(kitMaterialBrightest(materials[0])).toBe(membraneBrightest(MEMBRANE));
  expect(kitMaterialBrightest(materials[1])).toBe(glowBrightest(GLOW));
  expect(makeKitMaterial(materials[0]).material).toBeInstanceOf(THREE.MeshLambertMaterial);
  expect(makeKitMaterial(materials[1]).material).toBeInstanceOf(THREE.MeshStandardMaterial);
});

test('validateWorld checks materials and attached nodes by name', () => {
  const base: WorldConfig = {
    ...SECURITY_WORLD,
    kit: { ...SECURITY_WORLD.kit, nodes: ['membrane', 'lock'], attached: [{ node: 'membrane', piece: 'pillar_a' }] },
    materials: [
      { node: 'membrane', material: 'membrane', params: MEMBRANE },
      { node: 'coral_0', material: 'glow', params: GLOW },
    ],
  };
  expect(validateWorld(base)).toEqual([]);
  // Nox assigns none and attaches none.
  expect(SECURITY_WORLD.materials).toBeUndefined();
  expect(SECURITY_WORLD.kit.attached).toBeUndefined();
  const problems = (world: WorldConfig) => validateWorld(world).join('\n');
  expect(problems({ ...base, kit: { ...base.kit, attached: [{ node: 'door', piece: 'pillar_a' }] } })).toMatch(/kit\.attached\[0\] names "door"/);
  expect(problems({ ...base, kit: { ...base.kit, attached: [{ node: 'membrane', piece: 'arch' }] } })).toMatch(/names the piece "arch", which is not in the kit/);
  expect(problems({ ...base, materials: [{ node: 'gate', material: 'glow', params: GLOW }] })).toMatch(/materials\[0\] \(gate\) names the kit node "gate"/);
  expect(problems({ ...base, materials: [base.materials![0], base.materials![0]] })).toMatch(/assigns "membrane" a second material/);
  expect(problems({ ...base, materials: [{ node: 'lock', material: 'neon' as 'glow', params: GLOW }] })).toMatch(/material "neon", which is not one of membrane, glow/);
  expect(problems({ ...base, materials: [{ node: 'membrane', material: 'membrane', params: { ...MEMBRANE, edge: 'cyan' } }] })).toMatch(/materials\[0\] \(membrane\)\.params\.edge is not a #rrggbb colour/);
  expect(problems({ ...base, materials: [{ node: 'membrane', material: 'membrane', params: { ...MEMBRANE, flowScale: 0 } }] })).toMatch(/flowScale must be above 0/);
  expect(problems({ ...base, materials: [{ node: 'lock', material: 'glow', params: { ...GLOW, pulse: 1.5 } }] })).toMatch(/pulse must be between 0 and 1/);
  expect(problems({ ...base, materials: [{ node: 'lock', material: 'glow', params: { ...GLOW, period: 0 } }] })).toMatch(/period must be above 0/);
  // A material on a node the page never draws (not laid out, not attached to a laid-out piece) is named.
  expect(problems({ ...base, materials: [{ node: 'lock', material: 'glow', params: GLOW }] })).toMatch(/materials\[0\] \(lock\) names "lock", which is neither laid out nor attached to a laid-out piece/);
  // Nox's chain is a kit piece in no layout group (the chains are drawn apart, without kit materials).
  expect(Object.values(SECURITY_WORLD.layout.groups).flat().some(p => p.piece === 'chain')).toBe(false);
  expect(problems({ ...base, materials: [{ node: 'chain', material: 'glow', params: GLOW }] })).toMatch(/materials\[0\] \(chain\) names "chain", which is neither laid out .* never drawn/);
  const offLayout = { ...base, kit: { ...base.kit, attached: [{ node: 'membrane', piece: 'chain' }] } };
  expect(problems(offLayout)).toMatch(/materials\[0\] \(membrane\) names "membrane", which is neither laid out/);
  // An emissive drive on a glow node would lift it past its measured brightest value: refused by name.
  const driven = (drive: 'emissive' | 'rotateZ') => ({ ...base, props: [{ id: 'flash', node: 'coral_0', drive }] });
  expect(problems(driven('emissive'))).toMatch(/props\[0\] \(flash\) drives the emissive of "coral_0", which has a glow material/);
  expect(validateWorld(driven('rotateZ'))).toEqual([]);
  // The membrane's flash rides the emissive drive (its shader caps the level), so that one is allowed.
  expect(validateWorld({ ...base, props: [{ id: 'flash', node: 'membrane', drive: 'emissive' }] })).toEqual([]);
});
