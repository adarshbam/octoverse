import type { StrokeTiming } from '../config/types';

// One swim stroke, after real octopus arm-swimming (spec 9.5): a slow recovery in which the arms
// open like an umbrella and the mantle fills, a fast power stroke in which they sweep back and
// close, the tips whipping straight at its end as the mantle squeezes, then a glide in which they
// trail behind while Nox coasts. All eight arms move together. With no arm physics (ruling R45),
// the follow-through is in these drives: the arms swing back first and the tips straighten last.

export type { StrokeTiming };

export type StrokePhase = 'recovery' | 'power' | 'glide';

export interface StrokeFrame {
  phase: StrokePhase;
  /** Progress through the phase, 0 to 1. */
  u: number;
  /** 0 to 1: how far the arms have opened toward SWIM_POSES.open (in recovery; held through the power stroke). */
  spread: number;
  /**
   * 0 to 1: how far the arms have swept back toward SWIM_POSES.trail (in the power stroke). It is 1
   * through the glide and lets go as the next recovery opens them, so a stroke runs into the next
   * without a jump: the arm rest is trail, blended toward open by `spread`, then back by `sweep`.
   */
  sweep: number;
  /** 0 to 1: the tips whip straight at the end of the power stroke (ArmDrive.straighten). */
  straighten: number;
  /** The mantle's size change, as a fraction: up to +fill in recovery, down to -squeeze in the power stroke. */
  mantle: number;
  /** 0 to 1: how hard the stroke drives Nox on. High in the power stroke, low in recovery, dying away in the glide. */
  thrust: number;
}

/** The push left while the arms open: Nox slows, but never stalls. */
const RECOVERY_THRUST = 0.12;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How the push dies away through the glide, 1 to 0: level as it starts, then falling fast, as drag takes the speed. */
const coast = (g: number) => (Math.exp(-6 * g * g) - Math.exp(-6)) / (1 - Math.exp(-6));

/**
 * The stroke at `clock`: its integer part is the stroke index, its fraction the progress through
 * one stroke, split into recovery, power and glide by the timing's durations. Every value runs on
 * smoothly through the phases and from one stroke into the next. One stroke lasts
 * recovery + power + glide seconds when the clock runs at one stroke per that many seconds.
 */
export function strokeAt(clock: number, timing: StrokeTiming): StrokeFrame {
  const { recovery, power, glide, fill, squeeze } = timing;
  const total = recovery + power + glide;
  const f = Number.isFinite(clock) ? clock - Math.floor(clock) : 0;
  const t = total > 0 ? f * total : 0;
  if (t < recovery) {
    // The arms swing forward a little (sweep lets go) and open; the mantle fills; Nox slows.
    const u = t / recovery;
    return { phase: 'recovery', u, spread: smoothstep(0, 1, u), sweep: 1 - smoothstep(0, 0.8, u), straighten: 0, mantle: fill * smoothstep(0, 0.9, u), thrust: RECOVERY_THRUST };
  }
  if (t < recovery + power) {
    // The arms sweep back and close, done by 85% of the stroke; the tips straighten after them,
    // from 35% to 95%; the mantle squeezes; the push builds fast.
    const u = (t - recovery) / power;
    return {
      phase: 'power',
      u,
      spread: 1,
      sweep: smoothstep(0, 0.85, u),
      straighten: smoothstep(0.35, 0.95, u),
      mantle: fill - (fill + squeeze) * smoothstep(0, 0.8, u),
      thrust: RECOVERY_THRUST + (1 - RECOVERY_THRUST) * smoothstep(0, 0.6, u),
    };
  }
  // The arms trail; the tips curl again; the mantle lets go; Nox coasts. `spread` falls back to 0
  // unseen (sweep holds the arms in the trail) ready for the next opening.
  const u = glide > 0 ? Math.min(1, (t - recovery - power) / glide) : 1;
  return {
    phase: 'glide',
    u,
    spread: 1 - smoothstep(0, 1, u),
    sweep: 1,
    straighten: 1 - smoothstep(0, 0.45, u),
    mantle: -squeeze * (1 - smoothstep(0, 0.7, u)),
    thrust: RECOVERY_THRUST + (1 - RECOVERY_THRUST) * coast(u),
  };
}

/**
 * How far the arms swing back behind Nox while he swims (ArmDrive.pitch, radians): `base` all the
 * while, and `sweep` more as a stroke sweeps them back (0.9 open, 1.3 swept back).
 */
export const SWIM_PITCH = { base: 0.9, sweep: 0.4 } as const;

/**
 * The arm drive a stroke gives: the swing back (ArmDrive.pitch) and the tips' straightening
 * (ArmDrive.straighten). `settle` (0 to 1) is how far Nox has arrived in his stage pose (the
 * entrance passes its `forward`, which comes before the arms spread): both ease to nothing as he
 * settles, so he lands with his arms exactly as they are at rest, wherever the stroke stopped.
 */
export function swimDrive(frame: Pick<StrokeFrame, 'sweep' | 'straighten'>, settle = 0) {
  const swimming = 1 - Math.min(1, Math.max(0, settle));
  return { pitch: (SWIM_PITCH.base + SWIM_PITCH.sweep * frame.sweep) * swimming, straighten: frame.straighten * swimming };
}
