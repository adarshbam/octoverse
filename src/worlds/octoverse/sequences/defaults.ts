import { type EntranceShape, type SequenceDefaults, type SequenceId, LINEAR, hermiteKeys } from '../../../engine/sequences/keys.ts';

// The host's sequence defaults: the props and keys each Theatre sheet the engine plays starts from,
// seeded into the saved state (state.theatre.json) by scripts/theatre-seed.mjs. Task 11 authored the
// arrival wave (spec 7.5), Task 12 the entrance with the gate greeting (spec 7.6). The host never
// swells its head and has no artifacts to blow, so those two sheets stay at rest for good.
// `node scripts/theatre-seed.mjs --world=octoverse <sheet>` runs this file directly under Node:
// erasable TypeScript only, and its one value import (keys.ts) names its extension for that reason.

// --- The entrance (spec 7.6; Task 12) ----------------------------------------------------------

/**
 * The entrance's shape: a 200 degree glide-turn into the front, no spiral (amendment A1 G2; the
 * engine's sequences/entrance.ts glideTurnYaw). The keyed path is the whole way to the stage spot,
 * and the sheet's `spin` turns the host on it: the yaw runs from -200 degrees to exactly 0 (facing
 * the visitor), always the same way, as `spin` goes 0 to 1.
 */
export const HOST_ENTRANCE: EntranceShape = { turn: (200 * Math.PI) / 180, spiral: false };

/** The beats (spec 7.6), in seconds. */
export const ENTRANCE_BEATS = {
  /** 0 to 1 s: the glow appears out of the haze on the left, then the shape. */
  appearEnd: 1,
  /**
   * The stroke clock: two whole strokes, one every 1.4 s (its own stroke is 0.58 + 0.24 + 0.8 = 1.62 s;
   * two of those from 1 s would run past the turn), the power strokes (the surges) at 1.1 and 2.5 s,
   * the second's glide carrying it to the turn.
   */
  strokeStart: 0.6,
  strokeEnd: 3.4,
  /** About 3 s: the portal's glyph brightens as the host goes by, the membrane ripples just after it. */
  glyph: 3.0,
  membrane: 3.15,
  /** 3.0 to 3.4 s: from profile, it turns its head toward the portal (the yaw eases to the glide-turn's -200). */
  lookToGate: 3.0,
  /** 3.4 to 4.4 s: the 200 degree turn to face the visitor, gliding to the stage spot (reached as it ends). */
  turnStart: 3.4,
  turnEnd: 4.4,
  /** 4.4 to 5.4 s: the settle; the arrival wave (the arrival sheet) follows it. */
  settleEnd: 5.4,
} as const;

const B = ENTRANCE_BEATS;

/**
 * The glyph's emissive intensity at its brightest (1 at rest, the kit's own lavender, below the
 * host's face glow): three and a half times as bright for a moment (2.2 read as barely brighter on the still), the gate greeting its keeper.
 */
export const GLYPH_PEAK = 3.5;
/** The membrane's at its ripple's crest: 1 + its `flash` (0.3, place/config.ts), the most its shader draws. */
export const MEMBRANE_PEAK = 1.3;

/**
 * The keyed yaw (radians) it swims with, on top of the glide-turn's -200 degrees: -80, so the total is
 * -280 (a profile facing right, a little toward the camera, as P1 has it), held to 3.0 s and eased to
 * 0 by the turn's start (the total -200: facing right and away, toward the portal) as the gate greets
 * it. The yaw never decreases.
 */
const YAW_SIDE = (-80 * Math.PI) / 180;

/**
 * The path: [seconds, x, y, z] waypoints of the body, the last the stage spot. It appears deep on the
 * left (x -8.4, 6 back, in the haze), drifts while the first stroke gathers, and the first power
 * stroke carries it right through the gap between the left rocks; the second's glide brings it past
 * the portal at about 3 s (keyed at x -0.655, 3 back; the surge carries it a little ahead: its head
 * lands where P1 paints it, x -0.36, y -0.36 in P1's frame, measured -0.35, -0.36 on the still
 * task12-entrance-3.png), then it glides in to the spot as it turns. The recoveries, where its arms open widest
 * (the umbrella reaches 3 either side), fall where the water is widest (entrance.test measures it).
 */
const WAYPOINTS: readonly (readonly [number, number, number, number])[] = [
  [0, -8.4, 0.8, -6.0],
  [1.1, -7.0, 0.65, -5.5],
  [1.6, -5.6, 0.5, -4.65],
  [2.0, -4.2, 0.38, -4.0],
  [2.5, -1.6, 0.15, -3.2],
  [B.glyph, -0.655, 0.0, -3.0],
  [B.turnStart, 0.25, -0.05, -2.75],
  [B.turnEnd, 0, 0, 0],
];

