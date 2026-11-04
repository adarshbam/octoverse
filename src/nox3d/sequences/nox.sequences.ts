import { NOX_ENTRANCE, SEQUENCE_DEFAULTS } from './defaults';
import type { SequenceSet } from '../../engine/sequences/keys';
import { type Sequences, type SequenceSpec, loadWorldSequences } from '../../engine/sequences/theatre';

// Nox's sequences as data for the loader: his Theatre project, the keys each sheet starts from
// (defaults.ts) and the entrance's full turn. The saved state is the repo's own (`state/`), imported
// when it is first wanted, so the page does not carry it before a sequence is needed.

/** The Theatre project's id: part of the saved state, so it does not change with the world's name. */
export const NOX_PROJECT_ID = 'OctoVerse';

/** Nox's sequence set (`NOX_BUNDLE.sequences`): the saved state is fetched on the first load. */
export const NOX_SEQUENCES: SequenceSet = {
  projectId: NOX_PROJECT_ID,
  state: () => import('./state/octoverse.theatre.json').then(module => module.default),
  defaults: SEQUENCE_DEFAULTS,
  entrance: NOX_ENTRANCE,
};

/** Nox's sequence set with a saved state already in hand (for `loadSequences`). */
export const noxSequenceSet = (state: unknown): SequenceSpec => ({ ...NOX_SEQUENCES, state });

/** Loads Nox's project once (the loader keeps the promise per project id, from every caller). A failed load is forgotten. */
export function loadNoxSequences(): Promise<Sequences> {
  return loadWorldSequences(NOX_SEQUENCES);
}
