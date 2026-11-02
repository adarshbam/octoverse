/** Sequence ids: one Theatre sheet each (the big sequences of the design's section 9.11). */
export type SequenceId = 'entrance' | 'bubbleBlow' | 'headSwell' | 'arrival';

export interface SequenceObjectDefaults {
  /** Every animated prop and its value when it has no keyframes. */
  props: Record<string, number>;
  /** Keyframes per prop, as [seconds, value] pairs in time order. */
  keys: Record<string, [number, number][]>;
}

export interface SequenceDefaults {
  /** Seconds. */
  length: number;
  objects: Record<string, SequenceObjectDefaults>;
}

/**
 * Code defaults for each sheet's props and keyframes. `scripts/theatre-seed.mjs` writes them into
 * the state JSON the first time; exports from the studio replace that file afterwards.
 * Erasable TypeScript only, no imports: the seed script runs this file directly under Node.
 * The `entrance` entry is a placeholder until the entrance task fills it.
 */
const placeholder = (): SequenceDefaults => ({
  length: 1,
  objects: { main: { props: { value: 0 }, keys: { value: [[0, 0], [1, 1]] } } },
});

export const SEQUENCE_DEFAULTS: Record<SequenceId, SequenceDefaults> = {
  entrance: placeholder(),
  bubbleBlow: placeholder(),
  headSwell: placeholder(),
  arrival: placeholder(),
};
