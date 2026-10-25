export type ExpressionId = 'gentle' | 'happy' | 'focused' | 'attentive' | 'curious' | 'restful';

/** Authored face shape, all values roughly -1..1 or 0..1. */
export interface ExpressionParams {
  /** Resting upper-lid closure, added to blinks. */
  lidRest: number;
  lidBottom: number;
  browLift: number;
  /** Positive raises the inner brow ends. */
  browTilt: number;
  mouthCurve: number;
  mouthOpen: number;
  blush: number;
}

export type FaceParams = ExpressionParams & { blink: number; gazeX: number; gazeY: number };

const GENTLE: ExpressionParams = { lidRest: 0, lidBottom: 0, browLift: 0, browTilt: 0, mouthCurve: 0.3, mouthOpen: 0, blush: 0 };

// `gentle` is the spike face. Brows for `attentive` (curious) and `focused` are authored
// in Task 8, and `happy` (panel 3's open smile) with the mouth in Task 9; the rest of
// those faces and `restful` follow in Tasks 17, 19 and 21.
export const EXPRESSIONS: Record<ExpressionId, ExpressionParams> = {
  gentle: GENTLE,
  happy: { ...GENTLE, mouthCurve: 0.8, mouthOpen: 0.6, blush: 0.4 },
  focused: { ...GENTLE, browTilt: -0.6, lidRest: 0.12, mouthCurve: 0.65, mouthOpen: 0.45, blush: 0.2 },
  attentive: { ...GENTLE, browLift: 0.5 },
  curious: { ...GENTLE, browTilt: -0.3, browLift: 0.2, mouthCurve: 0.6, mouthOpen: 0.3, blush: 0.25 },
  restful: { lidRest: 0.55, lidBottom: 0.1, browLift: -0.3, browTilt: 0, mouthCurve: 0.2, mouthOpen: 0, blush: 0 },
};

export function blendExpression(a: ExpressionParams, b: ExpressionParams, t: number): ExpressionParams {
  const mix = (x: number, y: number) => (t <= 0 ? x : t >= 1 ? y : x + (y - x) * t);
  return {
    lidRest: mix(a.lidRest, b.lidRest),
    lidBottom: mix(a.lidBottom, b.lidBottom),
    browLift: mix(a.browLift, b.browLift),
    browTilt: mix(a.browTilt, b.browTilt),
    mouthCurve: mix(a.mouthCurve, b.mouthCurve),
    mouthOpen: mix(a.mouthOpen, b.mouthOpen),
    blush: mix(a.blush, b.blush),
  };
}
