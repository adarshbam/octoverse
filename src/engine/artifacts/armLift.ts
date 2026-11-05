import type { ArmId, ChoosingStage, PendantSlot, Point2, SelectConfig, StageId } from '../config/types';
import type { StagePose } from '../poses/types';
import type { Vec3 } from '../world/types';
import { armPoint } from './pendant';

// The arm lift (spec 7.5, "Choosing a pendant"; contract 9.2 `SELECTS.armLift`): the arm a chosen
// pendant hangs from lifts it toward the pointer, or straight up and forward with the keyboard or a
// tap, with a smooth ease-out of about 450 ms, the root moving first and the tip arriving last. The
// pendant stays on its own arm and rides it up (the placement hangs it from the live arm). Letting
// go, or choosing another, lowers it back with a small settle, the personality's share of the
// approved run past rest. Pure parts and one small timeline; Octopus blends the arm's rest toward
// the target joint by joint and TechBubbles grows the chosen orb, brightens it and shortens its
// thread by the select's `scale` and `threadShorten`.

/** The most an arm with no traced lift turns about its root to lift (radians). */
export const LIFT_MAX_TURN = 0.9;
/** How far a keyboard or touch lift brings the arm forward, toward the visitor (radians of pitch; negative is forward). */
export const LIFT_PITCH = -0.2;
/** How long lowering takes, in ms. */
export const RELEASE_MS = 600;
/**
 * The approved run past rest as the arm lowers, as a share of the lift: the suction hold's lift
 * follow-through (artifacts/suctionHold.ts LIFT_OVERSHOOT), the one approved arm-lift overshoot.
 * The personality's `settle` (Task 16) scales it: Veyra's 0.6 lowers 0.06 past rest.
 */
export const RELEASE_OVERSHOOT = 0.1;
/** The share of the ease by which the tip trails the root (0: the arm moves as one piece). */
const LAG = 0.4;
/** The same for the release. */
const RELEASE_LAG = 0.3;

const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * How far the lift has gone at arc fraction `u` (0 root, 1 tip), `ms` after the choice, over an ease
 * of `easeMs`: an ease-out (cubic) that starts at the root and reaches the tip last, the tip setting
 * off `LAG` of the ease later; every point is there by `easeMs`.
 */
export function liftProgress(ms: number, u: number, easeMs: number): number {
  if (!(easeMs > 0)) return 1;
  const lag = LAG * easeMs;
  const x = clamp01((ms - clamp01(u) * lag) / (easeMs - lag));
  return x >= 1 ? 1 : 1 - (1 - x) ** 3;
}

const smootherstep = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

/**
 * How much of the lift is left at `u`, `ms` into lowering it (1 at the start, 0 at RELEASE_MS): it
 * eases down root first and runs past rest by at most `settle` x RELEASE_OVERSHOOT before it
 * settles at rest (0) with no speed.
 */
export function releaseShape(ms: number, u: number, settle: number): number {
  const lag = RELEASE_LAG * RELEASE_MS;
  const x = clamp01((ms - clamp01(u) * lag) / (RELEASE_MS - lag));
  if (x <= 0) return 1;
  if (x >= 1) return 0;
  const down = 1 - smootherstep(clamp01(x / 0.7));
  const past = Math.sin(Math.PI * clamp01((x - 0.55) / 0.45)) ** 2;
  return down - clamp01(settle) * RELEASE_OVERSHOOT * past;
}

/** One pendant's lift this frame: which pendant and arm, the lift's own clock, and whether it is being lowered. */
export interface LiftFrame {
  bubble: number;
  arm: ArmId;
  /** Ms of the lift (lifting) or of the lowering (releasing). */
  ms: number;
  releasing: boolean;
  /** The lift's clock when the lowering began: the lift it lowers from. */
  liftedMs: number;
  /** Motion off: at the target at once (it is gone at once when let go). */
  instant: boolean;
}

/** The lift's weight at `u` for this frame: 0 at rest, 1 at the target (below 0 in the settle past rest). */
export function liftWeightAt(frame: LiftFrame, u: number, easeMs: number, settle: number): number {
  if (frame.instant) return frame.releasing ? 0 : 1;
  if (!frame.releasing) return liftProgress(frame.ms, u, easeMs);
  return liftProgress(frame.liftedMs, u, easeMs) * releaseShape(frame.ms, u, settle);
}

