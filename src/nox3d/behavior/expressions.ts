export type ExpressionId = 'gentle' | 'happy' | 'focused' | 'attentive' | 'restful';

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

// Only `gentle` (the spike face) is authored so far; the others are authored
// against their storyboard panels in Tasks 8, 17, 19 and 21.
export const EXPRESSIONS: Record<ExpressionId, ExpressionParams> = {
  gentle: GENTLE,
  happy: GENTLE,
  focused: GENTLE,
  attentive: GENTLE,
  restful: GENTLE,
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
