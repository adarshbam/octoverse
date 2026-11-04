import { expect, test } from 'vitest';
import { ARM_IDS } from '../../engine/config/types';
import { clampCharacterConfig } from '../../engine/config/validate';
import { faceAnchor, validateBundle } from '../../engine/types/bundle';
import { FLUX_BUNDLE } from './bundle';
import { FLUX } from './character';
import { VEYRA } from '../veyra/character';
import { FLUX_POSES } from './poses';
import { FLUX_STROKE_SECONDS } from './sequences/defaults';
import targets from './review/targets.json';

// Flux's bundle (spec 6.2, 7.1, 7.8, 7.10): the shape checks the engine's validateBundle does not
// make for us, and the values the spec fixes for the head and the face anchor. That `?world=flux`
// resolves to this bundle is held in src/worlds/index.test.ts: a world's tests may not import the registry.

test('the bundle is one the engine can draw', () => {
  expect(() => validateBundle(FLUX_BUNDLE)).not.toThrow();
  expect(FLUX_BUNDLE.id).toBe('flux');
  expect(FLUX_BUNDLE.character).toBe(FLUX);
});

test('the intro pose has exactly the eight arms', () => {
  expect(Object.keys(FLUX_POSES.intro.arms)).toEqual([...ARM_IDS]);
});

test('the head: dome half width 0.70 to 0.78, top 0.22 to 0.30, small cheek lobes (spec 2.2)', () => {
  expect(FLUX.head.halfWidth).toBeGreaterThanOrEqual(0.7);
  expect(FLUX.head.halfWidth).toBeLessThanOrEqual(0.78);
  expect(FLUX.head.top).toBeGreaterThanOrEqual(0.22);
  expect(FLUX.head.top).toBeLessThanOrEqual(0.3);
  expect(FLUX.head.cheeks.radius).toBeGreaterThanOrEqual(0.06);
  expect(FLUX.head.cheeks.radius).toBeLessThanOrEqual(0.1);
});

test('the face anchor in the intro is at the eyes, y -0.54 within 0.05', () => {
  // faceAnchor is a Vec3 [x, y, z]: y is the second.
  const [, y] = faceAnchor(FLUX_BUNDLE, 'intro');
  expect(Math.abs(y - -0.54)).toBeLessThanOrEqual(0.05);
});

test("the character's own values are inside the engine's clamp: clamping changes nothing", () => {
  expect(clampCharacterConfig(FLUX)).toEqual(FLUX);
});

test('twelve technologies (spec 7.10), chosen in the overview only (ruling R1)', () => {
  expect(FLUX_BUNDLE.content.technologies.length).toBe(12);
  expect(FLUX_BUNDLE.artifacts.choosableIn).toEqual(['overview']);
});

test("the entrance's stroke is Flux's own stroke: recovery + power + glide (spec 7.8)", () => {
  const { recovery, power, glide } = FLUX.personality.swim;
  expect(recovery + power + glide).toBeCloseTo(FLUX_STROKE_SECONDS, 9);
});

test('every piece of storyboard copy is flagged as a placeholder, and the Live Demo link is labelled', () => {
  const { project } = FLUX_BUNDLE.content;
  expect(project.technologyUsages!.length).toBe(12);
  expect(project.technologyUsages!.every(u => u.placeholder === true)).toBe(true);
  expect(project.sections!.every(s => s.placeholder === true)).toBe(true);
  expect(project.sections!.map(s => s.title)).toEqual(['Overview', 'Features', 'Tech Stack', 'Architecture', 'Challenges', 'What I Learned']);
  expect(project.links!.find(l => l.kind === 'live')!.label).toBe('Live Demo');
});

// Task 3: Flux's jelly body, sparkles and cups (spec 7.2). The colour samples are the spec 2.1
// measurements of panel 2, read from the review targets (colour truth), compared as CIE76 delta E.

