import { expect, test } from 'vitest';
import { EXPRESSIONS, blendExpression } from './expressions';

test('blendExpression is endpoint exact and linear', () => {
  expect(blendExpression(EXPRESSIONS.gentle, EXPRESSIONS.gentle, 0.5)).toEqual(EXPRESSIONS.gentle);
  const open = { ...EXPRESSIONS.gentle, mouthOpen: 1 };
  expect(blendExpression(EXPRESSIONS.gentle, open, 0).mouthOpen).toBe(0);
  expect(blendExpression(EXPRESSIONS.gentle, open, 1).mouthOpen).toBe(1);
  expect(blendExpression(EXPRESSIONS.gentle, open, 0.25).mouthOpen).toBeCloseTo(0.25, 9);
});

test('gentle is the spike face', () => {
  expect(EXPRESSIONS.gentle).toEqual({ lidRest: 0, lidBottom: 0, browLift: 0, browTilt: 0, mouthCurve: 0.3, mouthOpen: 0, blush: 0 });
});
