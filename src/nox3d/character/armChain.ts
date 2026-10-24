import * as THREE from 'three';
import { spring } from '../behavior/ambient';
import type { ArmSpec, Point2 } from '../config/types';

/** How quickly a reaching arm follows the reach solver (critically damped, ~0.25 s to settle). */
const REACH_OMEGA = 18;
const reachState = { x: 0, v: 0 };

/** An arm's rest pose as a chain: root, equal segment length, absolute segment angles. */
export interface ArmRest {
  rootX: number;
  rootY: number;
  segmentLength: number;
  angles: Float32Array;
}

export interface ArmDrive {
  time: number;
  /** Travelling-wave amplitude, radians accumulated toward the tip. */
  sway: number;
  /** Tip curl toward the sucker side (zero-mean over time). */
  curl: number;
  /** Body vertical velocity; arms trail against it. */
  droop: number;
  /** Point (arm space) the tip reaches toward, blended by weight 0..1. */
  reach?: { x: number; y: number; weight: number };
  /**
   * Rest bend: gentle undulations along the arm (radians of turn), always present, even when
   * the arm is still, so it reads as flexible along its whole length rather than straight then curled.
   */
  bend?: number;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Arm depth (world z) at arc fraction u: from the root depth toward the tip depth, with most of
 * the change near the body, so the arms leave it already fanned out front to back.
 */
export function armDepth(u: number, spec: ArmSpec) {
  const [z0, z1] = spec.z;
  const t = Math.min(1, Math.max(0, u));
  return z0 + (z1 - z0) * (1 - (1 - t) ** 2);
}

/** Resamples a traced curve (centripetal Catmull-Rom) into equal-length segments. */
export function restFromCurve(curve: readonly Point2[], segments = ArmChain.SEGMENTS): ArmRest {
  const spline = new THREE.CatmullRomCurve3(curve.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  const points = spline.getSpacedPoints(segments);
  const angles = new Float32Array(segments);
  for (let k = 0; k < segments; k++) angles[k] = Math.atan2(points[k + 1].y - points[k].y, points[k + 1].x - points[k].x);
  return { rootX: points[0].x, rootY: points[0].y, segmentLength: spline.getLength() / segments, angles };
}

/**
 * One tentacle as a forward-kinematic chain. Each frame small joint rotations
 * accumulate from root to tip on top of the rest angles, so the whole limb bends;
 * an optional cyclic-coordinate-descent pass bends the outer arm toward a target.
 */
export class ArmChain {
  /** Enough segments that the tightest tip curls stay smooth at review zoom. */
  static readonly SEGMENTS = 128;
  readonly side: 1 | -1;
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly pz: Float32Array;
  readonly spec: ArmSpec;
  private rest: ArmRest;
  private readonly phase: number;
  private readonly angle: Float32Array;
  private readonly work: Float32Array;
  private readonly qx: Float32Array;
  private readonly qy: Float32Array;
  /** Rest-bend shape per segment: zero-mean waves through the middle of the arm. */
  private readonly undulation: Float32Array;
  /** The reach's turn per segment as the arm follows the solver, and how fast it is changing. */
  private readonly reachTurn: Float32Array;
  private readonly reachSpeed: Float32Array;
  private lastTime: number | null = null;

  constructor(rest: ArmRest, spec: ArmSpec, index: number) {
    const n = rest.angles.length;
    this.rest = rest;
    this.spec = spec;
    this.phase = index * 1.37 + 0.4;
    this.px = new Float32Array(n + 1);
    this.py = new Float32Array(n + 1);
    this.pz = new Float32Array(n + 1);
    this.angle = new Float32Array(n);
    this.work = new Float32Array(n);
    this.reachTurn = new Float32Array(n);
    this.reachSpeed = new Float32Array(n);
    this.qx = new Float32Array(n + 1);
    this.qy = new Float32Array(n + 1);
    // Octopus arms curl toward their oral side, so the tip's turning direction picks the
    // sucker side, unless the config traced it from the reference.
    let turn = 0;
    for (let k = Math.floor(n * 0.6); k < n - 1; k++) turn += wrap(rest.angles[k + 1] - rest.angles[k]);
    this.side = spec.suckerSide ?? (turn >= 0 ? 1 : -1);
    // Two gentle waves of turn between the root and the curl, with their mean removed so the
    // curl beyond them stays where it was traced.
    const shape = Array.from({ length: n }, (_, k) => {
      const s = (k + 0.5) / n;
      const env = smoothstep(0.12, 0.26, s) * (1 - smoothstep(0.68, 0.86, s));
      return [Math.sin(Math.PI * 4 * s + this.phase * 0.9), env] as const;
    });
    const mean = shape.reduce((sum, [w, e]) => sum + w * e, 0) / shape.reduce((sum, [, e]) => sum + e, 0);
    this.undulation = Float32Array.from(shape, ([w, e]) => (w - mean) * e);
    this.angle.set(rest.angles);
    this.integrate();
    this.updateZ(0);
  }

  get segments() { return this.rest.angles.length; }
  get segmentLength() { return this.rest.segmentLength; }
  get tipX() { return this.px[this.segments]; }
  get tipY() { return this.py[this.segments]; }

  /** Replaces the rest pose (same segment count), e.g. while blending between stage poses. */
  setRest(rest: ArmRest) {
    if (rest.angles.length !== this.segments) throw new Error('ArmChain.setRest: segment count changed');
    this.rest = rest;
  }

  solve({ time: t, sway, curl, droop, reach, bend = 0 }: ArmDrive) {
    const n = this.segments;
    const ph = this.phase;
    let acc = 0;
    for (let k = 0; k < n; k++) {
      const s = (k + 0.5) / n;
      // A slow swing of the whole arm, plus a wave travelling out from the body with nearly two
      // wavelengths along the arm, so it bends at several points from base to tip.
      const swing = (0.3 + 0.7 * s) * Math.sin(t * 0.62 - s * 2.4 + ph);
      const ripple = (0.6 + 0.4 * s) * Math.sin(t * 0.95 - s * 11 + ph * 1.7);
      const wave = sway * (0.55 * swing + 1.7 * ripple) * smoothstep(0.02, 0.15, s);
      const tipCurl = curl * this.side * smoothstep(0.5, 1, s) * 0.5 * Math.sin(t * 0.53 + ph * 0.7);
      const trail = -droop * Math.cos(this.rest.angles[k]) * (1 - 0.5 * s);
      acc += (wave + tipCurl + trail) / n;
      this.angle[k] = this.rest.angles[k] + acc + bend * this.undulation[k];
    }
    this.integrate();
    const dt = this.lastTime === null ? 0 : Math.min(Math.max(t - this.lastTime, 0), 1 / 20);
    this.lastTime = t;
    if (reach && reach.weight > 0.001) {
      this.solveReach(reach.x, reach.y);
      // The arm follows the solver's turns through a fast spring, so the solver's small jumps near
      // the limit of its reach become quick, smooth movements; with no time passing (a frozen
      // view) it takes them at once. The turns are summed, not wrapped, so a partial blend never
      // flips a full turn.
      for (let k = 0; k < n; k++) {
        const want = this.work[k] - this.angle[k];
        if (dt > 0) {
          reachState.x = this.reachTurn[k];
          reachState.v = this.reachSpeed[k];
          spring(reachState, want, REACH_OMEGA, dt);
          this.reachTurn[k] = reachState.x;
          this.reachSpeed[k] = reachState.v;
        } else {
          this.reachTurn[k] = want;
          this.reachSpeed[k] = 0;
        }
        this.angle[k] += this.reachTurn[k] * reach.weight;
      }
      this.integrate();
    } else {
      this.reachTurn.fill(0);
      this.reachSpeed.fill(0);
    }
    this.updateZ(t);
  }

  /** Position at arc fraction u (0 = root, 1 = tip). */
  pointAt(u: number, out: { x: number; y: number; z: number }) {
    const f = Math.min(1, Math.max(0, u)) * this.segments;
    const k = Math.min(this.segments - 1, Math.floor(f));
    const w = f - k;
    out.x = this.px[k] * (1 - w) + this.px[k + 1] * w;
    out.y = this.py[k] * (1 - w) + this.py[k + 1] * w;
    out.z = this.pz[k] * (1 - w) + this.pz[k + 1] * w;
  }

  private integrate() {
    const n = this.segments;
    const length = this.rest.segmentLength;
    this.px[0] = this.rest.rootX;
    this.py[0] = this.rest.rootY;
    for (let k = 0; k < n; k++) {
      this.px[k + 1] = this.px[k] + length * Math.cos(this.angle[k]);
      this.py[k + 1] = this.py[k] + length * Math.sin(this.angle[k]);
    }
  }

  private updateZ(t: number) {
    const n = this.segments;
    for (let k = 0; k <= n; k++) {
      const s = k / n;
      this.pz[k] = armDepth(s, this.spec) + (k === 0 ? 0 : 0.035 * s * Math.sin(t * 0.9 + this.phase + s * 2.5));
    }
  }

  /** Cyclic coordinate descent over the outer arm; the root third stays anchored to the body. */
  private solveReach(targetX: number, targetY: number) {
    const n = this.segments;
    this.work.set(this.angle);
    this.qx.set(this.px);
    this.qy.set(this.py);
    for (let iter = 0; iter < 4; iter++) {
      for (let j = n - 4; j >= Math.floor(0.3 * n); j -= 3) {
        const ex = this.qx[n] - this.qx[j];
        const ey = this.qy[n] - this.qy[j];
        const turn = wrap(Math.atan2(targetY - this.qy[j], targetX - this.qx[j]) - Math.atan2(ey, ex));
        // A target almost straight behind this joint gives no clear way round: the joint eases off
        // rather than flipping which way it turns, so the arm never jumps.
        const delta = Math.max(-0.09, Math.min(0.09, turn)) * Math.min(1, (Math.PI - Math.abs(turn)) / 0.5);
        const c = Math.cos(delta);
        const s = Math.sin(delta);
        for (let k = j; k < n; k++) this.work[k] += delta;
        for (let k = j + 1; k <= n; k++) {
          const dx = this.qx[k] - this.qx[j];
          const dy = this.qy[k] - this.qy[j];
          this.qx[k] = this.qx[j] + dx * c - dy * s;
          this.qy[k] = this.qy[j] + dx * s + dy * c;
        }
      }
    }
  }
}