const sample = (name: string): readonly [number, number, number] => {
  const s = targets.samples.find(t => t.name === name);
  if (!s) throw new Error(`no sample ${name}`);
  return s.rgb as [number, number, number];
};

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** sRGB (0-255) to CIE Lab, D65. */
const toLab = ([r, g, b]: readonly [number, number, number]): [number, number, number] => {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / 0.95047;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

const deltaE76 = (hex: string, rgb: readonly [number, number, number]): number => {
  const a = toLab(hexToRgb(hex));
  const b = toLab(rgb);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
};

const surfaces = FLUX.skin.surfaces!;

test('the mantle and the arms are jelly, with sparkles (spec 7.2)', () => {
  expect(surfaces.mantle.mode).toBe('jelly');
  expect(surfaces.arms.mode).toBe('jelly');
  expect(surfaces.mantle.jelly).toBeDefined();
  expect(surfaces.arms.jelly).toBeDefined();
  expect(surfaces.mantle.sparkle).toBeGreaterThanOrEqual(40);
  expect(surfaces.arms.sparkle).toBeGreaterThan(0);
});

test("the sparkles are denser than Veyra's on both surfaces (spec 7.2; 'twinkling faster' has no config field)", () => {
  const veyra = VEYRA.skin.surfaces!;
  expect(surfaces.mantle.sparkle).toBeGreaterThan(veyra.mantle.sparkle);
  expect(surfaces.arms.sparkle).toBeGreaterThan(veyra.arms.sparkle);
});

test('the core sits just below the mouth, glowing warm', () => {
  const j = surfaces.mantle.jelly!;
  expect(j.coreCenter[1]).toBeLessThan(0);
  expect(j.coreWarmth).toBeGreaterThanOrEqual(1);
});

test.each([
  ['mantle crown', () => surfaces.mantle.jelly!.crown, 'crown'],
  ['mantle depth (head middle)', () => surfaces.mantle.jelly!.depth, 'headMiddle'],
  ['mantle core (face glow)', () => surfaces.mantle.jelly!.core, 'faceGlow'],
  ['mantle rim', () => surfaces.mantle.jelly!.rim, 'headRim'],
  ['arm rim (highlight)', () => surfaces.arms.jelly!.rim, 'armTopHighlight'],
  ['arm depth (body)', () => surfaces.arms.jelly!.depth, 'armBody'],
  ['cup rim', () => FLUX.suckers.style!.rim, 'cupGlow'],
  ['cup edge', () => FLUX.suckers.style!.edge, 'cupGlow'],
])('%s is within delta E 25 of the spec 2.1 sample', (_label, colour, name) => {
  expect(deltaE76(colour(), sample(name))).toBeLessThanOrEqual(25);
});

test('the glow light is violet #d070ff', () => {
  expect(FLUX.glow.light.color.toLowerCase()).toBe('#d070ff');
});

test('the cups are separate ovals with a glowing rim, not a frill (spec 7.2)', () => {
  const style = FLUX.suckers.style!;
  expect(style.scallop).toBeLessThanOrEqual(0.15);
  expect(style.rimWidth).toBeCloseTo(0.18, 9);
  expect(style.glow).toBeGreaterThanOrEqual(1);
});

test('no stray red: only the core, blush, mouth and cups have red above both green and blue', () => {
  // Allowed: the face glow's pink core (`core`, ramp stops 4 and 5), the blush, the mouth (`mouth*`, `tongue`: P2's red-pink mouth), and the cups.
  const allowed = /core|blush|mouth|tongue|sucker|style\.(edge|rim|hollow)|glow\.ramp\[[45]\]/i;
  const strays: string[] = [];
  const walk = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      if (/^#[0-9a-f]{6}$/i.test(value)) {
        const [r, g, b] = hexToRgb(value);
        if (r > g && r > b && !allowed.test(path)) strays.push(`${path} ${value}`);
      }
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}[${i}]`));
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(FLUX, '');
  expect(strays).toEqual([]);
});
