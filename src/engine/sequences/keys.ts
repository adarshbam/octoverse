import type { APPEARS } from '../artifacts/strategies';

/**
 * The sheets the appear kinds play (amendment A1, G5): the `sheet` of each entry in the engine's
 * appear table (`APPEARS.blow.sheet` is 'bubbleBlow'). Type-only import: this file also runs
 * directly under Node (the seed script), where it is erased.
 */
export type AppearSheet = (typeof APPEARS)[keyof typeof APPEARS]['sheet'];

/** Sequence ids: one Theatre sheet each (the big sequences of the design's section 9.11). */
export type SequenceId = 'entrance' | 'headSwell' | 'arrival' | AppearSheet;

/**
 * A keyframe's Bezier handles, as Theatre stores them: [left x, left y, right x, right y], each
 * a fraction of the segment on that side. The curve from key A to key B runs through A's right
 * handle and B's left one.
 */
export type Handles = readonly [number, number, number, number];

/** [seconds, value], with Theatre's default ease-in-out handles, or [seconds, value, handles]. */
export type Key = readonly [number, number] | readonly [number, number, Handles];

export interface SequenceObjectDefaults {
  /** Every animated prop and its value when it has no keyframes. */
  props: Record<string, number>;
  /** Keyframes per prop, in time order. */
  keys: Record<string, readonly Key[]>;
}

export interface SequenceDefaults {
  /** Seconds. */
  length: number;
  objects: Record<string, SequenceObjectDefaults>;
}

/**
 * Where the spiral arc starts: `r0` stage units from the stage spot, at `phase` radians about +y
 * from +z. The world's own, since the swim's path (its sheet's keys) ends where the arc begins.
 */
export interface EntranceArc {
  readonly r0: number;
  readonly phase: number;
}

/**
 * How the entrance's final turn runs (amendment A1, G2; the non-spiral path built for Veyra, Task
 * 17): `turn` radians about the vertical axis (above 0, at most 2 pi), run by the sheet's `spin`
 * (0 to 1). `spiral` picks the path (sequences/entrance.ts):
 * - `true` (Nox): the swim ends on a golden-spiral arc (`arc`) that curls once round into the stage
 *   spot, the body facing along it. The yaw is the turn times the spin wrapped to the near side
 *   (-0.5 to 0.5), so it is 0 at the end and jumps by `turn` half way round: a turn short of 2 pi
 *   leaves that jump in view, so use it for the full turn.
 * - `false` (Veyra): no arc; the sheet's keyed path carries the body to the spot, and the body turns
 *   in place on it, a glide-turn into the front: the yaw runs from -turn to exactly 0 as `spin`
 *   goes 0 to 1, monotonic, so the body faces -turn before the turn (the sheet's `yaw` key aside).
 */
export type EntranceShape = { turn: number; spiral: true; arc: EntranceArc } | { turn: number; spiral: false };

/**
 * What a world gives the sequence loader (sequences/theatre.ts): its Theatre project's id and
 * saved state, the keys each sheet it uses starts from, and the entrance's shape. A world with
 * no entrance sheet of its own still gives the shape, since the sheets are the engine's.
 */
export interface SequenceSet {
  projectId: string;
  /**
   * The saved Theatre state (the studio's export), fetched when a sequence is first wanted, so the
   * page does not carry it before then; resolving to `undefined` starts the project empty.
   */
  state: () => Promise<unknown>;
  defaults: Partial<Record<SequenceId, SequenceDefaults>>;
  entrance: EntranceShape;
  /**
   * The kit props the entrance drives (Task 18; `WorldConfig.props`): each key is a prop's id, each
   * value the name of the prop of the entrance sheet's `main` object that gives its value (so the
   * sheet's `lockRing` can turn the world's padlock ring). Absent: the entrance drives none (Nox).
   * `validateBundle` checks that both sides exist.
   */
  kitDrives?: Readonly<Record<string, string>>;
}

/** Straight-line handles: the value runs at an even rate between two keys. */
export const LINEAR: Handles = [2 / 3, 2 / 3, 1 / 3, 1 / 3];

/**
 * Keys through `points` ([seconds, value, slope in value per second]) whose curves are the cubic
 * Hermite spline with those slopes: each key's handles sit a third of the way along its segments,
 * on its slope, so the speed runs on smoothly through every key.
 */
export function hermiteKeys(points: readonly (readonly [number, number, number])[]): Key[] {
  return points.map(([t, v, m], i) => {
    const prev = points[i - 1];
    const next = points[i + 1];
    const ly = prev && v !== prev[1] ? 1 - (m * (t - prev[0])) / (3 * (v - prev[1])) : 2 / 3;
    const ry = next && next[1] !== v ? (m * (next[0] - t)) / (3 * (next[1] - v)) : 1 / 3;
    return [t, v, [2 / 3, ly, 1 / 3, ry]];
  });
}

/**
 * How far the bubbles' orbits are pushed out (orbitPoint's `swell`) once the head has swollen: what
 * the swell's last key rests on, and the engine's resting and no-sheet value (sequences/headSwell.ts).
 * The overview's rings are framed close to the stage's edge: this keeps every bubble inside the
 * frame and clear of the face and the dome's panel (headSwell.test.ts). A world's sheet ends on it.
 */
export const SWELL_PUSH_SETTLED = 0.1;
