import { FLOURISH_SECONDS } from '../../engine/behavior/flourish';
import { IDLE_TILT_SECONDS } from '../../engine/behavior/idleTilt';
import { seededRng } from '../../engine/motion/micro';

// Aether's character moments (spec 7.8, Task 16), as pure world-level logic. The engine runs the
// tilt (idleTilt), the reach (the flourish layer) and the gaze wander (lookPoints) on their own
// schedules and has no hook for a world-authored moment yet, so the pieces that are Aether's own
// live here, tested, with nothing in the engine importing them: the spark's trigger, its wave and
// bead curves, and the arbiter that keeps her to one moment at a time. MORNING-REVIEW-aether.md,
// "Engine follow-ups", names the calls the engine would make.

export type MomentKind = 'tilt' | 'reach' | 'spark' | 'wander';

/** One moment: what it is, when it starts and when it ends (seconds on the character's clock). */
export interface Moment {
  kind: MomentKind;
  start: number;
  end: number;
}

/** How long each moment holds the stage (seconds). A gaze shift is the eyes going to a new look point. */
export const GAZE_SHIFT_SECONDS = 1.2;
export const MOMENT_SECONDS: Record<MomentKind, number> = {
  tilt: IDLE_TILT_SECONDS,
  reach: FLOURISH_SECONDS,
  spark: 1.2,
  wander: GAZE_SHIFT_SECONDS,
};

/** Who wins when two want the same instant: the visitor's own trigger first, then her signature, the reach, the wander. */
const PRIORITY: Record<MomentKind, number> = { spark: 0, tilt: 1, reach: 2, wander: 3 };

/**
 * Lets one moment run at a time. `claim` grants a moment only if none is running at `t`; a refused
 * moment waits for its caller to ask again. A claim made while one runs never shortens it.
 */
export class MomentArbiter {
  private current: Moment | null = null;

  /** The moment running at `t`, or null. */
  active(t: number): Moment | null {
    return this.current && t >= this.current.start && t < this.current.end ? this.current : null;
  }

  /** Grants `kind` from `t` for `seconds` (its own length by default) if the stage is free; true when granted. */
  claim(kind: MomentKind, t: number, seconds: number = MOMENT_SECONDS[kind]): boolean {
    if (this.active(t)) return false;
    this.current = { kind, start: t, end: t + seconds };
    return true;
  }
}

/**
 * Settles a pile of wanted moments offline: taken in start order (ties by priority), each is granted
 * only if it starts after the last granted one ends. The rest are refused (a live caller would
 * hold them until the stage is free).
 */
export function planMoments(wanted: readonly Moment[]): { granted: Moment[]; refused: Moment[] } {
  const order = [...wanted].sort((a, b) => a.start - b.start || PRIORITY[a.kind] - PRIORITY[b.kind]);
  const granted: Moment[] = [];
  const refused: Moment[] = [];
  let busyUntil = -Infinity;
  for (const m of order) {
    if (m.start >= busyUntil) {
      granted.push(m);
      busyUntil = m.end;
    } else refused.push(m);
  }
  return { granted, refused };
}

/** Whether any two moments overlap in time (the check "never two at once" is built on). */
export function overlaps(moments: readonly Moment[]): boolean {
  const order = [...moments].sort((a, b) => a.start - b.start);
  for (let i = 1; i < order.length; i++) if (order[i].start < order[i - 1].end) return true;
  return false;
}

// --- The spark of an idea ------------------------------------------------------------------------

/**
 * The spark's numbers (spec 7.8): the pointer within `near` world units of her for over `dwell`
 * seconds sends a twinkle wave over `wave` seconds and flickers one lit bead; `cooldown` seconds
 * pass after it ends before the next.
 */
export const SPARK = { near: 1.2, dwell: 1.5, wave: 1.2, cooldown: 8 } as const;

export interface SparkState {
  /** How long the pointer has been near (seconds). */
  dwell: number;
  /** When the running spark began (-Infinity: none yet). */
  start: number;
  /** When the next may begin. */
  readyAt: number;
}

