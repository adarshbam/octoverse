import { type EntranceShape, type Key, type SequenceDefaults, type SequenceId, LINEAR, SWELL_PUSH_SETTLED, hermiteKeys } from '../../../engine/sequences/keys.ts';

// Flux's sequence defaults: the keys each of his Theatre sheets starts from (the entrance, the
// bubble blow, the head swell and the arrival wiggle), and the entrance's shape. World data: the
// engine's sequence loader (theatre.ts) takes them through `WorldBundle.sequences`, never by import.
// The entrance and the arrival wiggle are Flux's own (Task 15); the blow and the swell start from
// the engine's shared timings until the technology tasks tune them with the owner.
// Erasable TypeScript only, one value import naming its extension: a seed script may run this file under Node.

// --- The entrance (spec 7.9) -----------------------------------------------------------------

/**
 * Flux's stroke, in seconds: recovery + power + glide of `strokeTiming(personality)` in his character
 * config (0.38 + 0.16 + 0.32: the glide is `swim.glide` times `glideBias` 0.55). This file may not
 * import it; a test checks the two agree.
 */
export const FLUX_STROKE_SECONDS = 0.86;

/**
 * The entrance's shape (Task 15): no spiral (the engine's glide-turn, sequences/entrance.ts
 * glideTurnYaw, built with Veyra). The keyed path is the whole way to the stage spot, past it and
 * back; the sheet's `spin` then turns him in place: a quick turn of pi into the front.
 */
export const FLUX_ENTRANCE: EntranceShape = { turn: Math.PI, spiral: false };

/**
 * The beats (spec 7.9), in seconds. He bursts in from the left edge already moving (0 to 0.5), swims
 * five quick strokes with short glides (0.5 to 3.0) while the portal's arcs light one by one (2.2 to
 * 3.0) and its disc flashes, overshoots his spot a little and springs back (3.0 to 3.6), turns
 * quickly into the front with a happy bounce (3.6 to 4.2), and settles (4.2 to 5.0): the arms pop
 * open into the intro pose and the face lands on the big open smile.
 */
const REVEAL_END = 0.25;
const BRAKE = 3.0;
const TURN_START = 3.6;
const TURN_END = 4.2;
const SETTLE_END = 5;

/**
 * Ruling on the stroke rate (as Veyra's Task 18 ruling, and Nox's R48/R49). His stroke at its own
 * timing is 0.86 s, and five of them are 4.3 s; the spec asks for five between 0.5 and 3.0 s. So the
 * stroke clock runs faster than his timing: one stroke per 0.52 s, from 0.36 s. Each power stroke
 * (the surge, 44% into a stroke) starts at 0.59, 1.11, 1.63, 2.15 and 2.67 s and lasts 0.1 s; the
 * glides between are short (0.19 s). The fifth stroke ends at 2.96 s, just before he brakes.
 */
const STROKES = 5;
const STROKE_SECONDS = 0.52;
const STROKE_START = 0.36;
const STROKE_END = STROKE_START + STROKES * STROKE_SECONDS;

/**
 * The path: [seconds, x, y, z] waypoints. He comes in across the left edge of the frame (it is 9
 * units wide at 16:9, so x -4.5) at about 0.3 s, already at over 3 units a second, along the front
 * edge of the clear corridor the layout keeps (place/kit.ts PIPELINE_CORRIDOR; z 1 to 1.2 here, in
 * front of the left towers and the rack module at (-2.4, -2.4), so his arms clear them with the
 * stroke's umbrella fully open: 0.29), drifting down and toward the spot as the strokes slow him. He
 * reaches the spot's x a little after 3 s, still moving, runs past it by 0.25 (the overshoot, a little
 * toward the visitor, away from the rack module behind on the right) and springs back to the spot by
 * 3.6 s. The strokes pull him along it in surges (`surge` 0.36: the clock runs 1.65 times his stroke's
 * own rate, so this is about Nox's 0.6 push), 1.2 to 5.2 units a second.
 */
const WAYPOINTS: readonly (readonly [number, number, number, number])[] = [
  [0, -6.8, 0.95, 1.05],
  [0.5, -5.2, 0.8, 1.15],
  [1.5, -3.0, 0.55, 1.2],
  [2.5, -1.05, 0.28, 0.8],
  [3.08, 0, 0.12, 0.35],
  [3.32, 0.25, 0.08, 0.2],
  [TURN_START, 0, 0, 0],
];
/** The waypoints where he stops: the overshoot's far end and the spot. */
const STOPS = new Set([5, 6]);

/** One axis of the path keyed at the waypoints, its slopes from the neighbours (zero where he stops), so the speed runs on smoothly. */
function pathAxis(a: 1 | 2 | 3) {
  return hermiteKeys(
    WAYPOINTS.map((w, i) => {
      const lo = Math.max(0, i - 1);
      const hi = Math.min(WAYPOINTS.length - 1, i + 1);
      const slope = STOPS.has(i) ? 0 : (WAYPOINTS[hi][a] - WAYPOINTS[lo][a]) / (WAYPOINTS[hi][0] - WAYPOINTS[lo][0]);
      return [w[0], w[a], slope] as const;
    }),
  );
}

/**
 * The happy bounce in the turn: the body pops up 0.14 and dips a little below the spot before it
 * lands on it (turning points, so each key's slope is zero).
 */
const BOUNCE: readonly Key[] = [
  [3.85, 0.14],
  [4.1, -0.03],
  [4.3, 0],
];

