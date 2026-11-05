import { AETHER_ENTRANCE, SEQUENCE_DEFAULTS } from './defaults';
import type { SequenceSet } from '../../../engine/sequences/keys';

// Aether's sequences as data for the engine's loader: her Theatre project, the keys each sheet
// starts from (defaults.ts), the entrance's quarter turn and the kit it drives. The saved state is the repo's own
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
  // The brain glyph firing as she passes the portal (spec 7.9, ~3.2 s): the entrance sheet's `glyphFire` brightens the
  // portal's membrane (place/config.ts WORLD_PROPS, its 'emissive' drive). The glyph's own travelling light waits on the
  // engine (its glow material sets its own level: MORNING-REVIEW-aether.md).
  kitDrives: { portalFlash: 'glyphFire' },
};
