import type { StageId } from '../config/types';

export type StageEvent =
  | { type: 'ENTRANCE_DONE' }
  | { type: 'SKIP' }
  | { type: 'OPEN_OVERVIEW' }
  | { type: 'FOCUS_TECH'; id: string }
  | { type: 'BLUR_TECH' }
  | { type: 'OPEN_DETAIL' }
  | { type: 'CLOSE' };

export interface StageState {
  stage: StageId;
  /** The focused technology in `techFocus`, otherwise null. */
  techId: string | null;
  /** The stage a technology focus came from, and where letting go returns to; 'overview' elsewhere. */
  returnTo: 'intro' | 'overview';
}

/** Idle time in the intro before Nox rests. */
export const REST_AFTER_MS = 40000;

const at = (stage: StageId): StageState => ({ stage, techId: null, returnTo: 'overview' });
const focus = (techId: string, returnTo: 'intro' | 'overview'): StageState => ({ stage: 'techFocus', techId, returnTo });

/** A requested stage wins; otherwise a first visit enters, unless reduced motion skips the entrance. */
export function initialStage({ entranceSeen, requested, reducedMotion }: { entranceSeen: boolean; requested?: StageId; reducedMotion: boolean }): StageState {
  if (requested) return at(requested);
  return at(entranceSeen || reducedMotion ? 'intro' : 'entering');
}

/** The stage transitions; any event a stage does not handle leaves the state as it is. */
export function stageReducer(state: StageState, event: StageEvent, knownTechIds: ReadonlySet<string>): StageState {
  switch (state.stage) {
    case 'entering':
      return event.type === 'ENTRANCE_DONE' || event.type === 'SKIP' ? at('intro') : state;
    case 'intro':
      if (event.type === 'FOCUS_TECH') return knownTechIds.has(event.id) ? focus(event.id, 'intro') : state;
      return event.type === 'OPEN_OVERVIEW' ? at('overview') : state;
    case 'overview':
      if (event.type === 'FOCUS_TECH') return knownTechIds.has(event.id) ? focus(event.id, 'overview') : state;
      if (event.type === 'OPEN_DETAIL') return at('detail');
      return event.type === 'CLOSE' ? at('intro') : state;
    case 'techFocus':
      if (event.type === 'FOCUS_TECH') return knownTechIds.has(event.id) && event.id !== state.techId ? focus(event.id, state.returnTo) : state;
      if (event.type === 'BLUR_TECH' || event.type === 'CLOSE') return at(state.returnTo);
      return event.type === 'OPEN_DETAIL' ? at('detail') : state;
    case 'detail':
      return event.type === 'CLOSE' ? at('overview') : state;
  }
}

/** Nox rests only in the intro, after REST_AFTER_MS without input, with no panel open. */
export function isRestful(stage: StageId, idleMs: number, panelOpen: boolean) {
  return stage === 'intro' && idleMs >= REST_AFTER_MS && !panelOpen;
}
