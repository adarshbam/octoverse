import { type EntranceShape, type SequenceDefaults, type SequenceId, LINEAR, SWELL_PUSH_SETTLED, hermiteKeys } from '../../../engine/sequences/keys.ts';

// Nox's sequence defaults: the keys each of his Theatre sheets starts from (the entrance, the bubble
// blow, the head swell and the arrival wiggle), and the entrance's shape. World data: the engine's
// sequence loader (theatre.ts) takes them through `WorldBundle.sequences`, never by import.
// `scripts/theatre-seed.mjs` runs this file directly under Node: erasable TypeScript only, and its
// one value import (keys.ts) names its extension for the same reason.

// --- The entrance (design 9.6) ---------------------------------------------------------------

/**
 * Nox's stroke, in seconds: recovery + power + glide of `personality.swim` in
 * Nox's character config (0.52 + 0.21 + 0.6). This file may not import it; entrance.test checks
 * that the two agree.
 */
export const NOX_STROKE_SECONDS = 1.33;

/**
 * The final arc: a golden spiral round the stage spot (sequences/entrance.ts `spiralOffset`). It
 * starts `r0` from the spot, at `phase` (radians, the angle about +y from +z): left of the spot
 * and a little behind it, where the spiral's own heading points at the visitor, so the swim runs
 * into it without a turn. With `yaw` += 2 pi spin, Nox then faces along the arc as it curls round.
 * The arc leaves the circle at atan(c / (1 - phi^-4)) to it, c = 2 ln(phi) / pi; the phase is a
 * half turn plus that angle's complement.
 */
const GOLDEN = (1 + Math.sqrt(5)) / 2;
const SPIRAL_RATE = (2 * Math.log(GOLDEN)) / Math.PI;
export const ENTRANCE_SPIRAL = { r0: 0.9, phase: Math.PI + Math.atan((1 - GOLDEN ** -4) / SPIRAL_RATE) } as const;

/** Nox's entrance turn: once round (2 pi), on the golden spiral above. */
export const NOX_ENTRANCE: EntranceShape = { turn: 2 * Math.PI, spiral: true, arc: ENTRANCE_SPIRAL };

/** Where the swim ends and the arc begins: the spot plus the spiral's start. */
const ARC_START = [ENTRANCE_SPIRAL.r0 * Math.sin(ENTRANCE_SPIRAL.phase), 0, ENTRANCE_SPIRAL.r0 * Math.cos(ENTRANCE_SPIRAL.phase)] as const;

/**
 * The swim runs from 0 to 4.5 s (the last stroke's glide ends there); Nox holds for ENTRANCE_HOLD
 * s in the trail, opens his arms 5.5 to 6.4 s, then the spin runs 6.4 to 7.4 s and the settle to 8.4 s.
 */
const SWIM_END = 4.5;
/** Seconds between the end of the last stroke and the opening of the arms (owner request, Task 19b). */
export const ENTRANCE_HOLD = 1.0;
/**
 * Seconds the arms take to open from the trail into the intro pose before the spin (owner request:
 * he turns only once they are fully out). Near twice a stroke's recovery (0.52 s), its own umbrella
 * opening, so it reads as a deliberate unfurl and not one more stroke; much longer and the hold
 * and the opening run together into a stall before the spin.
 *
 * It runs in two overlapping beats: first the arms swing forward out of the trail (the stroke
 * drives fade) and he rights himself, over ENTRANCE_FORWARD s; then, from ENTRANCE_SPREAD_FROM s in,
 * they spread to the intro pose. Spread while still swung back and leaning, the tips point behind
 * him, at the near left pillar just behind the arc's start (Task 19c, ruling C6).
 */
