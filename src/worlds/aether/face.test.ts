import { expect, test } from 'vitest';
import { EXPRESSIONS, EXPRESSION_IDS, resolveExpressions } from '../../engine/behavior/expressions';
import { mouthShape } from '../../engine/character/mouthShape';
import { clampCharacterConfig } from '../../engine/config/validate';
import { AETHER } from './character';
import { AETHER_POSES, INTRO_TRACED } from './poses';
import targets from './review/targets.json';

// Aether's face (Task 4, spec 2.3 and 7.3): violet eyes with two catchlights and two short lashes
// at each outer corner, thin brows set high, pink blush, and her faces as overrides of the base
// table (amendment A1, G1: no new ids). `curious` is her "wonder" (P4): brows up, eyes open, an
// "ooh"-smile with the tongue showing.

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

const hexRgb = (hex: string): number[] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** CIE76 delta E between a hex colour and an sRGB sample. */
function deltaE(hex: string, rgb: number[]): number {
  const [a, b] = [lab(hexRgb(hex)), lab(rgb)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

test('curious is her wonder: brows up, eyes open, an open "ooh"-smile with some blush', () => {
  const faces = resolveExpressions(AETHER);
  expect(faces.curious.mouthOpen).toBe(0.7);
  expect(faces.curious.browLift).toBe(0.55);
  expect(faces.curious).toEqual({ ...EXPRESSIONS.curious, browLift: 0.55, browTilt: 0.1, lidRest: 0, mouthCurve: 0.85, mouthOpen: 0.7, blush: 0.35 });
});

test('gentle is a soft closed smile and happy an open one', () => {
  const faces = resolveExpressions(AETHER);
  expect(faces.gentle.mouthOpen).toBe(0);
  expect(faces.gentle.mouthCurve).toBeGreaterThan(0);
  expect(faces.happy.mouthOpen).toBeGreaterThanOrEqual(0.3);
  expect(faces.happy.mouthOpen).toBeLessThan(faces.curious.mouthOpen);
  expect(faces.happy.mouthCurve).toBeGreaterThanOrEqual(0.7);
});

test('only gentle, happy and curious are hers; focused and every other face is the base one', () => {
  const faces = resolveExpressions(AETHER);
  expect(faces.focused).toEqual(EXPRESSIONS.focused);
  expect(Object.keys(AETHER.expressions ?? {}).sort()).toEqual(['curious', 'gentle', 'happy']);
  for (const id of EXPRESSION_IDS) if (!['curious', 'gentle', 'happy'].includes(id)) expect(faces[id], id).toEqual(EXPRESSIONS[id]);
  // Her values are already in the range the face can draw.
  expect(clampCharacterConfig(AETHER).expressions).toEqual(AETHER.expressions);
});

test('the intro wears the soft smile', () => {
  expect(AETHER_POSES.intro.expression).toBe('gentle');
});

test("the centre arms are rooted below her widest-open mouth, so they never cover it or the tongue", () => {
  // At y -1.0 the roots' tops hid the lower half of the wonder mouth (Task 4's capture); at -1.14 it shows whole.
  const faces = resolveExpressions(AETHER);
  const lowest = Math.min(...EXPRESSION_IDS.map((id) => mouthShape(AETHER.face.mouth, faces[id].mouthCurve, faces[id].mouthOpen).lower?.bottom ?? 0));
  const mouthBottom = AETHER.head.faceOrigin[1] + lowest;
  for (const id of ['T4', 'T5'] as const) expect(INTRO_TRACED[id][0][1], id).toBeLessThanOrEqual(mouthBottom - 0.08);
});

test('two short lashes at each outer corner', () => {
  const { lashes } = AETHER.face.eye;
  expect(lashes).toHaveLength(2);
  // Outer corner: both sit past the eye's middle toward the outer side, and stay short.
  for (const lash of lashes) {
    expect(lash.at).toBeGreaterThan(0.5);
    expect(lash.length).toBeLessThan(AETHER.face.eye.rx * 0.5);
  }
});

test('two catchlights, a large one and a small one, both high on the pupil (P2, P3, P4 at 3x)', () => {
  const [big, small] = AETHER.face.eye.catchlights;
  expect(AETHER.face.eye.catchlights).toHaveLength(2);
  expect(big.r).toBeGreaterThanOrEqual(small.r * 1.5);
  expect(big.y).toBeGreaterThan(0);
  expect(small.y).toBeGreaterThan(0);
  // Large on the left, small on the right, as painted.
  expect(big.x).toBeLessThan(0);
  expect(small.x).toBeGreaterThan(0);
});

test('violet iris: near-black at the top, magenta-pink at the bottom', () => {
  const [top, middle, bottom] = AETHER.facePalette.iris.map(hexRgb);
  expect(Math.max(...top)).toBeLessThan(70);
  expect(lab(hexRgb(AETHER.facePalette.iris[0]))[0]).toBeLessThan(15);
  // Violet in the middle (blue over green, red over green), magenta-pink below (red high, blue high, green low).
  expect(middle[2]).toBeGreaterThan(middle[1]);
  expect(middle[0]).toBeGreaterThan(middle[1]);
  expect(bottom[0]).toBeGreaterThanOrEqual(200);
  expect(bottom[2]).toBeGreaterThan(bottom[1] + 80);
});

test('thin brows set high', () => {
  const { brow, eye } = AETHER.face;
  expect(brow.thickness).toBeLessThanOrEqual(0.025);
  // The brow's lowest end stays clear of the eye's top by at least half an eye radius.
  const eyeTop = eye.centers[1][1] + eye.ry;
  expect(Math.min(brow.inner[1], brow.outer[1]) - eyeTop).toBeGreaterThanOrEqual(eye.ry * 0.5);
});

test('blush, tongue and mouth inside are within delta E 10 of the P2 and P4 samples', () => {
  const p = AETHER.facePalette;
  expect(p.blush).toBe('#fab7ce');
  expect(p.tongue).toBe('#fd878f');
  expect(p.mouthInside).toBe('#771d49');
  expect(deltaE(p.blush, sample('Blush'))).toBeLessThanOrEqual(targets.deltaE);
  expect(deltaE(p.tongue, sample('Open-mouth tongue'))).toBeLessThanOrEqual(targets.deltaE);
  expect(deltaE(p.mouthInside, sample('Open-mouth inside'))).toBeLessThanOrEqual(targets.deltaE);
});
