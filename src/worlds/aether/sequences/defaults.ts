import { type EntranceShape, type SequenceDefaults, type SequenceId, LINEAR, SWELL_PUSH_SETTLED, hermiteKeys } from '../../../engine/sequences/keys.ts';

// Aether's sequence defaults: the keys each of her Theatre sheets starts from (the entrance, the
// bubble blow, the head swell and the arrival wiggle), and the entrance's shape. They start as
// Nox's keys, re-timed to her stroke (the sheets are the engine's); the entrance is re-authored in
// Task 17, the bubble blow in Task 12 and the head swell in Task 20. World data: the engine's
// sequence loader (theatre.ts) takes them through `WorldBundle.sequences`, never by import. The
// entrance is her own since Task 17 (spec 7.9).
// `scripts/theatre-seed.mjs` runs this file directly under Node: erasable TypeScript only, and its
// one value import (keys.ts) names its extension for the same reason.

// --- The entrance (spec 7.9; Task 17) ---------------------------------------------------------

/**
 * Aether's stroke, in seconds: recovery + power + glide of `personality.swim` in her character
 * config (0.6 + 0.24 + 0.85). This file may not import it; bundle.test checks that the two agree.
 */
export const AETHER_STROKE_SECONDS = 1.69;

/**
 * The entrance's shape (spec 7.9): no spiral (the engine's glide-turn, sequences/entrance.ts
 * glideTurnYaw), a quarter turn. The keyed path is the whole way to the stage spot and the sheet's
 * `spin` turns her in place on it, from three-quarter side to front.
 *
 * The engine's glide-turn runs one way only: its yaw rises from -turn to 0, so on its own she would
 * face left (-x) before the turn. She swims right, toward the portal, so the sheet's own `yaw` key
 * carries her facing: it holds her facing plus the glide-turn's quarter before the turn and falls
 * to 0 on the spin's own ease (YAW_KEYS), so the sum falls monotonically from +90 degrees (facing
 * right, head leading) to exactly 0 (facing the visitor). MORNING-REVIEW-aether.md asks the engine
 * for a signed glide-turn, which would make this key plain.
 */
export const AETHER_ENTRANCE: EntranceShape = { turn: Math.PI / 2, spiral: false };

/** The beats (spec 7.9), in seconds. */
export const ENTRANCE_BEATS = {
  /** 0 to 1 s: the pink-violet glimmer in the haze on the left becomes Aether, glow first. */
  appearEnd: 1,
  /** The stroke clock's first and last moments: two whole strokes at her own rate (1.69 s), the surges at 1.42 and 3.11 s. */
  strokeStart: 4.2 - 2 * AETHER_STROKE_SECONDS,
  strokeEnd: 4.2,
  /** ~3.2 s: in front of the portal's left side, the brain glyph fires (the membrane's flash, `glyphFire`). */
  glyphFire: 3.2,
  /** 3.0 to 3.8 s: her head turns back to the portal as she goes by (`headYaw`). */
  lookBackStart: 3.0,
  lookBackEnd: 3.8,
  /** 4.2 to 5.3 s: the curve away and the quarter turn (`spin`), the head tilting 12 degrees and straightening (`headTilt`). */
  turnStart: 4.2,
  turnEnd: 5.3,
  /** 5.3 to 6.3 s: the settle. The arms come forward and open; then she looks at you, blinks, and smiles (`look`, `blink`, `settle`). */
  settleEnd: 6.3,
  look: 5.45,
  blink: 5.75,
  smile: 6.3,
} as const;

const B = ENTRANCE_BEATS;

/** The curious tilt as she first sees the visitor: 12 degrees, at its most two thirds of the way round the turn. */
export const ENTRANCE_TILT = (12 * Math.PI) / 180;
/** The look-back's head turn toward the portal (radians, about +y): about 40 degrees, her eyes doing the rest. */
export const LOOK_BACK = 0.7;
/** The membrane's emissive at the glyph's firing: 1 at rest, 1 + its `flash` (0.25, place/config.ts) at the peak, the most its shader draws. */
export const GLYPH_FIRE_PEAK = 1.25;

