import { type EntranceShape, type SequenceDefaults, type SequenceId, LINEAR, SWELL_PUSH_SETTLED, hermiteKeys } from '../../../engine/sequences/keys.ts';

// Veyra's sequence defaults: the keys each of her Theatre sheets starts from. World data: the
// engine's sequence loader (theatre.ts) takes them through `WorldBundle.sequences`, never by import.
// `scripts/theatre-seed.mjs --world=veyra` runs this file directly under Node: erasable TypeScript
// only, and its one value import (keys.ts) names its extension for the same reason.

// --- The entrance (spec 7.9) -----------------------------------------------------------------

/**
 * The entrance's shape: no spiral (the engine's glide-turn, sequences/entrance.ts glideTurnYaw). The
 * keyed path is the whole way to the stage spot, and the sheet's `spin` turns her in place on it:
 * the yaw runs from -200 degrees to exactly 0 (facing the visitor) as `spin` goes 0 to 1.
 */
export const VEYRA_ENTRANCE: EntranceShape = { turn: (200 * Math.PI) / 180, spiral: false };

/**
 * Seconds of the beats (spec 7.9). She appears out of the haze from 0 to 1 s, swims in three strokes
 * (the clock starts at STROKE_START and runs one stroke per STROKE_SECONDS, ending on a whole
 * stroke), reaches the spot as the turn ends, turns slowly from 4.5 to 5.5 s, and settles from 5.5 to
 * 6.5 s: the arms swing forward and open into the intro pose, the face lands, the sparkle shimmer runs.
 */
const APPEAR_END = 1;
const TURN_START = 4.5;
const TURN_END = 5.5;
const SETTLE_END = 6.5;

/**
 * Ruling on the stroke rate (Task 18, as Nox's R48/R49). Her stroke at its own timing is 0.65 + 0.26 +
 * 1.0 s = 1.91 s, and three of them are 5.7 s; the spec asks for three between 1 and 4.5 s. So the
 * stroke clock runs a little faster than her timing says: one per 1.7 s (the glide 0.88 s, not 1.0;
 * Nox's is 0.6 s), the first surge (the power stroke's start, 34% into a stroke) at 1.03 s, the
 * second at 2.73 s and the third at 4.43 s, every power stroke between 1 and 4.5 s. The third stroke
 * ends at 5.55 s, its glide carrying her under the turn, with the arms still trailing until the
 * settle swings them forward.
 */
const STROKES = 3;
const STROKE_SECONDS = 1.7;
const STROKE_START = 0.45;
const STROKE_END = STROKE_START + STROKES * STROKE_SECONDS;

/**
 * The padlock's ring and the membrane (spec 7.9, ~3.5 s): the ring turns a quarter turn between 3.3
 * and 3.7 s and the membrane flashes softly cyan, peaking at 3.5 s and gone by 3.9 s. The flash is the
 * emissive intensity, 1 at rest; its peak is 1 plus the membrane's `flash` in the place (0.2), the most
 * its shader draws (place/config.ts; entrance.test checks the two agree).
 */
const LOCK_START = 3.3;
const LOCK_END = 3.7;
const FLASH_PEAK = 1.2;

/**
 * The path: [seconds, x, y, z] waypoints, the last the stage spot. She appears deep on the left (x -5.9,
 * 20.5 back, where the haze hides her), swims across the vault's deep water to the clear channel
 * between the blocks and the portal, and passes in front of the portal on its left at about 3.5 s (the
 * ring's click, 2.4 units in front of it and 4.5 to its left), then glides down the channel to the spot as she turns.
 * The worn corridor of the floor (place/kit.ts VAULT_CORRIDOR) squeezes between two blocks, 1.9 clear
 * of the stone at the tightest and a gap of 0.2 for arms drawn in: no room for her arms open, which the
 * spec asks (7.9), so she keeps to the open water over it. This route keeps 2.58 from every footprint
 * (the arms open reach 2.05: entrance.test.ts measures the gap with them open and closed).
 */
const WAYPOINTS: readonly (readonly [number, number, number, number])[] = [
  [0, -5.9, 0.9, -20.5],
  [1.7, -0.84, 0.75, -14.5],
  [3.5, -0.3, 0.35, -6.2],
  [4.7, 0.2, 0.1, -2.5],
  [TURN_END, 0, 0, 0],
];

/**
 * x, y and z keyed at the waypoints, their slopes from the neighbours (the speed runs on smoothly
 * through every waypoint): the first from the way to the next, and zero on arrival at the spot.
 */
