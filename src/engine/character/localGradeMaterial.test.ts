import * as THREE from 'three';
import { expect, test } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import { GRADE_LAYERS, GRADE_ORDER, GRADE_RAMP, GRADE_START, createGradeGeometry, createGradeMaterial, gradeWeight, layerAlpha } from './localGradeMaterial';

test('grade weight is 1 at Nox and 0 beyond its radius, monotonic', () => {
  const grade = NOX.glow.grade;
  expect(gradeWeight(0, grade)).toBe(1);
  expect(gradeWeight(grade.radius, grade)).toBe(0);
  expect(gradeWeight(grade.radius * 1.5, grade)).toBe(0);
  let last = 1;
  for (let d = 0; d <= grade.radius; d += grade.radius / 50) {
    const w = gradeWeight(d, grade);
    expect(w).toBeLessThanOrEqual(last);
    last = w;
  }
  // Smooth at both ends: it leaves Nox and reaches 0 with no kink.
  expect(1 - gradeWeight(grade.radius * 0.02, grade)).toBeLessThan(0.002);
  expect(gradeWeight(grade.radius * 0.98, grade)).toBeLessThan(0.002);
});

test('the stacked layers add up to the full grade behind the last one', () => {
  for (const w of [0, 0.2, 0.55, 1]) {
    const a = layerAlpha(w, GRADE_LAYERS);
    // Each layer mixes toward the grade colour by a; all of them together by w.
    expect(1 - (1 - a) ** GRADE_LAYERS).toBeCloseTo(w, 9);
  }
});

test('the layers start 0.3 behind Nox\'s back and ramp evenly over a unit, each a disc wide enough for the radius', () => {
  const geometry = createGradeGeometry();
  const behind = geometry.getAttribute('aBehind');
  const layers = [...new Set(Array.from(behind.array as Float32Array).map(v => Math.round(v * 1e5) / 1e5))].sort((a, b) => a - b);
  expect(layers).toHaveLength(GRADE_LAYERS);
  expect(GRADE_START).toBe(0.3);
  expect(layers[0]).toBeCloseTo(GRADE_START, 5);
  expect(layers.at(-1)).toBeCloseTo(GRADE_START + GRADE_RAMP, 5);
  const steps = layers.slice(1).map((v, i) => v - layers[i]);
  for (const s of steps) expect(s).toBeCloseTo(GRADE_RAMP / (GRADE_LAYERS - 1), 4);
  // The unit disc's polygon still reaches past the radius once scaled by the material's margin.
  const position = geometry.getAttribute('position');
  let inner = Infinity;
  for (let i = 0; i < position.count; i += 3) {
    // Each triangle is centre, then two rim points: the edge's midpoint is the polygon's nearest reach.
    const mid = new THREE.Vector2((position.getX(i + 1) + position.getX(i + 2)) / 2, (position.getY(i + 1) + position.getY(i + 2)) / 2);
    inner = Math.min(inner, mid.length());
  }
  const m = createGradeMaterial(NOX.glow.grade, new THREE.Vector3());
  expect(inner * m.uniforms.uSize.value).toBeGreaterThan(NOX.glow.grade.radius);
  geometry.dispose();
  m.dispose();
});

test('the grade is drawn before every transparent layer, depth-tested, never writing depth, fog or tone mapping', () => {
  const grade = NOX.glow.grade;
  const glow = new THREE.Vector3(0.05, -0.97, 0.6);
  const m = createGradeMaterial(grade, glow);
  expect(GRADE_ORDER).toBeLessThanOrEqual(-1000);
  expect(m.transparent).toBe(true);
  expect(m.depthTest).toBe(true);
  expect(m.depthWrite).toBe(false);
  expect(m.fog).toBe(false);
  expect(m.toneMapped).toBe(false);
  expect(m.blending).toBe(THREE.NormalBlending);
  // It follows the face glow it is given, every frame, without copying it.
  expect(m.uniforms.uGlow.value).toBe(glow);
  // The grade colour is the config's sRGB hex, as linear.
  expect(m.uniforms.uColor.value.getHexString()).toBe(grade.color.slice(1));
  expect(m.uniforms.uColor.value.r).toBeCloseTo(new THREE.Color().setRGB(0x1c / 255, 6 / 255, 0x18 / 255, THREE.SRGBColorSpace).r, 9);
  expect(m.uniforms.uStrength.value).toBe(grade.strength);
  expect(m.uniforms.uRadius.value).toBe(grade.radius);
});
