import { type EntranceShape, type SequenceDefaults, type SequenceId, LINEAR, SWELL_PUSH_SETTLED, hermiteKeys } from '../../../engine/sequences/keys.ts';

// Flux's sequence defaults: the keys each of his Theatre sheets starts from (the entrance, the
// bubble blow, the head swell and the arrival wiggle), and the entrance's shape. World data: the
// engine's sequence loader (theatre.ts) takes them through `WorldBundle.sequences`, never by import.
// First pass (Task 2): the structure is the engine's, the entrance is timed to Flux's own stroke
// and an open stage (no pillars to clear), and the blow, the swell and the arrival start from the
// engine's shared timings until the entrance and technology tasks tune them with the owner.
// Erasable TypeScript only, one value import naming its extension: a seed script may run this file under Node.

// --- The entrance (spec 7.9) -----------------------------------------------------------------

/**
 * Flux's stroke, in seconds: recovery + power + glide of `strokeTiming(personality)` in his character
 * config (0.38 + 0.16 + 0.32: the glide is `swim.glide` times `glideBias` 0.55). This file may not
 * import it; a test checks the two agree.
 */
export const FLUX_STROKE_SECONDS = 0.86;

/**
 * The final arc: a golden spiral round the stage spot (sequences/entrance.ts `spiralOffset`), from
 * `r0` stage units out, at `phase` radians about +y from +z: left of the spot and a little behind
 * it, where the spiral's own heading points at the visitor.
 */
const GOLDEN = (1 + Math.sqrt(5)) / 2;
const SPIRAL_RATE = (2 * Math.log(GOLDEN)) / Math.PI;
export const ENTRANCE_SPIRAL = { r0: 0.9, phase: Math.PI + Math.atan((1 - GOLDEN ** -4) / SPIRAL_RATE) } as const;

/** Flux's entrance turn: once round (2 pi), on the golden spiral above. */
export const FLUX_ENTRANCE: EntranceShape = { turn: 2 * Math.PI, spiral: true, arc: ENTRANCE_SPIRAL };

/** Where the swim ends and the arc begins: the spot plus the spiral's start. */
const ARC_START = [ENTRANCE_SPIRAL.r0 * Math.sin(ENTRANCE_SPIRAL.phase), 0, ENTRANCE_SPIRAL.r0 * Math.cos(ENTRANCE_SPIRAL.phase)] as const;

/** The swim runs from 0 to 4.3 s, five whole strokes; a short hold, the arms open, the spin, the settle. */
const SWIM_END = 4.3;
const STROKES = 5;
const HOLD = 0.6;
const OPEN = 0.9;
const FORWARD = 0.5;
const SPREAD_FROM = 0.3;
const OPEN_START = SWIM_END + HOLD;
const FORWARD_END = OPEN_START + FORWARD;
const SPIN_START = OPEN_START + OPEN;
const SPIN_END = SPIN_START + 1;
const SETTLE_END = SPIN_END + 1;

/** The swim path's waypoints: out of the murk on the left, drifting to the centre, to the arc's start. */
const WAYPOINTS: readonly (readonly [number, number, number])[] = [
  [-1.0, 1.3, -34],
  [-0.7, 0.9, -18],
  [-0.3, 0.45, -6],
  ARC_START,
];
/** Fast far away, slowing on arrival: progress along the swim at `u` of its time is 1 - (1 - u)^2.2. */
const SWIM_EASE = 2.2;
const easeRate = (u: number) => SWIM_EASE * (1 - u) ** (SWIM_EASE - 1);

/** x, y and z keyed at the waypoints; the eased progress runs with z, every slope is zero on arrival. */
function swimKeys() {
  const z0 = WAYPOINTS[0][2];
  const zEnd = WAYPOINTS[WAYPOINTS.length - 1][2];
  const progress = WAYPOINTS.map(w => (w[2] - z0) / (zEnd - z0));
  const u = progress.map(p => 1 - (1 - p) ** (1 / SWIM_EASE));
  const axis = (a: 0 | 1 | 2) =>
    hermiteKeys(
      WAYPOINTS.map((w, i) => {
        const lo = Math.max(0, i - 1);
        const hi = Math.min(WAYPOINTS.length - 1, i + 1);
        const perProgress = (WAYPOINTS[hi][a] - WAYPOINTS[lo][a]) / (progress[hi] - progress[lo]);
        return [SWIM_END * u[i], w[a], (perProgress * easeRate(u[i])) / SWIM_END] as const;
      }),
    );
  return { x: axis(0), y: axis(1), z: axis(2) };
}