export function createSparkState(): SparkState {
  return { dwell: 0, start: -Infinity, readyAt: 0 };
}

export interface SparkInput {
  /** The character's clock (seconds) and the step since the last call. */
  t: number;
  dt: number;
  /** The pointer's distance from her in world units, or null with no pointer. */
  pointerDistance: number | null;
  /** An arm is lifting a pendant, or the head swell is running: no spark starts then. */
  lifting: boolean;
  swelling: boolean;
  /** Another moment (tilt, reach, wander) runs: the spark waits for it (the dwell is kept). */
  otherMoment: boolean;
  /** With reduced motion there are no sparks. */
  reducedMotion?: boolean;
}

export interface SparkFrame {
  /** True from the frame a spark starts until its wave ends. */
  active: boolean;
  /** True only on the frame it starts. */
  started: boolean;
  /** The `uSparkleWave` value: 0 at rest, then 1 down to 0 so the wave runs from her face to her crown. */
  wave: number;
  /** The lit bead's glow, 0 to 1. */
  bead: number;
}

/**
 * The `uSparkleWave` value `elapsed` seconds into a spark: 1 at the face down to 0 at the crown (the
 * shader's band sits at mix(1.25, -0.25, wave) on the height, so a falling value climbs the head), eased.
 */
export function sparkWaveAt(elapsed: number): number {
  if (!(elapsed >= 0 && elapsed < SPARK.wave)) return 0;
  const u = elapsed / SPARK.wave;
  return 1 - u * u * (3 - 2 * u);
}

/**
 * The lit bead's glow `elapsed` seconds into a spark: it catches as the wave reaches the crown,
 * flickers once and fades: a soft bump with one shallow catch before its peak, never a strobe.
 */
export function sparkBeadAt(elapsed: number): number {
  if (!(elapsed >= 0 && elapsed < SPARK.wave)) return 0;
  const u = elapsed / SPARK.wave;
  const bump = Math.sin(Math.PI * u) ** 2;
  return bump * (0.75 + 0.25 * Math.cos(2 * Math.PI * 2 * (u - 0.6)));
}

/** Which of `count` beads flickers for the spark that began at `start`: a fixed draw, so a replay lights the same one. */
export function sparkBeadIndex(count: number, start: number): number {
  if (!(count >= 1)) return 0;
  return Math.min(count - 1, Math.floor(seededRng(Math.round(start * 1000) + 0x5a17)() * count));
}

/**
 * Steps the spark. The dwell counts while the pointer is within `near` and resets when it leaves.
 * A spark starts when the dwell passes `dwell` seconds, the cooldown is over, no lift or swell is on
 * and no other moment runs (it waits, dwell kept, until the stage is free); it then runs `wave`
 * seconds. A lift or swell that begins mid-spark lets it finish (it is a twinkle, not an arm move).
 * Writes into `out` (pass one per character; none is allocated per frame).
 */
export function sparkStep(state: SparkState, input: SparkInput, out: SparkFrame = { active: false, started: false, wave: 0, bead: 0 }): SparkFrame {
  const { t, dt } = input;
  if (input.reducedMotion) {
    state.dwell = 0;
    out.active = false;
    out.started = false;
    out.wave = 0;
    out.bead = 0;
    return out;
  }
  const near = input.pointerDistance !== null && input.pointerDistance <= SPARK.near;
  state.dwell = near ? state.dwell + Math.max(0, dt) : 0;
  const running = t - state.start < SPARK.wave;
  let started = false;
  if (!running && state.dwell > SPARK.dwell && t >= state.readyAt && !input.lifting && !input.swelling && !input.otherMoment) {
    state.start = t;
    state.readyAt = t + SPARK.wave + SPARK.cooldown;
    state.dwell = 0;
    started = true;
  }
  const elapsed = t - state.start;
  out.active = elapsed >= 0 && elapsed < SPARK.wave;
  out.started = started;
  out.wave = out.active ? sparkWaveAt(elapsed) : 0;
  out.bead = out.active ? sparkBeadAt(elapsed) : 0;
  return out;
}
