import { type EntranceShape, type SequenceDefaults, type SequenceId, LINEAR, SWELL_PUSH_SETTLED } from '../../../engine/sequences/keys.ts';

// Veyra's sequence defaults: the keys each of her Theatre sheets starts from. World data: the
// engine's sequence loader (theatre.ts) takes them through `WorldBundle.sequences`, never by import.
// `scripts/theatre-seed.mjs --world=veyra` runs this file directly under Node: erasable TypeScript
// only, and its one value import (keys.ts) names its extension for the same reason.

// --- The entrance (spec 7.9) -----------------------------------------------------------------

/**
 * The entrance's shape. A placeholder: the swim, the glide along the path and the slow 200-degree
 * turn are authored in the entrance task. `spiral` is the engine's only path today; no spin is
 * keyed here, so the turn and the arc add nothing.
 */
export const VEYRA_ENTRANCE: EntranceShape = { turn: (200 * Math.PI) / 180, spiral: true, arc: { r0: 0.9, phase: Math.PI } };

/**
 * A placeholder entrance: nothing is keyed, so every prop holds its resting value, which is the
 * landed state: she is simply present at the stage spot in the intro pose (as with reduced motion),
 * the arms open and the face on the gentle smile. One second, so the stage hands over to the intro.
 */
const ENTRANCE: SequenceDefaults = {
  length: 1,
  objects: {
    main: {
      props: { x: 0, y: 0, z: 0, stroke: 0, spin: 0, forward: 1, open: 1, settle: 1, reveal: 1, pitch: 0, yaw: 0, surge: 0 },
      keys: {},
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
