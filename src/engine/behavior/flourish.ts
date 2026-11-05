import { ARM_IDS, type ArmId, PERSONALITY_VARIANT_DEFAULTS, type Personality, type StageId } from '../config/types';

// The idle flourish (gap G4, Veyra spec 7.8): every so often one arm slowly unrolls its tip curl
// toward straight and rolls it back. A shared ambient layer driven by `Personality.flourishRate`
// (flourishes per minute; 0, Nox's, is none). Each start is told to the instance's subscribers
// (`InstanceState.flourish`, amendment A2 X1: Flux's cup pulse listens; Veyra listens to nothing).
// No arm physics: the unroll is a scale on the chain's own tip straightening (ArmDrive.straighten).

/** One flourish lasts this long (seconds): it unrolls over the first half and rolls back over the second. */
export const FLOURISH_SECONDS = 3;

/** The most a flourish unrolls the tip curl: 40% of its turn, at the middle of the flourish. */
export const FLOURISH_UNROLL = 0.4;

/**
 * The wait from one flourish's start to the next, as a share of the mean wait (60 / rate s): 0.8 to
 * 4/3, so at Veyra's 4 a minute it is 12 to 20 s (spec 7.8), never in a beat. Never shorter than a
 * flourish, so two never run at once.
 */
const WAIT: readonly [number, number] = [0.8, 4 / 3];

const smootherstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/**
 * How far into its unroll a flourish that started at `start` is at `t` (seconds): 0 to 1 to 0 over
 * FLOURISH_SECONDS, eased in and out at both ends and level at the peak (the middle); 0 outside.
 */
export function flourishCurve(t: number, start: number): number {
  const u = (t - start) / FLOURISH_SECONDS;
  if (!(u > 0 && u < 1)) return 0;
  return u <= 0.5 ? smootherstep(u * 2) : smootherstep((1 - u) * 2);
}

/** The tip straightening (ArmDrive.straighten, 0 to FLOURISH_UNROLL) a flourish that started at `start` gives its arm at `t`. */
export function flourishUnroll(t: number, start: number): number {
  return FLOURISH_UNROLL * flourishCurve(t, start);
}

/**
 * Whether a flourish may play this frame: with motion on (`moving` above 0: neither reduced motion
 * nor `freeze`), out of the swim and out of the entrance. Octopus runs the flourish clock only then.
 */
export function flourishMayPlay(moving: number, swimming: boolean, stage: StageId): boolean {
  return moving > 0 && !swimming && stage !== 'entering';
}

/**
 * A playing flourish's unroll as its arm becomes busy: scaled by 1 - `busy` (the hold's turn toward
 * what it holds, 0 to 1), so it gives way as the hold comes in and is gone once the arm holds. A
 * flourish never moves the tip of an arm that is lifting or holding something.
 */
export function yieldedUnroll(unroll: number, busy: number): number {
  return unroll * (1 - Math.min(1, Math.max(0, busy)));
}

/**
 * The personality's nominal flourishes per minute (unset: 0, Nox's: none). The scheduler draws each
 * wait from 0.8 to 4/3 of 60 / rate s, whose mean is about 1.07 times 60 / rate, so the rate it
 * actually plays is about 0.94 of this (3.75 a minute, a 16 s mean wait, at 4).
 */
export function flourishRate(personality: Pick<Personality, 'flourishRate'>): number {
  return personality.flourishRate ?? PERSONALITY_VARIANT_DEFAULTS.flourishRate;
}

/** A flourish as it starts: the arm, and the start on the clock the scheduler is stepped with (seconds). */
export interface FlourishEvent {
  arm: ArmId;
  start: number;
}

/**
 * One instance's flourish starts, for whoever listens (`instance.flourish.subscribe`). Created per
 * instance (host/instance.ts), so two instances never hear each other's.
 */
export class FlourishEvents {
  private readonly listeners = new Set<(e: FlourishEvent) => void>();

  /** Calls `cb` with each flourish start from now on; returns the unsubscribe function. */
  subscribe(cb: (e: FlourishEvent) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /** Tells every subscriber of a start (each gets its own copy). */
  emit(e: FlourishEvent) {
    for (const cb of this.listeners) cb({ arm: e.arm, start: e.start });
  }
}

/** No arm busy (the default until the pendant lift, Task 19, supplies its own). */
const NONE_BUSY = () => false;

/**
 * When the flourishes start and on which arm. Step it each frame with a clock that runs only while
 * a flourish may play (the caller holds it still with motion off, `freeze` or the entrance). The
 * first comes one wait in; each next one a wait after the last began. A flourish starts only on an
 * arm `busy` says is free (the busy-arm hook: the arms holding something, and Task 19's pendant
 * lift), and not on the arm that flourished last; with every arm busy it waits for one to be free.
 * `rng` draws the waits and the arm (Math.random by default, as BlinkScheduler; a seeded stream in tests).
 */
export class FlourishScheduler {
  private readonly meanWait: number;
  private readonly rng: () => number;
  private next: number | null = null;
  private current: { arm: ArmId; index: number; start: number } | null = null;
  private last: ArmId | null = null;
  private readonly free: ArmId[] = [];

  constructor(rate: number, rng: () => number = Math.random) {
    // A rate that is not a finite number above 0 is none.
    this.meanWait = Number.isFinite(rate) && rate > 0 ? 60 / rate : Infinity;
    this.rng = rng;
  }

  private wait() {
    return Math.max(FLOURISH_SECONDS, this.meanWait * (WAIT[0] + this.rng() * (WAIT[1] - WAIT[0])));
  }

  /**
   * The flourish playing at `t` (its arm, the arm's index in ARM_IDS, and its start), or null. A
   * flourish that is due starts now, not when it was due, so a long gap gives one, not a burst; its
   * start is told to `events`.
   */
  step(t: number, busy: (arm: ArmId) => boolean = NONE_BUSY, events?: FlourishEvents): { arm: ArmId; index: number; start: number } | null {
    if (this.meanWait === Infinity) return null;
    if (this.current && t - this.current.start >= FLOURISH_SECONDS) this.current = null;
    if (this.next === null) this.next = t + this.wait();
    if (!this.current && t >= this.next) {
      this.free.length = 0;
      for (const arm of ARM_IDS) if (arm !== this.last && !busy(arm)) this.free.push(arm);
      if (this.free.length > 0) {
        const arm = this.free[Math.min(this.free.length - 1, Math.floor(this.rng() * this.free.length))];
        this.current = { arm, index: ARM_IDS.indexOf(arm), start: t };
        this.last = arm;
        this.next = t + this.wait();
        events?.emit({ arm, start: t });
      }
    }
    return this.current;
  }
}
