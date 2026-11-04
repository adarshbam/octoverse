import type * as THREE from 'three';
import type { Vec3 } from '../world/types';

/**
 * The beats of the suction hold (design 9.8, "Choosing a bubble"), in ms from the choice: the
 * nearest arm turns toward the bubble, its cups flare as it turns, the bubble is pulled along the
 * arm to the tip, and the arm holds it and lifts it a little. Letting go takes `releaseMs` back to
 * the orbit. No arm physics (R52, R56): the follow-through of the lift is in its own easing.
 */
export const HOLD_BEATS = { turnMs: [0, 260], flareMs: [150, 420], pullMs: [260, 720], liftMs: [620, 1000], releaseMs: 600 } as const;

/** A box in body space (z ignored): Nox's face, which no arm reaches across. */
export interface Box { x0: number; y0: number; x1: number; y1: number }

/** How open the cups stay while they grip the held bubble, after flaring fully to take it. */
export const HOLD_GRIP = 0.6;
/** How far past its height the lift goes before it settles (the follow-through). */
const LIFT_OVERSHOOT = 0.1;

/** Whether the straight way from a to b (x, y) runs through the box. */
function crosses(a: Vec3, b: Vec3, box: Box) {
  // Clipped against each pair of the box's sides in turn (Liang-Barsky).
  let t0 = 0;
  let t1 = 1;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - box.x0], [dx, box.x1 - a[0]], [-dy, a[1] - box.y0], [dy, box.y1 - a[1]]] as const) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

/** The arm whose tip is nearest the bubble without its path crossing the face box. */
export function nearestArm(tips: readonly Vec3[], bubble: Vec3, face: Box): number {
  let best = -1;
  let bestDistance = Infinity;
  let nearest = 0;
  let nearestDistance = Infinity;
  tips.forEach((tip, i) => {
    const d = Math.hypot(tip[0] - bubble[0], tip[1] - bubble[1]);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearest = i;
    }
    if (d < bestDistance && !crosses(tip, bubble, face)) {
      bestDistance = d;
      best = i;
    }
  });
  // Should every way cross the face, the nearest arm still takes it.
  return best >= 0 ? best : nearest;
}

/** How far the pull's arc bows out, as a fraction of the way from the orbit to the tip. */
const PULL_BOW = 1;

/**
 * Where a bubble is, `pull` (0..1, eased) of the way from its orbit point to its arm's tip, written
 * into `out`: on an arc that bows out away from Nox's middle (`centre`, x and y), so it swings round
 * him, as the orbits do, rather than across his face or the words above it.
 */
export function pullPosition(orbit: THREE.Vector3, tip: THREE.Vector3, pull: number, centre: { x: number; y: number }, out: THREE.Vector3): THREE.Vector3 {
  const mx = (orbit.x + tip.x) / 2;
  const my = (orbit.y + tip.y) / 2;
  const ox = mx - centre.x;
  const oy = my - centre.y;
  const bow = (PULL_BOW * Math.hypot(tip.x - orbit.x, tip.y - orbit.y)) / (Math.hypot(ox, oy) || 1);
  const cx = mx + ox * bow;
  const cy = my + oy * bow;
  const a = (1 - pull) * (1 - pull);
  const b = 2 * pull * (1 - pull);
  const c = pull * pull;
  return out.set(a * orbit.x + b * cx + c * tip.x, a * orbit.y + b * cy + c * tip.y, orbit.z + (tip.z - orbit.z) * pull);
}

/**
 * One bubble's hold this frame. `bubble` is which bubble; `arm` the arm that holds it. Each value
 * is eased, 0 to 1: how far the arm has turned toward it, how open its cups are, how far the bubble
 * is along the arm to the tip, how far it is lifted (a little over 1 at the top of the follow-through),
 * and how far the release has gone (0 while it is held).
 */
export interface HoldFrame { bubble: number; arm: number; turn: number; flare: number; pull: number; lift: number; release: number }

type Values = Pick<HoldFrame, 'turn' | 'flare' | 'pull' | 'lift'>;

