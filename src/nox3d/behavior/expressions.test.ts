import { expect, test } from 'vitest';
import { FaceCanvas } from '../character/FaceCanvas';
import { NOX } from '../config/nox.character';
import { EXPRESSIONS, type FaceParams, blendExpression } from './expressions';

test('blendExpression is endpoint exact and linear', () => {
  expect(blendExpression(EXPRESSIONS.gentle, EXPRESSIONS.gentle, 0.5)).toEqual(EXPRESSIONS.gentle);
  const open = { ...EXPRESSIONS.gentle, mouthOpen: 1 };
  expect(blendExpression(EXPRESSIONS.gentle, open, 0).mouthOpen).toBe(0);
  expect(blendExpression(EXPRESSIONS.gentle, open, 1).mouthOpen).toBe(1);
  expect(blendExpression(EXPRESSIONS.gentle, open, 0.25).mouthOpen).toBeCloseTo(0.25, 9);
});

test('focused narrows the lids and angles the brows', () => {
  expect(EXPRESSIONS.focused.lidRest).toBeGreaterThan(0);
  expect(EXPRESSIONS.focused.browTilt).toBeLessThan(0);
});

test('attentive lifts the brows in curiosity', () => {
  expect(EXPRESSIONS.attentive.browLift).toBeGreaterThan(0);
});

test('happy opens the mouth in a big smile with a blush', () => {
  expect(EXPRESSIONS.happy.mouthOpen).toBe(0.6);
  expect(EXPRESSIONS.happy.mouthCurve).toBe(0.8);
  expect(EXPRESSIONS.happy.blush).toBe(0.4);
});

test('gentle is the spike face', () => {
  expect(EXPRESSIONS.gentle).toEqual({ lidRest: 0, lidBottom: 0, browLift: 0, browTilt: 0, mouthCurve: 0.3, mouthOpen: 0, blush: 0 });
});

test('the restful face: lids half down, brows soft, a small smile', () => {
  expect(EXPRESSIONS.restful).toEqual({ lidRest: 0.55, lidBottom: 0.1, browLift: -0.3, browTilt: 0, mouthCurve: 0.2, mouthOpen: 0, blush: 0 });
});

// The approved faces as they were before the blow (Task 22): puff and mouthRound must not touch them.
const APPROVED = {
  gentle: { lidRest: 0, lidBottom: 0, browLift: 0, browTilt: 0, mouthCurve: 0.3, mouthOpen: 0, blush: 0 },
  happy: { lidRest: 0, lidBottom: 0, browLift: 0, browTilt: 0, mouthCurve: 0.8, mouthOpen: 0.6, blush: 0.4 },
  focused: { lidRest: 0.12, lidBottom: 0, browLift: 0, browTilt: -0.6, mouthCurve: 0.65, mouthOpen: 0.45, blush: 0.2 },
  attentive: { lidRest: 0.14, lidBottom: 0, browLift: 0.5, browTilt: 0, mouthCurve: 0.45, mouthOpen: 0, blush: 0.3 },
  curious: { lidRest: 0, lidBottom: 0, browLift: 0.2, browTilt: -0.3, mouthCurve: 0.6, mouthOpen: 0.3, blush: 0.25 },
  restful: { lidRest: 0.55, lidBottom: 0.1, browLift: -0.3, browTilt: 0, mouthCurve: 0.2, mouthOpen: 0, blush: 0 },
} as const;

/**
 * A stand-in 2D context that records every call and every style set, in order, with its exact
 * arguments: two drawings with the same record are the same pixels.
 */
function recordedFace() {
  const log: string[] = [];
  const gradient = () => ({ addColorStop: (...a: unknown[]) => log.push(`stop ${a.join()}`) });
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (_, key) => (...a: unknown[]) => {
      log.push(`${String(key)}(${a.join()})`);
      return String(key).startsWith('create') ? gradient() : undefined;
    },
    set: (_, key, value) => {
      log.push(`${String(key)}=${typeof value === 'object' ? 'gradient' : value}`);
      return true;
    },
  });
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  (globalThis as { document?: unknown }).document = { createElement: () => canvas };
  return { face: new FaceCanvas(NOX.face, NOX.facePalette), log };
}
const drawn = (params: FaceParams) => {
  const { face, log } = recordedFace();
  face.draw(params, 0);
  return log;
};
const look = { blink: 0, gazeX: 0.1, gazeY: -0.05 };

test('expressions without puff are unchanged', () => {
  // The approved faces keep their exact values, with no puff or round mouth.
  for (const [id, params] of Object.entries(APPROVED)) expect(EXPRESSIONS[id as keyof typeof APPROVED], id).toStrictEqual(params);
  // Blending them never brings a puff in.
  const mixed = blendExpression(EXPRESSIONS.happy, EXPRESSIONS.restful, 0.4);
  expect('puff' in mixed || 'mouthRound' in mixed).toBe(false);
  // Drawn with puff and mouthRound at 0, every face is drawn exactly as without them.
  for (const params of Object.values(EXPRESSIONS).filter(p => !p.puff && !p.mouthRound)) {
    const plain = drawn({ ...params, ...look });
    expect(plain.length).toBeGreaterThan(100);
    expect(drawn({ ...params, ...look, puff: 0, mouthRound: 0 })).toEqual(plain);
  }
});

test('the blow face: cheeks puffed and the mouth round, on the gentle face', () => {
  expect(EXPRESSIONS.blow).toEqual({ ...EXPRESSIONS.gentle, puff: 1, mouthRound: 1 });
  const half = blendExpression(EXPRESSIONS.gentle, EXPRESSIONS.blow, 0.5);
  expect(half.puff).toBeCloseTo(0.5, 9);
  expect(half.mouthRound).toBeCloseTo(0.5, 9);
  expect(blendExpression(EXPRESSIONS.blow, EXPRESSIONS.gentle, 1)).toStrictEqual(EXPRESSIONS.gentle);
  // Each one changes the drawing.
  const plain = drawn({ ...EXPRESSIONS.gentle, ...look });
  expect(drawn({ ...EXPRESSIONS.gentle, ...look, puff: 1 })).not.toEqual(plain);
  expect(drawn({ ...EXPRESSIONS.gentle, ...look, mouthRound: 1 })).not.toEqual(plain);
});

test('focused (panel 4) is keen, not sleepy: lids only a little lowered and an open, eager grin', () => {
  const f = EXPRESSIONS.focused;
  expect(f.lidRest).toBeLessThanOrEqual(0.15);
  expect(f.mouthOpen).toBeGreaterThan(0.3);
  expect(f.mouthCurve).toBeGreaterThan(EXPRESSIONS.gentle.mouthCurve);
});
