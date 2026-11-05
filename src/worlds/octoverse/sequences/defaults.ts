import type { EntranceShape, SequenceDefaults, SequenceId } from '../../../engine/sequences/keys';

// The host's sequence defaults: the props each Theatre sheet the engine plays starts from. Task 2
// gives the host no motion of its own yet: its saved state (state.theatre.json) is empty, so every
// sheet holds these props' values, and they are the landed, settled values. The entrance (spec 7.6),
// the arrival wave (spec 7.5) and their keys come with the tasks that build them. The host never
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

/** At rest until the host's arrival wave is authored (spec 7.5: T1 waves twice, the face delighted). */
const ARRIVAL: SequenceDefaults = {
  length: 1.4,
  objects: { main: { props: { roll: 0, armWave: 0 }, keys: {} } },
};

/** The host has no bloom sheet (the engine's optional fifth sheet: Veyra's pendants), as Nox and Veyra's tables type it. */
export const HOST_SEQUENCE_DEFAULTS: Record<Exclude<SequenceId, 'bloom'>, SequenceDefaults> = {
  entrance: ENTRANCE,
  bubbleBlow: BUBBLE_BLOW,
  headSwell: HEAD_SWELL,
  arrival: ARRIVAL,
};
