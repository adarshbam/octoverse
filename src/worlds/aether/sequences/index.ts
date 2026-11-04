import { AETHER_ENTRANCE, SEQUENCE_DEFAULTS } from './defaults';
import type { SequenceSet } from '../../../engine/sequences/keys';

// Aether's sequences as data for the engine's loader: her Theatre project, the keys each sheet
// starts from (defaults.ts) and the entrance's full turn. The saved state is the repo's own
// (`state.theatre.json`, written by scripts/theatre-seed.mjs from the defaults, then replaced by
// studio exports), imported when it is first wanted, so the page does not carry it before a
// sequence is needed.

/** The Theatre project's id: part of the saved state; its own, so two worlds never share a sheet store. */
export const AETHER_PROJECT_ID = 'OctoVerse-Aether';

/** Aether's sequence set (`AETHER_BUNDLE.sequences`): the saved state is fetched on the first load. */
export const AETHER_SEQUENCES: SequenceSet = {
  projectId: AETHER_PROJECT_ID,
  state: () => import('./state.theatre.json').then(module => module.default),
  defaults: SEQUENCE_DEFAULTS,
  entrance: AETHER_ENTRANCE,
};
