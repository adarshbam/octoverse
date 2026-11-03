import { focusReaction } from '../behavior/focusChoreography';
import type { EntranceSheet } from '../character/Octopus';
import type { Project, Technology } from '../content/projectTypes';
import type { BlowSheet } from '../sequences/bubbleBlow';
import type { SwellSheet } from '../sequences/headSwell';
import { type Sequences, loadSequences } from '../sequences/theatre';

/** How many bubbles orbit the octopus; the rest of the project's technologies go to the tray. */
export const BUBBLE_COUNT = 15;

/**
 * A project's technologies as one instance shows them: in the project's order, each in a bubble
 * (the first BUBBLE_COUNT) or in the tray. Worked out once per instance from its project, never at module load.
 */
export function createProjectModel(project: Project, technologies: readonly Technology[]) {
  const order = project.primaryTechnologyIds ?? [];
  const tech = new Map(technologies.map(t => [t.id, t]));
  const usage = new Map((project.technologyUsages ?? []).map(u => [u.technologyId, u]));
  const orbs = order.slice(0, BUBBLE_COUNT).map(techId => ({
    techId,
    iconKey: tech.get(techId)?.iconKey ?? techId,
    name: tech.get(techId)?.name ?? techId,
    reaction: focusReaction(usage.get(techId)),
  }));
  const overflow = order.slice(BUBBLE_COUNT);
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

/** Empty holders for one instance; `blowAt` and `swellAt` are the moments a review still shows (`?freeze&blow=<s>`, `&swell=<s>`). */
export function createSheets({ blowAt, swellAt }: { blowAt?: number; swellAt?: number } = {}): InstanceSheets {
  return {
    entrance: { sequences: null, failed: false },
    blow: { sequences: null, failed: false, at: blowAt },
    swell: { sequences: null, failed: false, at: swellAt },
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
 * on them. Every call gets the one Theatre project (the loader keeps its promise), so a second
 * instance, or this one mounted twice by StrictMode, loads nothing again. `onEntrance` runs when the
 * entrance's sequences are in (the swim's arm shapes are worked out then, so the entrance's first
 * frame does not pay for them). The returned function stops any holder being filled after the
 * instance is gone.
 */
export function startSheetLoaders(sheets: InstanceSheets, wants: SheetWants, onEntrance: (sequences: Sequences) => void): () => void {
  let live = true;
  if (wants.entrance) {
    loadSequences().then(
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
    loadSequences().then(
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
