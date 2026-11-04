import type { ISheet } from '@theatre/core';
import type { EntranceShape, SequenceDefaults, SequenceId, SequenceSet } from './keys';

export type { SequenceId, SequenceSet } from './keys';

export interface Sequences {
  sheet(id: SequenceId): ISheet;
  /**
   * The object's props at `seconds` (clamped to the sequence: past the end holds the last value).
   * Synchronous: it sets the sheet's position, then reads the object, so the value is the one at
   * `seconds` and nothing else. The sheet is shared, so the next sample moves it: copy what you
   * keep before sampling again.
   */
  sample<T>(id: SequenceId, objectKey: string, seconds: number): T;
  /** The sequence's length in seconds, as this world's set gives it (not a Nox constant). */
  length(id: SequenceId): number;
  /** How the entrance's final turn runs (`SequenceSet.entrance`). */
  readonly entrance: EntranceShape;
}

/** What the loader needs of a world's sequence set, with its saved state already in hand. */
export type SequenceSpec = Omit<SequenceSet, 'state'> & { state: unknown };

/** One load per Theatre project id: `getProject` throws when an id is made twice. */
const loading = new Map<string, Promise<Sequences>>();

/**
 * Loads a world's sequences (`WorldBundle.sequences`): fetches its saved state on the first call
 * for its project id, then loads the project as `loadSequences` does. Every later call for that id,
 * from any instance of the world, gets the same promise (a failed load is forgotten).
 */
export function loadWorldSequences(set: SequenceSet): Promise<Sequences> {
  const known = loading.get(set.projectId);
  if (known) return known;
  const started = set
    .state()
    .then(state => load({ ...set, state }))
    .catch((error: unknown) => {
      loading.delete(set.projectId);
      throw error;
    });
  loading.set(set.projectId, started);
  return started;
}

/**
 * Loads a project from a world's saved state; resolves when ready. Works in Node and in the
 * browser. Theatre loads on the first call for a `projectId` only, so nothing here costs startup
 * until a sequence is first needed; every later call for that id gets the same promise (so a
 * second instance of the world, or one mounted twice by StrictMode, makes no second project; a
 * failed load is forgotten, so the next call tries again). A different `projectId` is a project of
 * its own. The app drives `sheet.sequence.position` from its own clock and never uses Theatre's
 * playback.
 */
export function loadSequences(spec: SequenceSpec): Promise<Sequences> {
  const known = loading.get(spec.projectId);
  if (known) return known;
  const started = load(spec).catch((error: unknown) => {
    loading.delete(spec.projectId);
    throw error;
  });
  loading.set(spec.projectId, started);
  return started;
}

async function load({ projectId, state, defaults, entrance }: SequenceSpec): Promise<Sequences> {
  const { getProject, types } = await import('@theatre/core');
  const project = getProject(projectId, { state: state as never });
  await project.ready;

  const defaultsOf = (id: SequenceId): SequenceDefaults => {
    const found = defaults[id];
    if (!found) throw new Error(`No sequence "${id}" in the sequences of project "${projectId}"`);
    return found;
  };
  const objects = new Map<string, ReturnType<ISheet['object']>>();
  const sheet = (id: SequenceId) => project.sheet(id);
  const objectOf = (id: SequenceId, key: string) => {
    const cacheKey = `${id}/${key}`;
    let obj = objects.get(cacheKey);
    if (!obj) {
      const def = defaultsOf(id).objects[key];
      if (!def) throw new Error(`No object "${key}" in sequence "${id}"`);
      const props = Object.fromEntries(Object.entries(def.props).map(([k, v]) => [k, types.number(v)]));
      obj = sheet(id).object(key, props);
      objects.set(cacheKey, obj);
    }
    return obj;
  };
  return {
    entrance,
    sheet,
    length: id => defaultsOf(id).length,
    sample<T>(id: SequenceId, objectKey: string, seconds: number): T {
      const obj = objectOf(id, objectKey);
      const length = defaultsOf(id).length;
      sheet(id).sequence.position = Math.min(length, Math.max(0, seconds));
      return obj.value as T;
    },
  };
}
