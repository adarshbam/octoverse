import { CHOOSING_STAGES, type ChoosingStage, type StageId } from '../config/types';

export type StageEvent =
  | { type: 'ENTRANCE_DONE' }
  | { type: 'SKIP' }
  | { type: 'OPEN_OVERVIEW' }
  | { type: 'FOCUS_TECH'; id: string }
  | { type: 'BLUR_TECH' }
  | { type: 'OPEN_DETAIL' }
  | { type: 'CLOSE' }
  /** A host's request for a stage (`stageRequest`): the same moves the visitor's events make, taken in turn. */
  | { type: 'REQUEST'; stage: LinkStage };

/** The stages a host may open the instance on or ask for: never the entrance, and a technology focus only a visitor's choice makes. */
export type LinkStage = 'intro' | 'overview' | 'detail';

export interface StageState {
  stage: StageId;
  /** The focused technology in `techFocus`, otherwise null. */
  techId: string | null;
  /** The stage a technology focus came from, and where letting go returns to; 'overview' elsewhere. */
  returnTo: ChoosingStage;
}

/** Idle time in the intro before Nox rests. */
export const REST_AFTER_MS = 40000;

const at = (stage: StageId): StageState => ({ stage, techId: null, returnTo: 'overview' });
const focus = (techId: string, returnTo: ChoosingStage): StageState => ({ stage: 'techFocus', techId, returnTo });

/**
 * A requested stage wins; otherwise a first visit enters, unless reduced motion skips the entrance.
 * A stage asked for by a link (`linked`: the host's `initialStage`) is never `entering` or
 * `techFocus`: those are ignored and the normal start applies. (The review switch `?stage=` is not
 * a link and may ask for any stage.)
 */
export function initialStage({ entranceSeen, requested, reducedMotion, linked = false }: { entranceSeen: boolean; requested?: StageId; reducedMotion: boolean; linked?: boolean }): StageState {
  if (requested && !(linked && (requested === 'entering' || requested === 'techFocus'))) return at(requested);
  return at(entranceSeen || reducedMotion ? 'intro' : 'entering');
}

const RANK: Record<LinkStage, number> = { intro: 0, overview: 1, detail: 2 };

/**
 * The events that take `state` to the stage a host asked for: close or open one stage at a time,
 * as a visitor would (the detail is reached only by `OPEN_DETAIL` from the overview; an entrance
 * still playing is skipped first; a technology focus is let go of, or goes to the detail). Empty
 * when the state is there already.
 */
export function requestPath(state: StageState, target: LinkStage): StageEvent[] {
  const path: StageEvent[] = [];
  let here = state;
  for (let step = 0; step < 4 && here.stage !== target; step++) {
    let event: StageEvent;
    if (here.stage === 'entering') event = { type: 'SKIP' };
    else if (here.stage === 'techFocus') event = target === 'detail' ? { type: 'OPEN_DETAIL' } : { type: 'BLUR_TECH' };
    else if (RANK[here.stage] < RANK[target]) event = { type: here.stage === 'intro' ? 'OPEN_OVERVIEW' : 'OPEN_DETAIL' };
    else event = { type: 'CLOSE' };
    path.push(event);
    here = stageReducer(here, event, NO_TECH);
  }
  return path;
}

const NO_TECH: ReadonlySet<string> = new Set();

/**
 * The stage transitions; any event a stage does not handle leaves the state as it is. `choosableIn`
 * is the stages in which `FOCUS_TECH` is accepted (the world's `ArtifactConfig.choosableIn`; every
 * choosing stage when none is given): in the other of the intro and the overview a choice changes
 * nothing. Moving the focus on in a
 * technology focus is a choice made where the focus began, so it is not asked again.
 */
export function stageReducer(state: StageState, event: StageEvent, knownTechIds: ReadonlySet<string>, choosableIn: readonly ChoosingStage[] = CHOOSING_STAGES): StageState {
  if (event.type === 'REQUEST') return requestPath(state, event.stage).reduce((current, step) => stageReducer(current, step, knownTechIds, choosableIn), state);
  switch (state.stage) {
    case 'entering':
      return event.type === 'ENTRANCE_DONE' || event.type === 'SKIP' ? at('intro') : state;
    case 'intro':
      if (event.type === 'FOCUS_TECH') return knownTechIds.has(event.id) && choosableIn.includes('intro') ? focus(event.id, 'intro') : state;
      return event.type === 'OPEN_OVERVIEW' ? at('overview') : state;
    case 'overview':
      if (event.type === 'FOCUS_TECH') return knownTechIds.has(event.id) && choosableIn.includes('overview') ? focus(event.id, 'overview') : state;
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
