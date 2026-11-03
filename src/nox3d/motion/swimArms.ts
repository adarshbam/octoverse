import type { ArmRest } from '../character/armChain';
import { ARM_IDS, type ArmId } from '../config/types';
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
 * The trailing bundle's total swing back, body lean plus arm pitch (radians): about 30 degrees
 * below level, so from the front the arms show behind and below the head (Task 16, concern 3).
 */
export const TRAIL_PITCH = 1.05;

/** How far past the stage pose the arms swing as they settle (spec 9.6: "overshoot slightly"). */
const OVERSHOOT = 2;

/**
 * The settle's weight toward the stage pose: 0 at 0, exactly 1 at 1, rising past 1 on the way
 * (at most about 1.046, at 0.9) so the arms open a little beyond the intro pose and come back.
 */
export function settleWeight(settle: number) {
  const s = Math.min(1, Math.max(0, settle));
  return s >= 1 ? 1 : s + OVERSHOOT * s ** 3 * (1 - s);
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
 * toward the rest pose by settleWeight(settle). At settle 1 they are the rest pose exactly.
 */
export function swimRests(shapes: SwimShapes, stroke: Pick<StrokeFrame, 'spread' | 'sweep'>, settle: number, out: Record<ArmId, ArmRest>) {
  const w = settleWeight(settle);
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
