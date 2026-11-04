import type { ExpressionId } from '../behavior/expressions';
import type { ArmId, Point2 } from '../config/types';

/** An authored stage pose: arm rest curves, body placement, face and head shape. */
export interface StagePose {
  /** Rest curve per arm, root first (the root sits hidden under the mantle). */
  arms: Record<ArmId, readonly Point2[]>;
  body: { x: number; y: number; scale: number; yaw: number };
  expression: ExpressionId;
  /** 0 = normal mantle, 1 = overview glass dome. */
  headMorph: number;
  /** 0 = no technology orbs, 1 = the orbs out round the arms. */
  orbs: number;
  /** The head's tilt about the neck, in radians: positive leans its top toward screen left. */
  tilt?: number;
  /** A world point (z = 0) the eyes rest on when nothing else holds them; without one they glance about. */
  look?: Point2;
}

/**
 * A character's swim (spec 6.2, `WorldBundle.swim`): the stroke's two arm shapes, `open` (the
 * umbrella) and `trail` (the bundle), authored in the arms' space as stage poses are; `stretch`, how
 * much longer the entering pose's arms are drawn than the intro's; and `bodyX`, the body's centre
 * line in that space, which the swim turns about and the arms' roots spread about. The poses may be
 * built on first read (Nox's are fitted to his intro arms), so nothing reads them before the swim.
 */
export interface SwimPoseSet {
  readonly open: StagePose;
  readonly trail: StagePose;
  readonly stretch: number;
  readonly bodyX: number;
}