const ENTRANCE: SequenceDefaults = {
  length: SETTLE_END,
  objects: {
    main: {
      props: { x: WAYPOINTS[0][0], y: WAYPOINTS[0][1], z: WAYPOINTS[0][2], stroke: 0, spin: 0, forward: 0, open: 0, settle: 0, reveal: 0, pitch: 0.45, yaw: 0, surge: 0.6 },
      keys: {
        ...swimKeys(),
        // Stroke clock: whole strokes at an even rate of one per FLUX_STROKE_SECONDS.
        stroke: [[SWIM_END - STROKES * FLUX_STROKE_SECONDS, 0, LINEAR], [SWIM_END, STROKES, LINEAR]],
        forward: [[OPEN_START, 0], [FORWARD_END, 1]],
        open: [[OPEN_START + SPREAD_FROM, 0], [SPIN_START, 1]],
        spin: [[SPIN_START, 0], [SPIN_END, 1]],
        settle: [[SPIN_END, 0], [SETTLE_END, 1]],
        reveal: [[0, 0], [1, 1]],
        pitch: [[0, 0.45], [OPEN_START, 0.45], [FORWARD_END, 0]],
      },
    },
  },
};

// --- The bubble blow (design 9.8) ------------------------------------------------------------

/** Handles that leave a key fast and arrive slowly (an ease out, as CSS cubic-bezier(0.33, 1, 0.68, 1)). */
const EASE_OUT_RIGHT = [1 / 3, 1 / 3, 0.33, 1] as const;
const EASE_OUT_LEFT = [0.68, 1, 1 / 3, 1 / 3] as const;

/** One bubble's blow: the cheeks fill and the mouth rounds, the bubble pops out, then grows with a wobble to its orbit. */
const BUBBLE_BLOW: SequenceDefaults = {
  length: 0.9,
  objects: {
    main: {
      props: { puff: 0, mouthRound: 0, emerged: 0, scale: 0, wobble: 0 },
      keys: {
        puff: [[0, 0], [0.25, 1], [0.33, 0]],
        mouthRound: [[0, 0], [0.1, 1], [0.33, 1], [0.5, 0]],
        scale: [[0.25, 0, EASE_OUT_RIGHT], [0.33, 0.45, [0.68, 1, 0.33, 1]], [0.9, 1, EASE_OUT_LEFT]],
        emerged: [[0.25, 0, LINEAR], [0.33, 0, [2 / 3, 2 / 3, 0.25, 0.1]], [0.9, 1, EASE_OUT_LEFT]],
        wobble: [[0.33, 0], [0.42, 0.16], [0.52, -0.12], [0.62, 0.08], [0.72, -0.05], [0.81, 0.025], [0.9, 0]],
      },
    },
  },
};

// --- The head swell (design 9.9) -------------------------------------------------------------

/** How far the orbits are pushed out at the overshoot's peak; the settled push is SWELL_PUSH_SETTLED. */
export const SWELL_PUSH_PEAK = 0.14;

/** The head swelling into the dome: a small squeeze, the swell past full and back, the orbits pushed out with it, the effect fading in. */
const HEAD_SWELL: SequenceDefaults = {
  length: 1.5,
  objects: {
    main: {
      props: { squeeze: 0, morph: 0, push: 0, effect: 0 },
      keys: {
        squeeze: [[0, 0], [0.2, 1], [0.4, 0]],
        morph: [[0.18, 0], [0.85, 1.07], [1.3, 1]],
        push: [[0.3, 0], [0.9, SWELL_PUSH_PEAK], [1.35, SWELL_PUSH_SETTLED]],
        effect: [[0.65, 0], [1.5, 1]],
      },
    },
  },
};

// --- The arrival wiggle (design 9.7) ---------------------------------------------------------

/** The happy wiggle once the entrance has settled: the body rocks side to side, each swing smaller, and the arms fan a beat behind it. */
const ARRIVAL: SequenceDefaults = {
  length: 1.4,
  objects: {
    main: {
      props: { roll: 0, armWave: 0 },
      keys: {
        roll: [[0, 0], [0.18, 1], [0.44, -0.75], [0.7, 0.45], [0.96, -0.2], [1.2, 0]],
        armWave: [[0.08, 0], [0.3, 1], [0.56, -0.6], [0.82, 0.35], [1.08, -0.12], [1.4, 0]],
      },
    },
  },
};

/** Code defaults for each sheet's props and keyframes (a seed script writes them into the state JSON). */
export const SEQUENCE_DEFAULTS: Record<SequenceId, SequenceDefaults> = {
  entrance: ENTRANCE,
  bubbleBlow: BUBBLE_BLOW,
  headSwell: HEAD_SWELL,
  arrival: ARRIVAL,
};
