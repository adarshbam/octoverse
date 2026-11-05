import { FLUX_ENTRANCE, SEQUENCE_DEFAULTS } from './defaults';
import type { SequenceSet } from '../../../engine/sequences/keys';

// Flux's sequences as data for the engine's loader: his Theatre project, the keys each sheet starts
// from (defaults.ts), the entrance's turn of pi and the portal props it drives. The saved state is
// the repo's own (state.theatre.json, seeded from defaults.ts by scripts/theatre-seed.mjs
// --world=flux), imported when it is first wanted, so the page does not carry it before a sequence is needed.

/** The Theatre project's id: part of the saved state, and not Nox's (two worlds never share a project). */
export const FLUX_PROJECT_ID = 'OctoVerse-Flux';

export const FLUX_SEQUENCES: SequenceSet = {
  projectId: FLUX_PROJECT_ID,
  state: () => import('./state.theatre.json').then(module => module.default),
  defaults: SEQUENCE_DEFAULTS,
  entrance: FLUX_ENTRANCE,
  // The portal run (spec 7.9): the four ring arcs light one by one and the disc flashes, the place's
  // props (place/config.ts) driven by the entrance sheet's props of the same names.
  kitDrives: { portalArc1: 'portalArc1', portalArc2: 'portalArc2', portalArc3: 'portalArc3', portalArc4: 'portalArc4', portalDisc: 'portalDisc' },
};
