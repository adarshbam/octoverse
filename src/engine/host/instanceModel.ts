import { focusReaction } from '../behavior/focusChoreography';
import type { EntranceSheet } from '../character/Octopus';
import type { Project, Technology } from '../content/projectTypes';
import type { BlowSheet } from '../sequences/bubbleBlow';
import type { SwellSheet } from '../sequences/headSwell';
import type { SequenceSet, Sequences } from '../sequences/theatre';
import { ORBIT_CAPACITY } from '../artifacts/strategies';

/**
 * How many bubbles orbit the octopus by default; the rest of the project's technologies go to the
 * tray. It is the orbit placement's capacity (a platform default: 15 is what fits round the title
 * and nameplate at the stage's size). A world's own placement sets its capacity: the pendant
 * placement's is its slots (`placementCapacity`, artifacts/strategies.ts).
 */
export const BUBBLE_COUNT = ORBIT_CAPACITY;

/**
 * A project's technologies as one instance shows them: in the project's order, each in a bubble
 * (the first `capacity`, the world's placement's: BUBBLE_COUNT by default) or in the tray. Worked out
 * once per instance from its project, never at module load.
 */
export function createProjectModel(project: Project, technologies: readonly Technology[], capacity = BUBBLE_COUNT) {
  const order = project.primaryTechnologyIds ?? [];
  const tech = new Map(technologies.map(t => [t.id, t]));
  const usage = new Map((project.technologyUsages ?? []).map(u => [u.technologyId, u]));
  const orbs = order.slice(0, capacity).map(techId => ({
    techId,
    iconKey: tech.get(techId)?.iconKey ?? techId,
    name: tech.get(techId)?.name ?? techId,
    reaction: focusReaction(usage.get(techId)),
  }));
  const overflow = order.slice(capacity);
  const trayItem = (techId: string) => ({ techId, name: tech.get(techId)?.name ?? techId, iconKey: tech.get(techId)?.iconKey ?? techId });
  return { order, tech, usage, orbs, overflow, trayItem };
}
export type ProjectModel = ReturnType<typeof createProjectModel>;

/** The Theatre sheets one instance reads: each holder is filled when its sequences arrive (or fail), and read each frame. */
export interface InstanceSheets {
  entrance: EntranceSheet;
  blow: BlowSheet;
  swell: SwellSheet;
}

/**
 * Empty holders for one instance of a world with sequence set `set` (the swell's length is its
 * sheet's, known before the sheet loads); `blowAt` and `swellAt` are the moments a review still
 * shows (`?freeze&blow=<s>`, `&swell=<s>`).
 */
export function createSheets(set: Pick<SequenceSet, 'defaults'>, { blowAt, swellAt }: { blowAt?: number; swellAt?: number } = {}): InstanceSheets {
  const swell = set.defaults.headSwell;
  if (!swell) throw new Error('the sequence set has no headSwell sheet');
  return {
    entrance: { sequences: null, failed: false },
    blow: { sequences: null, failed: false, at: blowAt },
    swell: { sequences: null, failed: false, seconds: swell.length, at: swellAt },
  };
}

/** Which of the sheets an instance will play (the entrance only on a page that opens on it; the others unless motion is off). */
export interface SheetWants {
  entrance: boolean;
  blow: boolean;
  swell: boolean;
}

/**
 * Starts loading the sheets the instance wants, beside the world and the first frame: nothing waits
 * on them. `load` loads the world's sequences (`loadWorldSequences(bundle.sequences)`): every call
 * gets the one Theatre project (the loader keeps its promise per project id), so a second
 * instance, or this one mounted twice by StrictMode, loads nothing again. `onEntrance` runs when the
 * entrance's sequences are in (the swim's arm shapes are worked out then, so the entrance's first
 * frame does not pay for them). The returned function stops any holder being filled after the
 * instance is gone.
 */
export function startSheetLoaders(sheets: InstanceSheets, wants: SheetWants, load: () => Promise<Sequences>, onEntrance: (sequences: Sequences) => void): () => void {
  let live = true;
  if (wants.entrance) {
    load().then(
      sequences => {
        if (!live) return;
        onEntrance(sequences);
        sheets.entrance.sequences = sequences;
      },
      (error: unknown) => {
        if (!live) return;
        console.warn('the entrance did not load; going straight to the intro:', error);
        sheets.entrance.failed = true;
      },
    );
  }
  for (const [wanted, sheet] of [[wants.blow, sheets.blow], [wants.swell, sheets.swell]] as const) {
    if (!wanted) continue;
    load().then(
      sequences => {
        if (live) sheet.sequences = sequences;
      },
      () => {
        if (live) sheet.failed = true;
      },
    );
  }
  return () => {
    live = false;
  };
}
