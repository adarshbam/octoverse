import { type ArmRest, ArmChain, restFromCurve } from '../character/armChain';
import { ARM_IDS, type ArmId, type Point2 } from '../config/types';
import type { StagePose } from '../poses/types';
import { EXPRESSIONS, type ExpressionParams, blendExpression } from './expressions';

/** A pose part-way between two stages: arm rests, body placement, face and head shape. */
export interface BlendedPose {
  arms: Record<ArmId, ArmRest>;
  body: StagePose['body'];
  expression: ExpressionParams;
  headMorph: number;
  orbs: number;
  tilt: number;
  /** Where the eyes rest: the new pose's from the start of a change. */
  look?: Point2;
}

/**
 * How Nox moves between stages: slowly enough to feel calm and immersive, each arm setting off a
 * little after the one before, so the change ripples out round the body.
 */
export const STAGE_TRANSITION = { durationMs: 1800, staggerMs: 70 };

const smootherstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const mix = (a: number, b: number, t: number) => (t >= 1 ? b : a + (b - a) * t);

/** Blends joint angles the short way round each joint, writing into `out`; t >= 1 gives `to` exactly. */
export function blendAngles(from: Float32Array, to: Float32Array, t: number, out: Float32Array) {
  for (let k = 0; k < out.length; k++) {
    if (t >= 1) {
      out[k] = to[k];
      continue;
    }
    const d = to[k] - from[k];
    out[k] = from[k] + Math.atan2(Math.sin(d), Math.cos(d)) * t;
  }
  return out;
}

const settledCache = new WeakMap<StagePose, Map<number, Record<ArmId, ArmRest>>>();

/** A pose's arm rests at a segment count, worked out once: a stage change never redoes it. */
export function settledArms(pose: StagePose, segments: number) {
  let bySegments = settledCache.get(pose);
  if (!bySegments) settledCache.set(pose, (bySegments = new Map()));
  let arms = bySegments.get(segments);
  if (!arms) bySegments.set(segments, (arms = Object.fromEntries(ARM_IDS.map(id => [id, restFromCurve(pose.arms[id], segments)])) as Record<ArmId, ArmRest>));
  return arms;
}

function settle(pose: StagePose, segments: number): BlendedPose {
  return {
    // Shared and never written: the blender copies before it changes anything.
    arms: settledArms(pose, segments),
    body: { ...pose.body },
    expression: { ...EXPRESSIONS[pose.expression] },
    headMorph: pose.headMorph,
    orbs: pose.orbs,
    tilt: pose.tilt ?? 0,
    look: pose.look,
  };
}

function copyPose(pose: BlendedPose): BlendedPose {
  return {
    arms: Object.fromEntries(ARM_IDS.map(id => [id, { ...pose.arms[id], angles: Float32Array.from(pose.arms[id].angles) }])) as Record<ArmId, ArmRest>,
    body: { ...pose.body },
    expression: { ...pose.expression },
    headMorph: pose.headMorph,
    orbs: pose.orbs,
    tilt: pose.tilt,
    look: pose.look,
  };
}

/**
 * Moves Nox from one stage pose to the next with smootherstep easing, the arms setting off one
 * after another. A new start mid-blend sets off from wherever the pose is, so nothing snaps.
 */
export class PoseBlender {
  private from: BlendedPose;
  private to: BlendedPose;
  private readonly current: BlendedPose;
  private startMs = 0;
  private durationMs = 0;
  private staggerMs = 0;

  private readonly segments: number;
  /**
   * The arm rests the rig is laid out in (each arm's cup side and spacing): `layout`'s, by default
   * the pose the blender starts in.
   */
  readonly layout: Record<ArmId, ArmRest>;

  /** `segments` per arm follows the quality tier. */
  constructor(initial: StagePose, segments = ArmChain.SEGMENTS, layout: StagePose = initial) {
    this.segments = segments;
    this.layout = settledArms(layout, segments);
    this.to = settle(initial, segments);
    this.from = copyPose(this.to);
    this.current = copyPose(this.to);
  }

  /** With `delayMs`, the pose holds where it is until then, so a change can wait for its beat. */
  start(target: StagePose, nowMs: number, durationMs = 700, staggerMs = 40, delayMs = 0) {
    this.from = copyPose(this.sample(nowMs));
    this.to = settle(target, this.segments);
    this.startMs = nowMs + delayMs;
    this.durationMs = durationMs;
    this.staggerMs = staggerMs;
  }

  /** The pose at `nowMs`. The returned object is reused between calls. */
  sample(nowMs: number): BlendedPose {
    const progress = (delayMs: number) => (this.durationMs <= 0 ? 1 : smootherstep((nowMs - this.startMs - delayMs) / this.durationMs));
    const { from, to, current } = this;
    ARM_IDS.forEach((id, i) => {
      const t = progress(i * this.staggerMs);
      const a = from.arms[id];
      const b = to.arms[id];
      const out = current.arms[id];
      out.rootX = mix(a.rootX, b.rootX, t);
      out.rootY = mix(a.rootY, b.rootY, t);
      out.segmentLength = mix(a.segmentLength, b.segmentLength, t);
      blendAngles(a.angles, b.angles, t, out.angles);
    });
    const t = progress(0);
    current.body = {
      x: mix(from.body.x, to.body.x, t),
      y: mix(from.body.y, to.body.y, t),
      scale: mix(from.body.scale, to.body.scale, t),
      yaw: mix(from.body.yaw, to.body.yaw, t),
    };
    current.expression = blendExpression(from.expression, to.expression, t);
    current.headMorph = mix(from.headMorph, to.headMorph, t);
    current.orbs = mix(from.orbs, to.orbs, t);
    current.tilt = mix(from.tilt, to.tilt, t);
    current.look = to.look;
    return current;
  }
}
