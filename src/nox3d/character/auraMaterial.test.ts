import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { auraColour, createAuraMaterial } from './auraMaterial';
import type { RGB } from './worldAccent';

/** Hue in degrees, 0 to 360. */
function hue([r, g, b]: RGB) {
  const max = Math.max(r, g, b);
  const span = max - Math.min(r, g, b);
  if (span === 0) return 0;
  const h = max === r ? (g - b) / span : max === g ? 2 + (b - r) / span : 4 + (r - g) / span;
  return (h * 60 + 360) % 360;
}

test('aura is magenta-violet above and deep red below', () => {
  const aura = NOX.glow.aura;
  const above = auraColour(0.5, aura);
  expect(hue(above)).toBeGreaterThan(270);
  expect(hue(above)).toBeLessThan(320);
  const below = auraColour(-1.2, aura);
  const h = hue(below);
  expect(h < 15 || h > 345).toBe(true);
  // Deep: a dark red, not a bright one.
  expect(Math.max(...below)).toBeLessThan(0.5);
});

test('the aura is its inner colour at and above the body centre, turning red only below it', () => {
  const aura = NOX.glow.aura;
  expect(auraColour(0, aura)).toEqual(auraColour(1, aura));
  // Redder all the way down.
  let last = -Infinity;
  for (let dy = 0; dy >= -2; dy -= 0.1) {
    const [r, , b] = auraColour(dy, aura);
    expect(r - b).toBeGreaterThanOrEqual(last - 1e-9);
    last = r - b;
  }
});

test('the aura card glows additively behind Nox and never writes depth', () => {
  const aura = NOX.glow.aura;
  const m = createAuraMaterial(aura);
  expect(m.transparent).toBe(true);
  expect(m.depthWrite).toBe(false);
  expect(m.depthTest).toBe(true);
  expect(m.blending).toBe(2); // THREE.AdditiveBlending
  expect(m.fog).toBe(false);
  expect(m.uniforms.uRadius.value).toBe(aura.radius);
  expect(m.uniforms.uStrength.value).toBe(aura.strength);
  expect(m.uniforms.uInner.value.getHexString()).toBe(aura.inner.slice(1));
  expect(m.uniforms.uLow.value.getHexString()).toBe(aura.low.slice(1));
});

test('where the aura turns red below the body is the config, not a constant', () => {
  const aura = NOX.glow.aura;
  expect(aura.belowStart).toBe(0.75);
  // All `low` from belowStart * radius below the middle; a nearer start reaches it sooner.
  expect(auraColour(-aura.belowStart * aura.radius, aura)).toEqual(auraColour(-5, aura));
  const near = { ...aura, belowStart: 0.25 };
  expect(auraColour(-0.25 * aura.radius, near)).toEqual(auraColour(-5, near));
  expect(auraColour(-0.25 * aura.radius, aura)).not.toEqual(auraColour(-5, aura));
  expect(createAuraMaterial(near).fragmentShader).toContain('smoothstep(0.0, 0.2500 * uRadius');
  expect(createAuraMaterial(aura).fragmentShader).toContain('smoothstep(0.0, 0.7500 * uRadius');
});
