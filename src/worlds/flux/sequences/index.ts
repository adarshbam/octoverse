import { FLUX_ENTRANCE, SEQUENCE_DEFAULTS } from './defaults';
import type { SequenceSet } from '../../../engine/sequences/keys';

// Flux's sequences as data for the engine's loader: his Theatre project, the keys each sheet starts
// from (defaults.ts) and the entrance's full turn. The saved state is the repo's own, imported when
// it is first wanted, so the page does not carry it before a sequence is needed. It is empty until
// the entrance task seeds and tunes the sheets.

/** The Theatre project's id: part of the saved state, and not Nox's (two worlds never share a project). */
export const FLUX_PROJECT_ID = 'OctoVerse-Flux';

export const FLUX_SEQUENCES: SequenceSet = {
  projectId: FLUX_PROJECT_ID,
  state: () => import('./state.theatre.json').then(module => module.default),
  defaults: SEQUENCE_DEFAULTS,
  entrance: FLUX_ENTRANCE,
};
