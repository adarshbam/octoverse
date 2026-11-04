import { SEQUENCE_DEFAULTS, VEYRA_ENTRANCE } from './defaults';
import type { SequenceSet } from '../../../engine/sequences/keys';

// Veyra's sequences as data for the loader: her Theatre project, the keys each sheet starts from
// (defaults.ts) and the entrance's shape. The saved state is the repo's own, imported when it is
// first wanted, so the page does not carry it before a sequence is needed.

/** The Theatre project's id: part of the saved state, and not Nox's `OctoVerse`: two worlds sharing a project would share one sheet store. */
export const VEYRA_PROJECT_ID = 'OctoVerse-Veyra';

export const VEYRA_SEQUENCES: SequenceSet = {
  projectId: VEYRA_PROJECT_ID,
  state: () => import('./state.theatre.json').then(module => module.default),
  defaults: SEQUENCE_DEFAULTS,
  entrance: VEYRA_ENTRANCE,
};
