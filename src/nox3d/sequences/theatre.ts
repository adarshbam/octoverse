import type { ISheet } from '@theatre/core';
import { SEQUENCE_DEFAULTS, type SequenceId } from './keys';

export type { SequenceId } from './keys';
export { SEQUENCE_DEFAULTS } from './keys';

export const PROJECT_ID = 'OctoVerse';

export interface Sequences {
  sheet(id: SequenceId): ISheet;
  /** The object's props at `seconds` (clamped to the sequence: past the end holds the last value). */
  sample<T>(id: SequenceId, objectKey: string, seconds: number): T;
}

let loading: Promise<Sequences> | null = null;

/**
 * Loads the project from the repo state (`state/octoverse.theatre.json`); resolves when ready.
 * Works in Node and in the browser. Theatre and the state load on the first call only, so
 * nothing here costs startup until a sequence is first needed; every later call gets the same
 * promise (a failed load is forgotten, so the next call tries again). The app drives
 * `sheet.sequence.position` from its own clock and never uses Theatre's playback.
 */
export function loadSequences(): Promise<Sequences> {
  loading ??= load().catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

async function load(): Promise<Sequences> {
  const [{ getProject, types }, state] = await Promise.all([
    import('@theatre/core'),
    import('./state/octoverse.theatre.json').then((m) => m.default),
  ]);
  const project = getProject(PROJECT_ID, { state: state as never });
  await project.ready;

  const objects = new Map<string, ReturnType<ISheet['object']>>();
  const sheet = (id: SequenceId) => project.sheet(id);
  const objectOf = (id: SequenceId, key: string) => {
    const cacheKey = `${id}/${key}`;
    let obj = objects.get(cacheKey);
    if (!obj) {
      const def = SEQUENCE_DEFAULTS[id].objects[key];
      if (!def) throw new Error(`No object "${key}" in sequence "${id}"`);
      const props = Object.fromEntries(Object.entries(def.props).map(([k, v]) => [k, types.number(v)]));
      obj = sheet(id).object(key, props);
      objects.set(cacheKey, obj);
    }
    return obj;
  };
  return {
    sheet,
    sample<T>(id: SequenceId, objectKey: string, seconds: number): T {
      const obj = objectOf(id, objectKey);
      const length = SEQUENCE_DEFAULTS[id].length;
      sheet(id).sequence.position = Math.min(length, Math.max(0, seconds));
      return obj.value as T;
    },
  };
}
