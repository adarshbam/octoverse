import { expect, test } from 'vitest';
import type { WorldLight } from '../world/types';
import {
  ACCENT_GLSL,
  ACCENT_LIGHTS,
  CAUSTIC_CAP,
  HAZE_FROM,
  type RGB,
  WORLD_WARMTH_CAP,
  capAccent,
  createAccentUniforms,
  farHaze,
  pickAccentLights,
  warmthMask,
  worldAccent,
  writeAccentLights,
} from './worldAccent';

const luma = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const seeded = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('capAccent leaves small accents unchanged', () => {
  const base: RGB = [0.4, 0.05, 0.25];
  const add: RGB = [0.01, 0.001, 0.004];
  expect(luma(add)).toBeLessThan(WORLD_WARMTH_CAP * luma(base));
  expect(capAccent(base, add, WORLD_WARMTH_CAP)).toEqual(add);
  expect(capAccent(base, [0, 0, 0], WORLD_WARMTH_CAP)).toEqual([0, 0, 0]);
});

test('capAccent never adds more than 10% luminance', () => {
  expect(WORLD_WARMTH_CAP).toBe(0.1);
  const random = seeded(11);
  for (let i = 0; i < 1000; i++) {
    const base: RGB = [random(), random() * 0.3, random()];
    const add: RGB = [random() * 2, random() * 0.5, random() * 2];
    const out = capAccent(base, add, WORLD_WARMTH_CAP);
    expect(luma(out)).toBeLessThanOrEqual(0.1 * luma(base) + 1e-6);
    // Scaled, never re-tinted: the accent keeps its own hue.
    const scale = out[0] / add[0];
    expect(out[1]).toBeCloseTo(add[1] * scale, 9);
    expect(out[2]).toBeCloseTo(add[2] * scale, 9);
  }
});

test('caustics are capped at 5%', () => {
  expect(CAUSTIC_CAP).toBe(0.05);
  const random = seeded(23);
  for (let i = 0; i < 1000; i++) {
    const base: RGB = [random(), random() * 0.3, random()];
    // The surface light is blue; its caustic lines push well past 1.
    const add: RGB = [random() * 0.5, random(), random() * 3];
    expect(luma(capAccent(base, add, CAUSTIC_CAP))).toBeLessThanOrEqual(0.05 * luma(base) + 1e-6);
  }
});

test('warmth mask is zero on the face, the crown and the rim, one on the underside', () => {
  expect(warmthMask('HEAD', 0.9, 0.8, 0)).toBe(0);
  expect(warmthMask('HEAD', -0.5, 0.8, 1)).toBe(0);
  expect(warmthMask('ARM', -0.6, 0.05, 0)).toBe(0);
  expect(warmthMask('ARM', -0.6, 0.8, 0)).toBe(1);
  // The arm's neon rim is still a fifth of its colour at n·v 0.6.
  expect(warmthMask('ARM', -0.6, 0.6, 0)).toBe(0);
  // Sides take warmth too; only the head has a face.
  expect(warmthMask('ARM', 0, 0.8, 0)).toBe(1);
  expect(warmthMask('ARM', -0.6, 0.8, 1)).toBe(1);
  expect(warmthMask('ARM', 0.9, 0.8, 0)).toBe(0);
});

test('fades come after the caps: a 4% mask under strong light gives at most 4% of the cap', () => {
  const base: RGB = [0.1, 0.02, 0.08];
  const strong: RGB = [50, 1, 10];
  const none: RGB = [0, 0, 0];
  expect(luma(worldAccent(base, strong, 0.04, none, 0, 1))).toBeLessThanOrEqual(0.04 * WORLD_WARMTH_CAP * luma(base) + 1e-12);
  expect(luma(worldAccent(base, none, 0, strong, 0.04, 1))).toBeLessThanOrEqual(0.04 * CAUSTIC_CAP * luma(base) + 1e-12);
  // A mask of 0 lets nothing through, nor does Nox's own glow.
  expect(worldAccent(base, strong, 0, strong, 0, 1)).toEqual([0, 0, 0]);
  expect(worldAccent(base, strong, 1, strong, 1, 0)).toEqual([0, 0, 0]);
  // Unmasked, warmth and caustics together stay within the warmth cap.
  const random = seeded(5);
  for (let i = 0; i < 1000; i++) {
    const b: RGB = [random(), random() * 0.3, random()];
    const w: RGB = [random() * 2, random() * 0.5, random() * 2];
    const c: RGB = [random() * 0.5, random(), random() * 3];
    const out = worldAccent(b, w, random(), c, random(), random());
    expect(luma(out)).toBeLessThanOrEqual(WORLD_WARMTH_CAP * luma(b) + 1e-6);
  }
});