function swimKeys() {
  const axis = (a: 1 | 2 | 3) =>
    hermiteKeys(
      WAYPOINTS.map((w, i) => {
        const last = i === WAYPOINTS.length - 1;
        const lo = Math.max(0, i - 1);
        const hi = Math.min(WAYPOINTS.length - 1, i + 1);
        const slope = last ? 0 : (WAYPOINTS[hi][a] - WAYPOINTS[lo][a]) / (WAYPOINTS[hi][0] - WAYPOINTS[lo][0]);
        return [w[0], w[a], slope] as const;
      }),
    );
  return { x: axis(1), y: axis(2), z: axis(3) };
}

const ENTRANCE: SequenceDefaults = {
  length: SETTLE_END,
  objects: {
    main: {
      props: { x: WAYPOINTS[0][1], y: WAYPOINTS[0][2], z: WAYPOINTS[0][3], stroke: 0, spin: 0, forward: 0, open: 0, settle: 0, reveal: 0, pitch: 0.3, yaw: 0, surge: 0.2, lockRing: 0, membraneFlash: 1, shimmer: 0 },
      keys: {
        ...swimKeys(),
        // Stroke clock: three whole strokes at an even rate, the last ending as the settle begins.
        stroke: [[STROKE_START, 0, LINEAR], [STROKE_END, STROKES, LINEAR]],
        // The slow turn into the front, in the spin window: the yaw's -200 to 0 (the shape's turn).
        spin: [[TURN_START, 0], [TURN_END, 1]],
        // The settle: the arms swing forward out of the trail, then open into the intro pose; the
        // face lands on the gentle smile and the intro's words come in; the shimmer runs crown to face.
        forward: [[TURN_END, 0], [TURN_END + 0.55, 1]],
        open: [[TURN_END + 0.15, 0], [SETTLE_END, 1]],
        settle: [[TURN_END, 0], [SETTLE_END, 1]],
        shimmer: [[TURN_END, 0], [SETTLE_END, 1]],
        // Out of the haze: the glow and aura first, then the shape.
        reveal: [[0, 0], [APPEAR_END, 1]],
        // Leaning a little head first while she glides in, upright by the end of the turn.
        pitch: [[TURN_START, 0.3], [TURN_END, 0]],
        // The vault recognising its keeper: the ring a quarter turn, the membrane's soft flash.
        lockRing: [[LOCK_START, 0], [LOCK_END, Math.PI / 2]],
        membraneFlash: [[LOCK_START, 1], [(LOCK_START + LOCK_END) / 2, FLASH_PEAK], [LOCK_END + 0.2, 1]],
      },
    },
  },
};

// --- The bubble blow --------------------------------------------------------------------------

/** Handles that leave a key fast and arrive slowly (an ease out). */
const EASE_OUT_RIGHT = [1 / 3, 1 / 3, 0.33, 1] as const;
const EASE_OUT_LEFT = [0.68, 1, 1 / 3, 1 / 3] as const;

/**
 * The engine's blow sheet, as Nox's: Veyra's pendants bloom from her cups instead (spec 7.5), which
 * a later task adds to the engine's appear table, and this sheet is then replaced. Nothing plays it
 * while her artifacts have no places.
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
        emerged: [[0.25, 0, LINEAR], [0.33, 0, [2 / 3, 2 / 3, 0.25, 0.1]], [0.9, 1, EASE_OUT_LEFT]],
        wobble: [[0.33, 0], [0.42, 0.16], [0.52, -0.12], [0.62, 0.08], [0.72, -0.05], [0.81, 0.025], [0.9, 0]],
      },
    },
  },
};

// --- The head swell ---------------------------------------------------------------------------

/**
 * How far the artifacts' places are pushed out at the swell's peak. The settled push is the
 * engine's (SWELL_PUSH_SETTLED).
 */
export const SWELL_PUSH_PEAK = 0.14;

/**
 * The head opening into the dome: the engine's swell as Nox's, until the vault dial (spec 7.6)
 * gives Veyra her own: a small squeeze, the swell running past full to 1.07 and settling at 1.
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

// --- The arrival wiggle -----------------------------------------------------------------------

/**
 * The happy wiggle once the entrance has settled (spec 7.8: smaller and slower than Nox's; the
 * personality's `micro.arrival` sets the size and the 2 s the pace): the body rocks side to side
 * and the arms fan open and shut a beat behind it. Each key is a turning point.
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

/** Code defaults for each sheet's props and keyframes; the seed script writes them into the state JSON the first time. */
export const SEQUENCE_DEFAULTS: Record<SequenceId, SequenceDefaults> = {
  entrance: ENTRANCE,
  bubbleBlow: BUBBLE_BLOW,
  headSwell: HEAD_SWELL,
  arrival: ARRIVAL,
};