interface Entry {
  frame: HoldFrame;
  /** When it was chosen (held), or when it was let go (releasing). */
  since: number;
  releasing: boolean;
  /** Where it was when chosen again on its way home, or let go: the values it moves on from. */
  from: Values;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ramp = (ms: number, [a, b]: readonly [number, number]) => clamp01((ms - a) / (b - a));
const smoothstep = (x: number) => x * x * (3 - 2 * x);
const smootherstep = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
const sine = (x: number) => (1 - Math.cos(Math.PI * x)) / 2;

/**
 * The lift at x (0..1 through its beat): it rises calmly, goes on a little past its height and
 * settles back, ending at rest (no speed at either end).
 */
function liftCurve(x: number) {
  if (x >= 1) return 1;
  const rise = smootherstep(clamp01(x / 0.72));
  const past = Math.sin(Math.PI * clamp01((x - 0.45) / 0.55)) ** 2;
  return rise + LIFT_OVERSHOOT * past;
}

/**
 * The suction hold's one timeline: choosing a bubble starts its hold; choosing another lets the
 * first go from wherever it is (mid-pull too), so at most one is ever held; choosing none lets go.
 * A bubble chosen again on its way home comes back from where it is. `instant` (reduced motion,
 * a still) shows the hold settled at once, with no turn, flare, pull or lift on the way, and lets
 * go at once. `armFor` picks the arm for a newly chosen bubble (nearestArm).
 */
export class HoldChoreography {
  instant = false;
  private readonly entries: Entry[] = [];
  private readonly frames: HoldFrame[] = [];

  private readonly armFor: (bubble: number) => number;

  constructor(armFor: (bubble: number) => number) {
    this.armFor = armFor;
  }

  choose(bubble: number | null, nowMs: number): void {
    const held = this.entries.find(e => !e.releasing);
    if (held && held.frame.bubble === bubble) return;
    if (held) {
      this.values(held, nowMs, held.from);
      held.releasing = true;
      held.since = nowMs;
    }
    if (bubble === null) return;
    const back = this.entries.find(e => e.frame.bubble === bubble);
    if (back) {
      this.values(back, nowMs, back.from);
      back.releasing = false;
      back.since = nowMs;
      return;
    }
    this.entries.push({
      frame: { bubble, arm: this.armFor(bubble), turn: 0, flare: 0, pull: 0, lift: 0, release: 0 },
      since: nowMs,
      releasing: false,
      from: { turn: 0, flare: 0, pull: 0, lift: 0 },
    });
  }

  sample(nowMs: number): HoldFrame[] {
    this.frames.length = 0;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      if (entry.releasing && (this.instant || nowMs - entry.since >= HOLD_BEATS.releaseMs)) this.entries.splice(i, 1);
    }
    for (const entry of this.entries) {
      this.values(entry, nowMs, entry.frame);
      this.frames.push(entry.frame);
    }
    return this.frames;
  }

  /** Entry's values at nowMs, written into `out`. */
  private values(entry: Entry, nowMs: number, out: Values & { release?: number }) {
    const { from } = entry;
    const ms = nowMs - entry.since;
    if (entry.releasing) {
      // The bubble starts home at once; the cups let go and the lift drops with it; the arm turns
      // back a beat later.
      const r = clamp01(ms / HOLD_BEATS.releaseMs);
      const turn = from.turn * (1 - sine(clamp01((r - 0.2) / 0.8)));
      const flare = from.flare * (1 - smoothstep(clamp01(r / 0.5)));
      const pull = from.pull * (1 - smootherstep(r));
      const lift = from.lift * (1 - smoothstep(clamp01(r / 0.6)));
      Object.assign(out, { turn, flare, pull, lift });
      if (out === entry.frame) entry.frame.release = Math.max(r, 1e-6);
      return;
    }
    if (this.instant) {
      Object.assign(out, { turn: 1, flare: HOLD_GRIP, pull: 1, lift: 1 });
      if (out === entry.frame) entry.frame.release = 0;
      return;
    }
    // Each value moves on from where it was (0 for a new hold), at its own beat.
    const turn = sine(ramp(ms, HOLD_BEATS.turnMs));
    const rise = smoothstep(ramp(ms, HOLD_BEATS.flareMs));
    // Wide open to take the bubble, then easing to a grip as it reaches the tip.
    const grip = 1 - (1 - HOLD_GRIP) * smoothstep(ramp(ms, [HOLD_BEATS.pullMs[1] - 140, HOLD_BEATS.pullMs[1] + 100]));
    const pull = smootherstep(ramp(ms, HOLD_BEATS.pullMs));
    const x = ramp(ms, HOLD_BEATS.liftMs);
    Object.assign(out, {
      turn: from.turn * (1 - turn) + turn,
      flare: from.flare * (1 - rise) + rise * grip,
      pull: from.pull * (1 - pull) + pull,
      lift: from.lift * (1 - smootherstep(clamp01(x / 0.72))) + liftCurve(x),
    });
    if (out === entry.frame) entry.frame.release = 0;
  }
}
