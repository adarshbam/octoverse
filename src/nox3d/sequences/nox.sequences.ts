import { NOX } from '../config/nox.character';
import { ARM_HALF_SPAN, type EntranceGeometry, PILLAR_HALF } from './entrance';
import { NOX_ENTRANCE, SEQUENCE_DEFAULTS, type SequenceSet } from './keys';
import { type Sequences, loadSequences } from './theatre';

// Nox's sequences as data for the loader: his Theatre project, the keys each sheet starts from
// (keys.ts) and the entrance's full turn. The saved state is the repo's own (`state/`), imported
// when it is first wanted, so the page does not carry it before a sequence is needed.

/** The Theatre project's id: part of the saved state, so it does not change with the world's name. */
export const NOX_PROJECT_ID = 'OctoVerse';

/** Nox's sequence set, with the saved state it was given. */
export const noxSequenceSet = (state: unknown): SequenceSet => ({ projectId: NOX_PROJECT_ID, state, defaults: SEQUENCE_DEFAULTS, entrance: NOX_ENTRANCE });

let noxLoad: Promise<Sequences> | null = null;

/** Loads Nox's project once (the loader keeps the promise per project id; this keeps the state's import too). A failed load is forgotten. */
export function loadNoxSequences(): Promise<Sequences> {
  noxLoad ??= import('./state/octoverse.theatre.json')
    .then(module => loadSequences(noxSequenceSet(module.default)))
    .catch((error: unknown) => {
      noxLoad = null;
      throw error;
    });
  return noxLoad;
}

/** What the entrance's clearance check measures Nox with: his stroke, his arms' reach and the kit's pillar footprint. */
export const NOX_ENTRANCE_GEOMETRY: EntranceGeometry = { swim: NOX.personality.swim, armHalfSpan: ARM_HALF_SPAN, pillarHalf: PILLAR_HALF };