/**
 * The yaw (radians, about +y; the sheet's `yaw` key on top of the glide-turn's -pi before the turn).
 * Swimming in he faces right and a little toward the visitor (P1's three-quarter view: 65 degrees,
 * so the key is -115 degrees, a total of -295). As he brakes and springs back the key eases to 0, the
 * body swinging on round (to -180, his back to the visitor at 3.6 s), and the spin carries on the
 * same way, a quick turn of pi to exactly 0. The key arrives at TURN_RATE and the spin leaves at it,
 * so the swing and the turn are one unbroken twirl (the yaw never decreases).
 */
const YAW_SWIM = (-115 * Math.PI) / 180;
const TURN_RATE = 4.5;

/**
 * The portal run (spec 7.9: "like a pipeline run going green"): each arc's inlay rises from its faint
 * rest (1) to a flash (ARC_PEAK, the most its membrane draws: 1 plus the inlay's `flash` 4, place/
 * config.ts) and settles lit (ARC_LIT), 150 ms after the one before; the disc flashes once (to 1 plus
 * its `flash` 0.4) after the fourth, and breathes on at rest. With reduced motion, or once the
 * entrance has played, the kit rests where the sheet ends: the arcs lit.
 */
const ARC_PEAKS = [2.3, 2.45, 2.6, 2.75] as const;
const ARC_RISE = 0.1;
const ARC_FALL = 0.35;
const ARC_PEAK = 5;
const ARC_LIT = 3;
const DISC_PEAK = 1.4;
const DISC_AT = 2.95;
const arcKeys = (peak: number): Key[] => [[peak - ARC_RISE, 1], [peak, ARC_PEAK], [peak + ARC_FALL, ARC_LIT]];

/** Handles that leave a key fast and arrive slowly: the arms' pop open. */
const POP_RIGHT = [1 / 3, 1 / 3, 0.33, 1] as const;
const POP_LEFT = [0.68, 1, 1 / 3, 1 / 3] as const;

const ENTRANCE: SequenceDefaults = {
  length: SETTLE_END,
  objects: {
    main: {
      props: {
        x: WAYPOINTS[0][1],
        y: WAYPOINTS[0][2],
        z: WAYPOINTS[0][3],
        stroke: 0,
        spin: 0,
        forward: 0,
        open: 0,
        settle: 0,
        reveal: 0,
        pitch: 0.45,
        yaw: 0,
        surge: 0.36,
        portalArc1: 1,
        portalArc2: 1,
        portalArc3: 1,
        portalArc4: 1,
        portalDisc: 1,
      },
      keys: {
        x: pathAxis(1),
        // Down toward the spot, then the happy bounce in the turn.
        y: [...pathAxis(2), ...BOUNCE],
        z: pathAxis(3),
        // Stroke clock: five whole strokes at an even rate, ending as he brakes.
        stroke: [[STROKE_START, 0, LINEAR], [STROKE_END, STROKES, LINEAR]],
        // He brakes with the arms flared forward: out of the trail as he runs past the spot, a little
        // open; they hold that through the turn and pop open into the intro pose after it.
        forward: [[BRAKE, 0], [3.3, 1]],
        open: [[3.05, 0], [3.4, 0.4], [TURN_END, 0.45, POP_RIGHT], [4.65, 1, POP_LEFT]],
        settle: [[TURN_END, 0], [SETTLE_END, 1]],
        // The swing round as he springs back, then the quick turn: one twirl, the yaw never decreasing.
        yaw: hermiteKeys([[BRAKE, YAW_SWIM, 0], [TURN_START, 0, TURN_RATE]]),
        spin: hermiteKeys([[TURN_START, 0, TURN_RATE / Math.PI], [TURN_END, 1, 0]]),
        // Already moving as he bursts in: the glow, then the shape, in a quarter second.
        reveal: [[0, 0], [REVEAL_END, 1]],
        // Head first into the swim; leaning back as he brakes; upright through the turn.
        pitch: [[0, 0.45], [2.9, 0.45], [3.3, -0.15], [3.75, 0]],
        portalArc1: arcKeys(ARC_PEAKS[0]),
        portalArc2: arcKeys(ARC_PEAKS[1]),
        portalArc3: arcKeys(ARC_PEAKS[2]),
        portalArc4: arcKeys(ARC_PEAKS[3]),
        portalDisc: [[ARC_PEAKS[3] + 0.05, 1], [DISC_AT, DISC_PEAK], [DISC_AT + 0.45, 1]],
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

/**
 * The happy wiggle once the entrance has settled (spec 7.8: a happy bounce, livelier than Nox's;
 * the personality's `micro.arrival` sets the size and the 1.4 s it is played over). Flux's is quicker
 * than the shared one: each swing takes about 0.23 s, not 0.26, and the arms flick out with the
 * first rock instead of a beat behind it, then each swing is smaller and it is still by 1.1 s. The
 * engine's arrival has no bob of the body (roll and armWave only): the bounce itself is in the
 * entrance's turn (the `y` keys above). Each key is a turning point.
 */
const ARRIVAL: SequenceDefaults = {
  length: 1.4,
  objects: {
    main: {
      props: { roll: 0, armWave: 0 },
      keys: {
        roll: [[0, 0], [0.15, 1], [0.38, -0.8], [0.62, 0.5], [0.86, -0.25], [1.1, 0]],
        armWave: [[0, 0], [0.12, 1], [0.34, -0.7], [0.58, 0.45], [0.82, -0.18], [1.1, 0]],
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
