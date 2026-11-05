import type { EntranceShape, SequenceDefaults, SequenceId } from '../../../engine/sequences/keys';

// The host's sequence defaults: the props each Theatre sheet the engine plays starts from. Task 2
// gave the host no motion of its own; Task 11 authored the arrival wave (spec 7.5), seeded into the
// saved state (state.theatre.json) by scripts/theatre-seed.mjs. Every other sheet holds these props'
// values, the landed, settled values; the entrance (spec 7.6) comes with Task 12. The host never
// swells its head and has no artifacts to blow, so those two sheets stay at rest for good.
// Erasable TypeScript only, and no value imports: a seed script may run this file under Node.

/**
 * The entrance's turn: about 200 degrees to face the visitor (spec 7.6). The landed engine has only
 * the spiral arc (`spiral: true`; the non-spiral path is F01's, A1 G2): a placeholder until the
 * host's entrance task. The arc starts `r0` left of the stage spot.
 */
export const HOST_ENTRANCE: EntranceShape = { turn: (200 * Math.PI) / 180, spiral: true, arc: { r0: 0.9, phase: -Math.PI / 2 } };

/**
 * Where the arc starts (sequences/entrance.ts `spiralOffset` at spin 0): the keyed path ends here,
 * so a path held at it, with the spin complete, puts the host on the stage spot.
 */
const ARC_START = [HOST_ENTRANCE.arc.r0 * Math.sin(HOST_ENTRANCE.arc.phase), 0, HOST_ENTRANCE.arc.r0 * Math.cos(HOST_ENTRANCE.arc.phase)] as const;

/**
 * The entrance, held landed: on the spot, the turn done, arms open, settled and revealed, upright.
 * Its length is spec 7.6's 5.4 s, so a first visit waits as long as the real entrance will take.
 */
const ENTRANCE: SequenceDefaults = {
  length: 5.4,
  objects: {
    main: {
      props: { x: ARC_START[0], y: ARC_START[1], z: ARC_START[2], stroke: 0, spin: 1, forward: 1, open: 1, settle: 1, reveal: 1, pitch: 0, yaw: 0, surge: 0 },
      keys: {},
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

/** The host has no bloom sheet (the engine's optional fifth sheet: Veyra's pendants), as Nox and Veyra's tables type it. */
export const HOST_SEQUENCE_DEFAULTS: Record<Exclude<SequenceId, 'bloom'>, SequenceDefaults> = {
  entrance: ENTRANCE,
  bubbleBlow: BUBBLE_BLOW,
  headSwell: HEAD_SWELL,
  arrival: ARRIVAL,
};

/** The name scripts/theatre-seed.mjs reads (`node scripts/theatre-seed.mjs --world=octoverse arrival`). */
export const SEQUENCE_DEFAULTS = HOST_SEQUENCE_DEFAULTS;