/**
 * Her facing (the total yaw, radians; 0 faces the visitor) at the keyed moments before the turn:
 * +90 degrees as she comes out of the haze far on the left (the camera sees her near profile there,
 * a little of her face), easing to +50 degrees as her path bends toward the camera past the portal,
 * so the camera, which sees her from its left by then, keeps a three-quarter view of her face (P1).
 * The turn takes the rest, 50 degrees to 0; the whole entrance turns 90.
 */
const FACING = { start: Math.PI / 2, pass: (50 * Math.PI) / 180 } as const;

/**
 * The path: [seconds, x, y, z] waypoints, the last the stage spot. She appears deep on the left in
 * the haze (x -3.5, 9 back, between the near left tower and the floating stones), glides right
 * along the path toward the portal, passes in front of its left side at 3.2 s (x 6, 2.6 back: the
 * nearest floating stone, rubble_float_d, is 3.9 behind her), curves toward the camera, and drifts in
 * to the spot as she turns, arriving at 6.1 s, inside the settle. The intro's arm-span box keeps the
 * stage clear of every tower (layout.test), so the last stretch is open water.
 */
const WAYPOINTS: readonly (readonly [number, number, number, number])[] = [
  [0, -3.5, 1.4, -9.0],
  [1.6, 1.0, 1.05, -5.0],
  [B.glyphFire, 6.0, 0.75, -2.6],
  [B.turnStart, 6.3, 0.45, -1.9],
  [6.1, 0, 0, 0],
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

/**
 * The sheet's `yaw` key: her facing plus the glide-turn's quarter (the engine subtracts it before
 * the turn), easing from the start to the pass and holding; through the turn it falls to 0 on the
 * same default ease as `spin`, so the sum falls monotonically with no jump.
 */
const YAW_KEYS: readonly (readonly [number, number])[] = [
  [0, FACING.start + Math.PI / 2],
  [B.glyphFire, FACING.pass + Math.PI / 2],
  [B.turnStart, FACING.pass + Math.PI / 2],
  [B.turnEnd, 0],
];

const ENTRANCE: SequenceDefaults = {
  length: B.settleEnd,
  objects: {
    main: {
      props: {
        x: WAYPOINTS[0][1], y: WAYPOINTS[0][2], z: WAYPOINTS[0][3], stroke: 0, spin: 0, forward: 0, open: 0, settle: 0, reveal: 0, pitch: 0.4, yaw: YAW_KEYS[0][1], surge: 0.35,
        // The world's own extras. glyphFire drives the portal membrane's emissive (sequences/index.ts kitDrives). headYaw,
        // headTilt, look and blink are her face's beats, authored here for the engine to read (MORNING-REVIEW-aether.md:
        // the entrance frame passes no head turn, tilt, gaze or blink yet).
        glyphFire: 1, headYaw: 0, headTilt: 0, look: 0, blink: 0,
      },
      keys: {
        ...swimKeys(),
        // Stroke clock: two whole strokes at her own rate, the last ending as the turn begins; she glides through the turn.
        stroke: [[B.strokeStart, 0, LINEAR], [B.strokeEnd, 2, LINEAR]],
        // The quarter turn into the front.
        spin: [[B.turnStart, 0], [B.turnEnd, 1]],
        yaw: YAW_KEYS,
        // Head first while she swims (P1: level, the arms behind), upright by the end of the turn.
        pitch: [[B.turnStart, 0.4], [B.turnEnd, 0]],
        // Out of the haze: the glow and aura first, then the shape.
        reveal: [[0, 0], [B.appearEnd, 1]],
        // The brain glyph fires as she passes: the membrane brightens once, peaking at 3.2 s, gone by 3.7.
        glyphFire: [[B.lookBackStart, 1], [B.glyphFire, GLYPH_FIRE_PEAK], [3.7, 1]],
        // The curious look-back: her head turns toward the portal (behind her right) and back as she goes by.
        headYaw: [[B.lookBackStart, 0], [3.3, LOOK_BACK], [3.55, LOOK_BACK], [B.lookBackEnd, 0]],
        // The tilt as she first sees the visitor, then straightening, inside the turn.
        headTilt: [[B.turnStart + 0.2, 0], [B.turnStart + 0.75, ENTRANCE_TILT], [B.turnEnd, 0]],
        // The settle: the arms swing forward out of the trail and open into the intro pose.
        forward: [[B.turnEnd, 0], [B.turnEnd + 0.4, 1]],
        open: [[B.turnEnd + 0.1, 0], [B.settleEnd - 0.1, 1]],
        // Then the P2 caption's beats in order: she looks at you (her gaze locks on the visitor),
        look: [[B.turnEnd, 0], [B.look, 1]],
        // blinks (one blink, closed at its middle),
        blink: [[B.blink - 0.1, 0], [B.blink, 1], [B.blink + 0.1, 0]],
        // and smiles: the face lands on the gentle smile and the intro's words come in.
        settle: [[B.blink + 0.1, 0], [B.smile, 1]],
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

// --- The ring forming (spec 7.5; Task 18) -----------------------------------------------------

/**
 * The twinkle's clock: the ring forms 1.4 s after the entrance has settled (the engine starts the appear
 * where the entrance sheet ends, 6.3 s, the same trigger as Nox's blow and Veyra's bloom). `clock` runs 0
 * to 1 over the sheet and the engine's twinkle reads the moment from it (artifacts/twinkle.ts): the gold
 * line draws round her head over the first 0.6 s (clock 0 to 0.43), then the five beads light one after
 * another to 1.4 s. Keyed straight, the clock is the run's own; bend its keys in the studio to re-time the whole.
 * The bubble blow above is no longer played by her appear (the twinkle is), and stays as the engine's default sheet.
 */
const TWINKLE: SequenceDefaults = {
  length: 1.4,
  objects: {
    main: {
      props: { clock: 0 },
      keys: { clock: [[0, 0, LINEAR], [1.4, 1, LINEAR]] },
    },
  },
};

// --- The head swell (design 9.9) -------------------------------------------------------------

/**
 * The head swelling into the dome like a thought, from the click: a small squeeze first (the
 * anticipation, 0 to 0.4 s), then the swell (`morph`, the head's change into the dome, 0 closed, 1
 * open) running past full to 1.07 at 0.85 s and settling at 1 by 1.3 s. The head's effect (`effect`,
 * 0 to 1) fades in as it settles. Closing plays this backwards (sequences/headSwell.ts).
 *
 * `push` is what the artifacts' placement reads as the swell (Nox's orbits are pushed out by it). Her
 * satellite reads it as the flight's progress (push over its settled value, SWELL_PUSH_SETTLED: 0 the
 * ring, 1 the arms; artifacts/satellite.ts), so it rises once, with no overshoot, over the whole
 * swell, 0.2 to 1.35 s: the beads brighten and split as the head starts to swell, the orbs fly out
 * as it opens and land as it settles (Task 12). Nox's peak and settle, kept before, gave her flight
 * only 0.3 to about 0.6 s.
 */
const HEAD_SWELL: SequenceDefaults = {
  length: 1.5,
  objects: {
    main: {
      props: { squeeze: 0, morph: 0, push: 0, effect: 0 },
      keys: {
        squeeze: [[0, 0], [0.2, 1], [0.4, 0]],
        morph: [[0.18, 0], [0.85, 1.07], [1.3, 1]],
        push: [[0.2, 0], [1.35, SWELL_PUSH_SETTLED]],
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
export const SEQUENCE_DEFAULTS: Record<Exclude<SequenceId, 'bloom'>, SequenceDefaults> = {
  entrance: ENTRANCE,
  bubbleBlow: BUBBLE_BLOW,
  headSwell: HEAD_SWELL,
  arrival: ARRIVAL,
  twinkle: TWINKLE,
};