const light = (x: number, y: number, z: number): WorldLight => ({ kind: 'glyph', position: [x, y, z], color: '#ff2436', intensity: 1, distance: 2, skinRange: 4 });

test('picks the eight nearest lights', () => {
  expect(ACCENT_LIGHTS).toBe(8);
  const lights = [9, 1, 7, 3, 10, 5, 2, 8, 4, 6].map(d => light(0, 0, -d));
  const picked = pickAccentLights(lights, [0, 0, 0]);
  expect(picked.map(l => -l.position[2])).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  // Measured from `at`, in all three axes.
  expect(pickAccentLights([light(0, 5, 0), light(4, 0, 0), light(0, 0, 3)], [0, 0, 0], 2).map(l => l.position)).toEqual([[0, 0, 3], [4, 0, 0]]);
  expect(pickAccentLights(lights.slice(0, 3), [0, 0, -9])).toHaveLength(3);
});

test('unused accent light slots go dark', () => {
  const u = createAccentUniforms();
  const lights = [light(1, 2, 3), { ...light(-1, 0, 0), color: '#ffffff', intensity: 2, skinRange: 6 }];
  writeAccentLights(u, lights);
  expect(u.uAccentPos.value[1].toArray()).toEqual([-1, 0, 0]);
  expect(u.uAccentColor.value[1].toArray()).toEqual([2, 2, 2]);
  expect(u.uAccentRange.value.slice(0, 2)).toEqual([4, 6]);
  writeAccentLights(u, lights.slice(0, 1));
  expect(u.uAccentColor.value[1].toArray()).toEqual([0, 0, 0]);
  for (let k = 1; k < ACCENT_LIGHTS; k++) expect(u.uAccentColor.value[k].toArray()).toEqual([0, 0, 0]);
});

test('zero accents leave the shader output unchanged', () => {
  const u = createAccentUniforms();
  // Every accent's strength defaults to zero.
  expect(u.uAccentWarmth.value.toArray()).toEqual([0, 0, 0]);
  expect(u.uCausticLight.value.toArray()).toEqual([0, 0, 0]);
  expect(u.uFarHaze.value).toBe(0);
  for (const c of u.uAccentColor.value) expect(c.toArray()).toEqual([0, 0, 0]);
  // Nothing divides by zero on the default path: a light's reach and the surface direction are never zero.
  expect(u.uAccentRange.value.every(r => r > 0)).toBe(true);
  expect(u.uSurfaceDir.value.length()).toBe(1);

  // The chunk changes the colour in exactly two places: it adds the capped accent, and it mixes in
  // the far haze.
  const writes = ACCENT_GLSL.match(/\bcol\s*[-+*/]?=[^;]*;/g);
  expect(writes).toEqual(['col += accent;', 'col = mix(col, uFarHazeColor, farHaze(length(cameraPosition - vWorld), uFarHaze));']);
  // The accent is built only from warmth and caustics, each a product with its zero-default
  // strength, capped first and faded after.
  expect(ACCENT_GLSL).toMatch(/vec3 warmth = warmthMask\(N\.y, ndv, inFace\) \* capAccent\(col, light \* uAccentWarmth, WORLD_WARMTH_CAP\);/);
  expect(ACCENT_GLSL).toMatch(/vec3 caustic = fromAbove \* awayFromRim\(ndv\) \* capAccent\(col, uCausticLight \*[^;]*, CAUSTIC_CAP\);/);
  expect(ACCENT_GLSL).toMatch(/vec3 accent = clearOfGlow \* capAccent\(col, warmth \+ caustic, WORLD_WARMTH_CAP\);/);
  // The GLSL caps are the TypeScript ones.
  expect(ACCENT_GLSL).toContain(`#define WORLD_WARMTH_CAP ${WORLD_WARMTH_CAP}`);
  expect(ACCENT_GLSL).toContain(`#define CAUSTIC_CAP ${CAUSTIC_CAP}`);
  expect(ACCENT_GLSL).toContain('#define HAZE_FROM 18.0');
});

test('far haze is zero within HAZE_FROM of the camera', () => {
  expect(HAZE_FROM).toBe(18);
  for (const density of [0, 0.034, 0.2, 1, 10]) {
    for (const distance of [0, 5, 12, 17.99, 18]) expect(farHaze(distance, density)).toBe(0);
  }
  // Beyond it, haze rises with distance, and only with a density set.
  expect(farHaze(30, 0)).toBe(0);
  expect(farHaze(20, 0.05)).toBeGreaterThan(0);
  expect(farHaze(40, 0.05)).toBeGreaterThan(farHaze(20, 0.05));
  expect(farHaze(1e4, 0.05)).toBeLessThanOrEqual(1);
});