/** x, y and z keyed at the waypoints, their slopes from the neighbours (the speed runs on smoothly through each), zero on arrival at the spot. */
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
  length: B.settleEnd,
  objects: {
    main: {
      props: {
        x: WAYPOINTS[0][1], y: WAYPOINTS[0][2], z: WAYPOINTS[0][3], stroke: 0, spin: 0, forward: 0, open: 0, settle: 0, reveal: 0, pitch: 0.3, yaw: YAW_SIDE, surge: 0.3,
        // The world's own extras: the kit props the entrance drives (bundle.ts kitDrives), 1 at rest.
        glyph: 1, membraneRipple: 1,
      },
      keys: {
        ...swimKeys(),
        // Two whole strokes at an even rate, the second's glide ending as the turn begins.
        stroke: [[B.strokeStart, 0, LINEAR], [B.strokeEnd, 2, LINEAR]],
        // The 200 degree glide-turn into the front.
        spin: [[B.turnStart, 0], [B.turnEnd, 1]],
        // Profile facing right while it swims, turning its head to the portal as the gate greets it.
        yaw: [[0, YAW_SIDE], [B.lookToGate, YAW_SIDE], [B.turnStart, 0]],
        // Leaning a little head first while it swims, upright by the end of the turn.
        pitch: [[B.turnStart, 0.3], [B.turnEnd, 0]],
        // Out of the haze: the glow and aura first, then the shape.
        reveal: [[0, 0], [B.appearEnd, 1]],
        // The gate greets its keeper: the glyph brightens once, then the membrane ripples once (its emissive pulse).
        glyph: [[B.glyph - 0.3, 1], [B.glyph, GLYPH_PEAK], [B.glyph + 0.5, 1]],
        membraneRipple: [[B.membrane - 0.3, 1], [B.membrane, MEMBRANE_PEAK], [B.membrane + 0.6, 1]],
        // The settle: the arms swing forward out of the trail, then open into the intro pose; the face
        // lands on the welcome and the intro's words come in. Then the arrival wave.
        forward: [[B.turnEnd, 0], [B.turnEnd + 0.4, 1]],
        open: [[B.turnEnd + 0.1, 0], [B.settleEnd - 0.1, 1]],
        settle: [[B.turnEnd, 0], [B.settleEnd, 1]],
      },
    },
  },
};

/** Never played (no artifacts); at rest. */
const BUBBLE_BLOW: SequenceDefaults = {
  length: 0.9,
  objects: { main: { props: { puff: 0, mouthRound: 0, emerged: 0, scale: 0, wobble: 0 }, keys: {} } },
};

/** Never played (no stage opens the head); at rest. */
const HEAD_SWELL: SequenceDefaults = {
  length: 1.5,
  objects: { main: { props: { squeeze: 0, morph: 0, push: 0, effect: 0 }, keys: {} } },
};

/**
 * The arrival wave (spec 7.5, Task 11): as the host settles into the intro, T1 lifts and gives two
 * small waves (`t1Wave`, 0 at rest, 1 at each wave's peak: 0.38 s and 0.84 s), while the face shows
 * `delighted` for 0.6 s (`delighted`, 1 from 0.08 to 0.6 s; on at least half from about 0.04 to
 * 0.65 s) and then returns to `welcome`. Each key is a turning point (Theatre's ease in and out).
 * `roll` and `armWave` are the engine's arrival wiggle (motion/micro.ts, scaled by the personality's
 * `micro.arrival`): a small lean into each wave and the arms fanning a little on the same two beats.
 * `t1Wave` and `delighted` are the host's own (moments.ts): the engine has no channel for them yet.
 */
const ARRIVAL: SequenceDefaults = {
  length: 1.4,
  objects: {
    main: {
      props: { roll: 0, armWave: 0, t1Wave: 0, delighted: 0 },
      keys: {
        t1Wave: [[0, 0], [0.38, 1], [0.6, 0.2], [0.84, 1], [1.15, 0]],
        delighted: [[0, 0], [0.08, 1], [0.6, 1], [0.7, 0]],
        roll: [[0, 0], [0.38, 0.5], [0.84, -0.4], [1.2, 0]],
        armWave: [[0, 0], [0.38, 0.5], [0.6, 0.1], [0.84, 0.5], [1.15, 0]],
      },
    },
  },
};

/**
 * The host has no bloom sheet and no twinkle sheet (the engine's optional appear sheets: Veyra's
 * pendants, Aether's ring), as Nox and Veyra's tables leave out the ones they do not play.
 */
export const HOST_SEQUENCE_DEFAULTS: Record<Exclude<SequenceId, 'bloom' | 'twinkle'>, SequenceDefaults> = {
  entrance: ENTRANCE,
  bubbleBlow: BUBBLE_BLOW,
  headSwell: HEAD_SWELL,
  arrival: ARRIVAL,
};

/** The name scripts/theatre-seed.mjs reads (`node scripts/theatre-seed.mjs --world=octoverse entrance`). */
export const SEQUENCE_DEFAULTS = HOST_SEQUENCE_DEFAULTS;