/**
 * How busy an arm is for the idle flourish (Task 16): the larger of its suction hold's turn and its
 * lift (its size: the settle past rest is the arm still at work). A flourish starts only on an arm
 * at 0 and yields to this (`yieldedUnroll`).
 */
export const busyWeight = (hold: number, lift: number): number => Math.max(hold, Math.abs(lift));

/** How much larger a pendant's orb is, lifted by `lifted` (0 to 1): 1 up to the select's `scale` (1 for a select that does not lift). */
export const liftedScale = (select: SelectConfig, lifted: number): number => (select.kind === 'armLift' ? 1 + (select.scale - 1) * lifted : 1);

/** What share of its thread a pendant hangs on, lifted by `lifted` (0 to 1): 1 down to 1 - the select's `threadShorten` (1 for a select that does not lift). */
export const liftedReach = (select: SelectConfig, lifted: number): number => (select.kind === 'armLift' ? 1 - select.threadShorten * lifted : 1);

interface Entry {
  frame: LiftFrame;
  since: number;
}

/**
 * The arm lift's one timeline: choosing a pendant lifts its own arm (`armFor`); choosing another
 * lowers the first from wherever it is, so at most one is lifted; choosing none lowers it. A pendant
 * chosen again while it is lowered lifts again from about where it is. `instant` (reduced motion, a
 * still) lifts at once and lowers at once, with no settle. The frames are reused between samples.
 */
export class ArmLiftChoreography {
  instant = false;
  private readonly entries: Entry[] = [];
  private readonly frames: LiftFrame[] = [];
  private readonly armFor: (bubble: number) => ArmId;

  constructor(armFor: (bubble: number) => ArmId) {
    this.armFor = armFor;
  }

  /**
   * `instant`, when given, sets motion off or on from this choice on (as setting `instant` does);
   * `arm`, when given, is the arm a newly chosen pendant hangs from (otherwise `armFor` names it).
   */
  choose(bubble: number | null, nowMs: number, instant?: boolean, arm?: ArmId): void {
    if (instant !== undefined) this.instant = instant;
    const held = this.entries.find(e => !e.frame.releasing);
    if (held && held.frame.bubble === bubble) return;
    if (held) {
      held.frame.liftedMs = nowMs - held.since;
      held.frame.releasing = true;
      held.since = nowMs;
    }
    if (bubble === null) return;
    const back = this.entries.find(e => e.frame.bubble === bubble);
    if (back) {
      // Lifting again from part way down: the clock that gives about the tip's lift it has now.
      const left = Math.max(0, releaseShape(nowMs - back.since, 1, 0));
      back.frame.releasing = false;
      back.since = nowMs - back.frame.liftedMs * left;
      return;
    }
    this.entries.push({ frame: { bubble, arm: arm ?? this.armFor(bubble), ms: 0, releasing: false, liftedMs: 0, instant: false }, since: nowMs });
  }

  sample(nowMs: number): LiftFrame[] {
    this.frames.length = 0;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      if (entry.frame.releasing && (this.instant || nowMs - entry.since >= RELEASE_MS)) this.entries.splice(i, 1);
    }
    for (const entry of this.entries) {
      entry.frame.ms = nowMs - entry.since;
      entry.frame.instant = this.instant;
      this.frames.push(entry.frame);
    }
    return this.frames;
  }
}

/** What an arm lifts to: the arm, its lifted centre line (root first, in the pose's arm space) and its pitch toward the visitor. */
export interface ArmTarget {
  arm: ArmId;
  curve: readonly Point2[];
  /** Radians out of the arms' plane (negative: forward, toward the visitor), at the full lift. */
  pitch: number;
  /** Where along the lifted arm the pendant hangs at the full lift (arc fraction; liftHangAt), when the slot's own place was given. */
  hangAt?: number;
}

/** How much lower than its crown a lifted arm's tip must end for the arm to count as curling over (arm units). */
const CURL_DROP = 0.05;

/**
 * Where along a lifted arm (`curve`) its pendant hangs: under the arm's crown (its highest point past
 * half way) when the tip curls down over from it, as P4's lifted arm curls over its orb; otherwise
 * at the pendant's own slot `slotAt`. Pure; samples the curve as the rig does (armPoint).
 */
