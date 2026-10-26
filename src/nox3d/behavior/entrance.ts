import type { ArmId } from '../config/types';
import { STAGE_FRAMES } from '../stage/framing';

/**
 * The entrance (panel 1). Nox swims in from the left with its head turned toward screen right,
 * near profile, its arms bundled and trailing; the mantle beats in jet pulses, each driving it on.
 * It slows, gathers its arms and turns to face the visitor, landing in the intro pose. Times are
 * from the entrance's first frame.
 */
export const ENTRANCE_MS = 2500;
/** The moment panel 1 paints: Nox mid-swim, near the stage's centre. Still captures (`?freeze`) show it. */
export const ENTRANCE_PANEL_MS = 900;
/**
 * The head's turn toward screen right as Nox swims in (radians), traced from panel 1: near
 * profile, the near eye just inside the face's edge and the far eye hidden.
 */
export const ENTRANCE_START_YAW = 1.4;
/** A jet pulse every 0.8 s. */
export const ENTRANCE_PULSE_MS = 800;
/**
 * The arms gather from the swim into the intro pose as Nox turns to face the visitor, setting off
 * one after another, the first arriving as the entrance ends.
 */
export const ENTRANCE_TURN = { delayMs: 1400, durationMs: 1100, staggerMs: 40 };
/** A pulse squeezes the mantle by 6% at its height. */
export const MANTLE_SQUEEZE = 0.06;

/** How far past the visible left edge the swim starts: clear of the head and its glow. */
const CLEARANCE = 0.85;
/** Half the width the stage frame shows: the narrowest any window shows. */
const FRAME_HALF = STAGE_FRAMES.entering.width / 2;
/** Where the swim starts on the stage frame itself: just out of sight to the left. */
export const ENTRANCE_START_X = -(FRAME_HALF + CLEARANCE);

/** Where the swim starts on a window showing `visibleHalfWidth` units either side of the centre. */
export function entranceStartX(visibleHalfWidth: number) {
  return -(Math.max(visibleHalfWidth, FRAME_HALF) + CLEARANCE);
}

/**
 * The pulses: each carries Nox a share of the way, most on the first; the last, as Nox slows, is
 * gentler and only a nudge.
 */
const PULSES = [
  { share: 0.81, strength: 1 },
  { share: 0.14, strength: 1 },
  { share: 0.05, strength: 0.6 },
].map((pulse, k) => ({ ...pulse, atMs: k * ENTRANCE_PULSE_MS }));
/** A pulse's surge lasts 0.9 s; the last ends with the entrance. */
const SURGE_MS = 900;
/** A pulse squeezes for 0.15 s and lets go over 0.35 s; the arms flare with it. */
const SQUEEZE_MS = 150;
const RELEASE_MS = 350;
/** A wider window starts the swim further out; the extra way is made up in the first 0.6 s. */
const CATCH_UP_MS = 600;
/**
 * Height and size as the swim starts. Both ease to the intro's, passing panel 1's (y 0.285, scale
 * 0.9: Nox further off, a little high) at 900 ms, where x has come to about -0.6.
 */
const START_Y = 0.38;
const START_SCALE = 0.87;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const smootherstep = (x: number) => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
/** How far a surge has carried Nox (0 to 1): its speed builds, peaks a quarter of the way through and dies away. */
const surge = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - (1 - x) ** 4 * (1 + 4 * x));

export interface EntranceFrame {
  /** The body's place and size, as a stage pose's body. */
  x: number;
  y: number;
  scale: number;
  /** The head's turn toward screen right (radians); the body itself stays square to the camera. */
  yaw: number;
  /** How far into a jet pulse (0 to 1): the mantle squeezes and the arms flare. */
  pulse: number;
}

/** Where Nox is `tMs` into the entrance, swimming in from `startX`. */
export function entrancePath(tMs: number, startX = ENTRANCE_START_X): EntranceFrame {
  const t = Math.min(Math.max(tMs, 0), ENTRANCE_MS);
  let travelled = 0;
  let pulse = 0;
  for (const { atMs, share, strength } of PULSES) {
    travelled += share * surge((t - atMs) / SURGE_MS);
    const into = t - atMs;
    if (into >= 0 && into < SQUEEZE_MS + RELEASE_MS) {
      pulse = Math.max(pulse, strength * (into < SQUEEZE_MS ? smoothstep(into / SQUEEZE_MS) : 1 - smoothstep((into - SQUEEZE_MS) / RELEASE_MS)));
    }
  }
  const settle = smootherstep(t / ENTRANCE_MS);
  const turn = smoothstep((t - ENTRANCE_TURN.delayMs) / (ENTRANCE_MS - ENTRANCE_TURN.delayMs));
  return {
    x: ENTRANCE_START_X * (1 - travelled) + (startX - ENTRANCE_START_X) * (1 - smootherstep(t / CATCH_UP_MS)),
    y: START_Y * (1 - settle),
    scale: START_SCALE + (1 - START_SCALE) * settle,
    yaw: ENTRANCE_START_YAW * (1 - turn),
    pulse,
  };
}

/** The mantle's size during a pulse. */
export function mantleSqueeze(pulse: number) {
  return 1 - MANTLE_SQUEEZE * pulse;
}

/**
 * How much of the glow card before the chin shows with the head turned `yaw` radians from the
 * visitor. The card faces the visitor from in front of the face; turned side-on it would swing out
 * past the face and be seen edge-on as a bright streak, so it fades as the head turns.
 */
export function coreGlowFacing(yaw: number) {
  return Math.cos(Math.min(Math.abs(yaw), Math.PI / 2)) ** 2;
}

/**
 * How far each arm swings out about its base at a pulse's height (radians; ArmDrive.flare). The
 * bundle trails T1 on top down to T8 (the entering pose), so the upper four turn up, clockwise,
 * the lower four down, the outer arms most.
 */
const FLARE: Record<ArmId, number> = { T1: -0.35, T2: -0.27, T3: -0.19, T4: -0.11, T5: 0.11, T6: 0.19, T7: 0.27, T8: 0.35 };

export function armFlare(id: ArmId) {
  return FLARE[id];
}
