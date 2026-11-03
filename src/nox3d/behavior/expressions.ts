import type { CharacterConfig } from '../config/types';

export type ExpressionId = 'gentle' | 'happy' | 'focused' | 'attentive' | 'curious' | 'restful' | 'blow';

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
  /**
   * 0 to 1: the cheeks puffed, before a bubble is blown (design 9.8). Absent on every face but the
   * blow's: an absent puff is none, and draws exactly as before it existed.
   */
  puff?: number;
  /** 0 to 1: the mouth rounded to blow. Absent, as `puff`, on every other face. */
  mouthRound?: number;
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
  attentive: { ...GENTLE, lidRest: 0.14, browLift: 0.5, mouthCurve: 0.45, blush: 0.3 },
  curious: { ...GENTLE, browTilt: -0.3, browLift: 0.2, mouthCurve: 0.6, mouthOpen: 0.3, blush: 0.25 },
  restful: { lidRest: 0.55, lidBottom: 0.1, browLift: -0.3, browTilt: 0, mouthCurve: 0.2, mouthOpen: 0, blush: 0 },
  // Blowing a bubble (Task 22): the gentle face, cheeks puffed and mouth round. The blow itself
  // (sequences/bubbleBlow.ts) puffs the face it is on; this is the face at the top of a puff.
  blow: { ...GENTLE, puff: 1, mouthRound: 1 },
};

/** Every expression id, in the base table's order (the URL parser accepts these). */
export const EXPRESSION_IDS = Object.keys(EXPRESSIONS) as readonly ExpressionId[];

/**
 * The faces a character wears: the base table with the character's own overrides merged over it,
 * key by key (amendment A1, G1). No new ids: an override changes an existing face. A character
 * with none gets the base table's values unchanged. Every reader goes through this, never `EXPRESSIONS`.
 */
export function resolveExpressions(config: Pick<CharacterConfig, 'expressions'>): Record<ExpressionId, ExpressionParams> {
  const overrides = config.expressions ?? {};
  const table = {} as Record<ExpressionId, ExpressionParams>;
  for (const id of EXPRESSION_IDS) {
    const face: ExpressionParams = { ...EXPRESSIONS[id] };
    for (const [key, value] of Object.entries((overrides[id] ?? {}) as Record<string, number | undefined>)) {
      if (value !== undefined) (face as unknown as Record<string, number>)[key] = value;
    }
    table[id] = face;
  }
  return table;
}

/**
 * While swimming Nox blinks at a slower rate (spec 9.5): the wait between blinks is his
 * personality's blink interval times this (BlinkScheduler.sample's `slower`).
 */
export const SWIM_BLINK = 1.6;

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
    // Puff and mouthRound only while the blend has any (absent is none), so a blend of the other
    // faces, or one fully out of the blow, is exactly the face it would be without them.
    ...blowParts(mix(a.puff ?? 0, b.puff ?? 0), mix(a.mouthRound ?? 0, b.mouthRound ?? 0)),
  };
}

const blowParts = (puff: number, mouthRound: number) => (puff !== 0 || mouthRound !== 0 ? { puff, mouthRound } : {});