export function liftHangAt(curve: readonly Point2[], slotAt: number): number {
  let crownU = 1;
  let crownY = -Infinity;
  for (let k = 0; k <= 50; k++) {
    const u = 0.5 + (0.5 * k) / 50;
    const y = armPoint(curve, u)[1];
    if (y > crownY) {
      crownY = y;
      crownU = u;
    }
  }
  const tipY = armPoint(curve, 1)[1];
  return crownY - tipY > CURL_DROP ? crownU : slotAt;
}

const rotateAbout = (curve: readonly Point2[], turn: number): Point2[] => {
  if (turn === 0) return curve.slice();
  const [rx, ry] = curve[0];
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  return curve.map(([x, y]) => [rx + (x - rx) * c - (y - ry) * s, ry + (x - rx) * s + (y - ry) * c] as Point2);
};

/** The turn about the root, at most `limit`, that brings `curve`'s tip toward the angle `aim`; 0 if it would lower the tip. */
function liftTurn(curve: readonly Point2[], aim: number, limit: number): number {
  const [rx, ry] = curve[0];
  const [tx, ty] = curve[curve.length - 1];
  const from = Math.atan2(ty - ry, tx - rx);
  let turn = wrap(aim - from);
  // Straight down to straight up is half a turn either way: the arm's own side decides.
  if (Math.abs(Math.abs(turn) - Math.PI) < 1e-9) turn = tx < rx ? -Math.PI : Math.PI;
  turn = Math.max(-limit, Math.min(limit, turn));
  return Math.sin(from + turn) < Math.sin(from) ? 0 : turn;
}

/** How far a pointer turns an arm that has a traced lift (radians): the trace is the shape, the pointer only leans it. */
const POINTER_LEAN = 0.35;

/**
 * The lifted shape of the arm `slot` hangs from. With `traced` (the world's traced lift for this
 * arm: Veyra's P4 for T1, `tracedLift`), that shape, leaned toward the pointer by at most
 * POINTER_LEAN; without one, the arm as it rests in `rest`, turned rigidly about its root toward the
 * pointer, or straight up with no pointer (keyboard, touch), by at most LIFT_MAX_TURN, and never
 * lowered. With no pointer the lift also comes forward (LIFT_PITCH). `pointer` is in the arms' space.
 */
export function armLiftTarget(slot: Pick<PendantSlot, 'arm'> & Partial<PendantSlot>, pointer: Vec3 | null, rest: Pick<StagePose, 'arms'>, traced?: readonly Point2[]): ArmTarget {
  const base = traced ?? rest.arms[slot.arm];
  const [rx, ry] = base[0];
  const aim = pointer ? Math.atan2(pointer[1] - ry, pointer[0] - rx) : Math.PI / 2;
  const turn = traced && !pointer ? 0 : liftTurn(base, aim, traced ? POINTER_LEAN : LIFT_MAX_TURN);
  const curve = traced && turn === 0 ? traced : rotateAbout(base, turn);
  return { arm: slot.arm, curve, pitch: pointer ? 0 : LIFT_PITCH, ...(slot.at !== undefined ? { hangAt: liftHangAt(curve, slot.at) } : {}) };
}

const sameCurve = (a: readonly Point2[], b: readonly Point2[]) => a === b || (a.length === b.length && a.every((p, k) => p[0] === b[k][0] && p[1] === b[k][1]));

/**
 * The world's traced lift for `arm`, if it has one for the stage the focus came from: the arm of its
 * `techFocus` pose where that differs from the overview's (the focus is traced over the overview, as
 * Veyra's P4 is). None in the intro, and none for a world whose focus pose keeps the overview's arms.
 */
export function tracedLift(poses: Readonly<Partial<Record<StageId, Pick<StagePose, 'arms'>>>>, stage: ChoosingStage, arm: ArmId): readonly Point2[] | undefined {
  if (stage !== 'overview') return undefined;
  const focus = poses.techFocus?.arms[arm];
  const overview = poses.overview?.arms[arm];
  if (!focus || !overview || sameCurve(focus, overview)) return undefined;
  return focus;
}