export const ENTRANCE_OPEN = 0.9;
export const ENTRANCE_FORWARD = 0.5;
export const ENTRANCE_SPREAD_FROM = 0.3;
const OPEN_START = SWIM_END + ENTRANCE_HOLD;
const FORWARD_END = OPEN_START + ENTRANCE_FORWARD;
const SPIN_START = OPEN_START + ENTRANCE_OPEN;
const SPIN_END = SPIN_START + 1;
const SETTLE_END = SPIN_END + 1;
/**
 * The swim path's waypoints: deep in the corridor on the left, drifting to the centre, to the
 * arc's start. The path must clear the pillars with Nox's arms as they are (sequences/entrance.ts
 * `pathClearance`): the corridor is 4.8 wide between pillar faces at -18 to -20, so he passes
 * there between strokes, arms back, and opens them only where it is wider.
 */
const WAYPOINTS: readonly (readonly [number, number, number])[] = [
  [-1.0, 1.3, -34],
  [-0.7, 0.9, -18],
  [-0.3, 0.45, -6],
  ARC_START,
];
/**
 * Fast far away, slowing on arrival, as the spike's ease: progress along the swim at `u` of its
 * time is 1 - (1 - u)^2.2, and its rate is this.
 */
const SWIM_EASE = 2.2;
const easeRate = (u: number) => SWIM_EASE * (1 - u) ** (SWIM_EASE - 1);

/**
 * x, y and z keyed at the waypoints. The eased progress runs with z (straight down the corridor),
 * so each waypoint's time is where the ease reaches its z; x and y follow it through their
 * waypoints, their slopes from the neighbours. Every slope is zero on arrival.
 */
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

/*
 * Ruling on the stroke count (Task 18, ledger R48/R49). The spec (9.6) asks for four or five
 * strokes between 1 and 4.5 s, but its own stroke (9.5) lasts 1.03 to 1.65 s, and Nox's 1.33 s:
 * 3.5 s holds 2.6 of his. Four would need the stroke run 1.5 to 1.75 times fast, every phase out
 * of its range (0.30 / 0.12 / 0.34 s). The stroke timing is the owner-approved motion; the beats
 * are "to be tuned live". So the stroke runs at Nox's own rate and the window opens a little
 * early: three whole strokes from 0.51 to 4.5 s (the first recovery as he comes out of the murk),
 * surges at about 1.0, 2.4 and 3.7 s. It ends on a whole stroke, the arms trailing with the tips
 * curled, so he holds a second in the trail, opens his arms, then turns and settles. The reveal keeps its beat.
 */
const STROKES = 3;

const ENTRANCE: SequenceDefaults = {
  length: SETTLE_END,
  objects: {
    main: {
      props: { x: WAYPOINTS[0][0], y: WAYPOINTS[0][1], z: WAYPOINTS[0][2], stroke: 0, spin: 0, forward: 0, open: 0, settle: 0, reveal: 0, pitch: 0.45, yaw: 0, surge: 0.6 },
      keys: {
        ...swimKeys(),
        // Stroke clock: whole strokes, at an even rate of one per NOX_STROKE_SECONDS.
        stroke: [[SWIM_END - STROKES * NOX_STROKE_SECONDS, 0, LINEAR], [SWIM_END, STROKES, LINEAR]],
        // After the hold the arms swing forward out of the trail, then unfurl into the intro pose,
        // eased in and out, fully open before the turn begins.
        forward: [[OPEN_START, 0], [FORWARD_END, 1]],
        open: [[OPEN_START + ENTRANCE_SPREAD_FROM, 0], [SPIN_START, 1]],
        // One full turn along the spiral arc into the spot.
        spin: [[SPIN_START, 0], [SPIN_END, 1]],
        // The face lands on the gentle smile, the intro's words come in.
        settle: [[SPIN_END, 0], [SETTLE_END, 1]],
        // Out of the murk: the glow and aura first, then the shape.
        reveal: [[0, 0], [1, 1]],
        // Leaning head first while swimming and in the hold, upright as the arms come forward.
        pitch: [[0, 0.45], [OPEN_START, 0.45], [FORWARD_END, 0]],
      },
    },
  },
};

// --- The bubble blow (design 9.8) ------------------------------------------------------------

// The blow plays this sheet once per bubble, BLOW_STAGGER s apart (the engine's blow module, sequences/bubbleBlow.ts).

