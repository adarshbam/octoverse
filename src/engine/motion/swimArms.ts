import { settledArms } from '../behavior/poseBlend';
import type { ArmRest } from '../character/armChain';
import { ARM_IDS, type ArmId } from '../config/types';
import type { StagePose, SwimPoseSet } from '../poses/types';
import { SWIM_PITCH, type StrokeFrame } from './stroke';

// The arms' shape while Nox swims (spec 9.5/9.6), each frame: the stroke's trail, opened toward the
// umbrella by `spread`, swept back into the trail by `sweep`, and carried into the stage pose by
// a weight (the entrance's `open`: the arms are spread before the spin), overshooting it a little
// before landing. No arm physics (ruling R48): the
// follow-through is in these drives and in ArmDrive.pitch and straighten.

/** The three shapes the swim moves between, as arm rests at the rig's segment count. */
export interface SwimShapes {
  trail: Record<ArmId, ArmRest>;
  open: Record<ArmId, ArmRest>;
  /** The pose Nox settles into (the intro). */
  rest: Record<ArmId, ArmRest>;
}

/**
 * A character's swim shapes as arm rests at `segments`: its swim's trail and open umbrella, and
 * `rest`, the pose it settles into (the intro). Worked out once per pose and segment count
 * (settledArms caches them); the first call builds the swim's poses, so the stage makes it before
 * the swim starts (host/WorldHost.tsx), not on its first frame.
 */
export function swimShapes(swim: SwimPoseSet, rest: StagePose, segments: number): SwimShapes {
  return { trail: settledArms(swim.trail, segments), open: settledArms(swim.open, segments), rest: settledArms(rest, segments) };
}

/**
 * The trailing bundle's total swing back, body lean plus arm pitch (radians): about 30 degrees
 * below level, so from the front the arms show behind and below the head (Task 16, concern 3).
 */
export const TRAIL_PITCH = 1.05;

/** How far past the stage pose the arms swing as they settle (spec 9.6: "overshoot slightly"). */
const OVERSHOOT = 2;

/**
 * How far the weight s + k s^3 (1 - s) runs past 1 at most: (1 - s)(k s^3 - 1) peaks where
 * 1 + 3k s^2 - 4k s^3 = 0 (found by bisection); none for k at or below 1.
 */
function runPast(k: number) {
  if (k <= 1) return 0;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const s = (lo + hi) / 2;
    if (1 + 3 * k * s * s - 4 * k * s * s * s > 0) lo = s;
    else hi = s;
  }
  return (1 - lo) * (k * lo ** 3 - 1);
}

/**
 * The coefficient in place of OVERSHOOT that runs `share` (0 to 1) as far past the pose as Nox's:
 * found by bisection between 1 (none) and OVERSHOOT, since the run past is not in proportion to
 * the coefficient. A pure memo of `share` (the personalities use one or two values).
 */
const coefficients = new Map<number, number>();
function overshootCoefficient(share: number) {
  let k = coefficients.get(share);
  if (k === undefined) {
    const want = Math.min(1, Math.max(0, share)) * runPast(OVERSHOOT);
    let lo = 1;
    let hi = OVERSHOOT;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (runPast(mid) < want) lo = mid;
      else hi = mid;
    }
    k = (lo + hi) / 2;
    coefficients.set(share, k);
  }
  return k;
}

/**
 * The settle's weight toward the stage pose: 0 at 0, exactly 1 at 1, rising past 1 on the way
 * (at most about 1.046, at 0.9) so the arms open a little beyond the intro pose and come back.
 * `overshoot` is the personality's settle (behavior/ambient.ts settleScale, 0 to 1; 1 is Nox's): the
 * run past the pose is that share of his, by the same smooth curve with a smaller coefficient.
 */
export function settleWeight(settle: number, overshoot = 1) {
  const s = Math.min(1, Math.max(0, settle));
  const k = overshoot === 1 ? OVERSHOOT : overshootCoefficient(overshoot);
  return s >= 1 ? 1 : s + k * s ** 3 * (1 - s);
}

/**
 * The arm pitch (ArmDrive.pitch) for a stroke drive (`swimDrive`) on a body leaning `bodyPitch`:
 * the drive's swing, scaled so the trailing bundle (sweep 1) and the lean add up to TRAIL_PITCH.
 * As the body rights itself the arms swing further back in step, so the bundle keeps its line.
 */
export function swimArmPitch(drivePitch: number, bodyPitch: number) {
  return (drivePitch * Math.max(0, TRAIL_PITCH - bodyPitch)) / (SWIM_PITCH.base + SWIM_PITCH.sweep);
}

/** `from` toward `to` by `w` (any w, past 1 too), each joint the short way round; w = 1 gives `to` exactly. */
function mixRest(from: ArmRest, to: ArmRest, w: number, out: ArmRest) {
  if (w === 1) {
    out.rootX = to.rootX;
    out.rootY = to.rootY;
    out.segmentLength = to.segmentLength;
    out.angles.set(to.angles);
    return;
  }
  out.rootX = from.rootX + (to.rootX - from.rootX) * w;
  out.rootY = from.rootY + (to.rootY - from.rootY) * w;
  out.segmentLength = from.segmentLength + (to.segmentLength - from.segmentLength) * w;
  for (let k = 0; k < out.angles.length; k++) {
    const d = to.angles[k] - from.angles[k];
    out.angles[k] = from.angles[k] + Math.atan2(Math.sin(d), Math.cos(d)) * w;
  }
}

/** Arm rests to write into, one per arm, at `segments`. */
export function createSwimRests(segments: number): Record<ArmId, ArmRest> {
  return Object.fromEntries(ARM_IDS.map(id => [id, { rootX: 0, rootY: 0, segmentLength: 0, angles: new Float32Array(segments) }])) as Record<ArmId, ArmRest>;
}

/**
 * The arm rests for a stroke at `settle` (0 swimming, 1 landed; the entrance passes its `open`),
 * written into `out` and returned: trail toward open by spread, back toward trail by sweep, then
 * toward the rest pose by settleWeight(settle, overshoot). At settle 1 they are the rest pose exactly.
 * `overshoot` is the personality's settle (1, Nox's, by default).
 */
export function swimRests(shapes: SwimShapes, stroke: Pick<StrokeFrame, 'spread' | 'sweep'>, settle: number, out: Record<ArmId, ArmRest>, overshoot = 1) {
  const w = settleWeight(settle, overshoot);
  for (const id of ARM_IDS) {
    const o = out[id];
    if (w === 1) {
      mixRest(o, shapes.rest[id], 1, o);
      continue;
    }
    mixRest(shapes.trail[id], shapes.open[id], stroke.spread, o);
    mixRest(o, shapes.trail[id], stroke.sweep, o);
    if (w !== 0) mixRest(o, shapes.rest[id], w, o);
  }
  return out;
}
