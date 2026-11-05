import { armDepth, restFromCurve } from '../character/armChain';
import { CAMERA_Z } from '../config/stage';
import type { ArmSpec, Point2 } from '../config/types';
import type { StagePose } from './types';

/**
 * Helpers a world uses to author its stage poses (spec 11.2). They are generic: a world passes its
 * own body line and root height; none of them knows which world is calling.
 */

/** Where a world's hidden arm roots gather: the body's centre line and the roots' height. */
export interface RootPlacement {
  /** The body's centre line in the arms' space. */
  bodyX: number;
  /** The height of the hidden roots under the mantle. */
  rootY: number;
}

/**
 * Prepends the hidden root under the mantle so all eight arms share one body.
 * Front arms root lower so their thick base tucks under the chin, not over the mouth.
 */
export function withRoot(spec: ArmSpec, visible: readonly Point2[], place: RootPlacement, spread = 0.2, root?: Point2): Point2[] {
  if (root) return [root, ...visible];
  const [x] = visible[0];
  const rootY = spec.depth === 'front' ? place.rootY - 0.1 : place.rootY;
  return [[place.bodyX + (x - place.bodyX) * spread, rootY], ...visible];
}

/**
 * The flat curve an arm is built from, so that at its depth (it fans forward or back from the
 * body) the stage camera still sees the traced curve: each point moves toward the view axis by
 * (CAMERA_Z - z) / CAMERA_Z, with z read at the point's arc fraction along the curve.
 */
export function flattenForDepth(curve: readonly Point2[], arm: ArmSpec): Point2[] {
  const along = [0];
  for (let i = 1; i < curve.length; i++) along.push(along[i - 1] + Math.hypot(curve[i][0] - curve[i - 1][0], curve[i][1] - curve[i - 1][1]));
  const total = along[along.length - 1] || 1;
  return curve.map(([x, y], i) => {
    const f = (CAMERA_Z - armDepth(along[i] / total, arm)) / CAMERA_Z;
    return [x * f, y * f] as Point2;
  });
}

/** A world-unit trace moved into the space the arms are authored in, under the stage's body placement. */
export const toContent = (points: readonly Point2[], body: StagePose['body']) => points.map(([x, y]) => [(x - body.x) / body.scale, (y - body.y) / body.scale] as Point2);

/**
 * A point of the content space (the arms' and the head's own units) on the stage plane, under the
 * body placement: the body plus `scale` times the point, as the float group draws it. `toContent`'s
 * inverse; at scale 1 the sums are exactly the unscaled ones.
 */
export const toStage = (point: Point2, body: Pick<StagePose['body'], 'x' | 'y' | 'scale'>): Point2 => [body.x + body.scale * point[0], body.y + body.scale * point[1]];

/** The length of the curve an arm is resampled into. */
export const armLength = (curve: readonly Point2[]) => {
  const rest = restFromCurve(curve);
  return rest.segmentLength * rest.angles.length;
};

/** A curve scaled about its root to `length`. */
export function withLength(curve: readonly Point2[], length: number): Point2[] {
  const k = length / armLength(curve);
  const [rx, ry] = curve[0];
  return curve.map(([x, y]) => [rx + (x - rx) * k, ry + (y - ry) * k] as Point2);
}