/** Handles that leave a key fast and arrive slowly (an ease out, as CSS cubic-bezier(0.33, 1, 0.68, 1)). */
const EASE_OUT_RIGHT = [1 / 3, 1 / 3, 0.33, 1] as const;
const EASE_OUT_LEFT = [0.68, 1, 1 / 3, 1 / 3] as const;

/**
 * One bubble's blow, from its first puff: the cheeks fill and the mouth rounds (0 to 0.25 s), the
 * bubble pops out as the cheeks empty (0.25 to 0.33 s), then it grows to full size with a wobble
 * as it goes from the mouth to its orbit (0.33 to 0.9 s). `emerged` is how far along that way it is
 * (0 at the mouth, 1 on its orbit), `scale` its size (1 full), `wobble` its squash and stretch
 * (wider by that fraction, shorter by as much; negative the other way).
 */
const BUBBLE_BLOW: SequenceDefaults = {
  length: 0.9,
  objects: {
    main: {
      props: { puff: 0, mouthRound: 0, emerged: 0, scale: 0, wobble: 0 },
      keys: {
        puff: [[0, 0], [0.25, 1], [0.33, 0]],
        mouthRound: [[0, 0], [0.1, 1], [0.33, 1], [0.5, 0]],
        scale: [[0.25, 0, EASE_OUT_RIGHT], [0.33, 0.45, [0.68, 1, 0.33, 1]], [0.9, 1, EASE_OUT_LEFT]],
        // At the lips through the pop, then away to the orbit, gathering pace and settling in.
        emerged: [[0.25, 0, LINEAR], [0.33, 0, [2 / 3, 2 / 3, 0.25, 0.1]], [0.9, 1, EASE_OUT_LEFT]],
        wobble: [[0.33, 0], [0.42, 0.16], [0.52, -0.12], [0.62, 0.08], [0.72, -0.05], [0.81, 0.025], [0.9, 0]],
      },
    },
  },
};

// --- The head swell (design 9.9) -------------------------------------------------------------

/**
 * How far the bubbles' orbits are pushed out (orbitPoint's `swell`) at the overshoot's peak; the
 * settled push (SWELL_PUSH_SETTLED, keys.ts) is where the swell's last key rests. The overview's
 * rings are framed close to the stage's edge: these keep every bubble inside the frame and clear of
 * the face and the dome's panel (headSwell.test.ts).
 */
export const SWELL_PUSH_PEAK = 0.14;

/**
 * The head swelling into the dome like a thought, from the click: a small squeeze first (the
 * anticipation, 0 to 0.4 s), then the swell (`morph`, the head's change into the dome, 0 closed, 1
 * open) running past full to 1.07 at 0.85 s and settling at 1 by 1.3 s. The bubbles are pushed out
 * with it (`push`, past and back like the swell), and the head's effect (`effect`, 0 to 1) fades in
 * as it settles. Closing plays this backwards (sequences/headSwell.ts).
 */
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

/**
 * The happy wiggle once the entrance has settled (motion/micro.ts `arrivalWiggle`): the body rocks
 * side to side three times, each smaller, and the arms fan open and shut a beat behind it, so they
 * follow through. Values are fractions of the personality's strengths (`personality.micro.arrival`);
 * the sheet's 1.4 s is stretched to the personality's duration. Each key is a turning point, so
 * Theatre's default ease in and out makes each swing round.
 */
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

/**
 * Code defaults for each sheet's props and keyframes. `scripts/theatre-seed.mjs` writes them into
 * the state JSON the first time; exports from the studio replace that file afterwards.
 * Erasable TypeScript only, and no value imports (the one import is type-only): the seed script runs this file directly under Node.
 */
export const SEQUENCE_DEFAULTS: Record<Exclude<SequenceId, 'bloom' | 'twinkle'>, SequenceDefaults> = {
  entrance: ENTRANCE,
  bubbleBlow: BUBBLE_BLOW,
  headSwell: HEAD_SWELL,
  arrival: ARRIVAL,
};
