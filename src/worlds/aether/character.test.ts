import * as THREE from 'three';
import { expect, test } from 'vitest';
import { createSkinMaterial, createSkinUniforms, surfaceLooks } from '../../engine/character/skinMaterial';
import { AETHER } from './character';
import targets from './review/targets.json';

// Aether's look on Veyra's variants (Task 3): jelly glass on the mantle and the arms, star specks
// over both, pink-white frill cups, and no red underside band. The colours are START values: each
// one that has a spec 2.1 sample sits within delta E 25 of it here; Task 6 meets delta E 10 on the
// render itself.

const sample = (name: string): number[] => {
  const s = targets.samples.find((t) => t.name === name);
  if (!s) throw new Error(`no sample named ${name}`);
  return s.rgb;
};

/** sRGB (0 to 255) to CIE L*a*b* (D65). */
function lab([r, g, b]: number[]): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 delta E between a hex colour and an sRGB sample. */
function deltaE(hex: string, rgb: number[]): number {
  const n = parseInt(hex.slice(1), 16);
  const [a, b] = [lab([(n >> 16) & 255, (n >> 8) & 255, n & 255]), lab(rgb)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

test('the mantle and the arms are both jelly', () => {
  expect(AETHER.skin.surfaces?.mantle.mode).toBe('jelly');
  expect(AETHER.skin.surfaces?.arms.mode).toBe('jelly');
});

test('each jelly and cup colour with a spec 2.1 sample is within delta E 25 of it (start values)', () => {
  const mantle = AETHER.skin.surfaces?.mantle.jelly;
  const arms = AETHER.skin.surfaces?.arms.jelly;
  const cups = AETHER.suckers.style;
  expect(mantle && arms && cups).toBeTruthy();
  const pairs: [string, string | undefined, string][] = [
    ['mantle crown', mantle?.crown, 'Crown sheen'],
    ['mantle depth', mantle?.depth, 'Upper dome'],
    ['mantle core', mantle?.core, 'Face glow below eyes'],
    ['arm rim', arms?.rim, 'Arm top rim'],
    ['arm depth', arms?.depth, 'Arm body upper'],
    ['arm core', arms?.core, 'Arm underside glow'],
    ['cup rim', cups?.rim, 'Cup'],
    ['cup hollow', cups?.hollow, 'Inside tip spiral'],
  ];
  for (const [what, hex, name] of pairs) {
    expect(hex, what).toBeDefined();
    expect(deltaE(hex!, sample(name)), `${what} against ${name}`).toBeLessThanOrEqual(25);
  }
});

test('no red underside band: glow.underside strength is 0', () => {
  expect(AETHER.glow.underside).toBe(0);
});

test('star specks on both surfaces', () => {
  expect(AETHER.skin.surfaces?.mantle.sparkle).toBeGreaterThan(0);
  expect(AETHER.skin.surfaces?.arms.sparkle).toBeGreaterThan(0);
});

// The engine's own tests may import only Nox (boundary.test.ts), so the second world's arms path is
// checked here, through the engine's material builder: an arm material from Aether's arms surface
// is jelly with her depth colour, and sparkles.
test("the arms jelly path is live for a second world: an arm material from Aether's arms surface", () => {
  const looks = surfaceLooks(AETHER.skin);
  const arm = createSkinMaterial('ARM', createSkinUniforms(AETHER), AETHER.palette.rimHot, undefined, looks.arms, AETHER.glow.center);
  expect(arm.defines).toEqual({ ARM: '', JELLY: '', SPARKLE: '' });
  expect(arm.uniforms.uJellyDepth.value).toEqual(new THREE.Color('#5e8ae4'));
  expect(arm.uniforms.uSparkle.value).toBeGreaterThan(0);
});
