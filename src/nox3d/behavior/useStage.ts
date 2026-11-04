import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ChoosingStage, StageId } from '../config/types';
import type { Project } from '../content/projectTypes';
import { type LinkStage, type StageEvent, type StageState, initialStage, stageReducer } from './stageMachine';
import type { ReviewOptions } from './urlState';

/** The sessionStorage key of a world's entrance flag (Nox's is the one it has always had). */
export const entranceSeenKey = (worldId: string) => `octoverse.${worldId}.entranceSeen`;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Whether this session has seen the world's entrance (it plays once per session). A preview ignores storage: it has not. */
export function readEntranceSeen(worldId: string, mode: 'page' | 'preview') {
  if (mode !== 'page') return false;
  try {
    return sessionStorage.getItem(entranceSeenKey(worldId)) === '1';
  } catch {
    return false;
  }
}

/** Records that this session has seen the world's entrance (a preview records nothing). */
export function rememberEntranceSeen(worldId: string, mode: 'page' | 'preview') {
  if (mode !== 'page') return;
  try {
    sessionStorage.setItem(entranceSeenKey(worldId), '1');
  } catch {
    // Storage can be unavailable (private windows, blocked site data); the entrance just replays.
  }
}

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia?.(REDUCED_MOTION);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}
/** Whether the visitor prefers reduced motion. */
export const readReducedMotion = () => window.matchMedia?.(REDUCED_MOTION).matches ?? false;

/** The stage an instance is asked to open on: the host's `initialStage` (a link: never the entrance or a focus), else the review options' `?stage=`. */
export function requestedStage(options: ReviewOptions, initial?: LinkStage) {
  return initial ? { requested: initial as StageId, linked: true } : { requested: options.stage, linked: false };
}

/**
 * The instance's stage: starts from the host's `initial` stage or the review options it was given
 * (the host parsed them from the URL), the visitor's motion preference and, for a page, whether the
 * world's entrance was seen this session. `choosableIn` is the stages in which a technology can be
 * chosen (the world's ArtifactConfig). `request` is the host's stage request (a new `id` is a new
 * request, taken as the visitor's own moves); `onChange` hears each stage the instance moves to
 * (not the one it started in).
 */
export function useStage(
  project: Project,
  { worldId, mode, options, choosableIn, initial, request, onChange }: {
    worldId: string;
    mode: 'page' | 'preview';
    options: ReviewOptions;
    choosableIn: readonly ChoosingStage[];
    initial?: LinkStage;
    request?: { id: number; stage: LinkStage };
    onChange?: (stage: StageId) => void;
  },
) {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);
  const knownTechIds = useMemo(
    () => new Set([...(project.primaryTechnologyIds ?? []), ...(project.technologyUsages ?? []).map(usage => usage.technologyId)]),
    [project],
  );
  const [state, setState] = useState<StageState>(() => {
    const start = initialStage({ entranceSeen: readEntranceSeen(worldId, mode), ...requestedStage(options, initial), reducedMotion: readReducedMotion() });
    return start.stage === 'techFocus' && options.tech && knownTechIds.has(options.tech) ? { ...start, techId: options.tech } : start;
  });
  const dispatch = useCallback((event: StageEvent) => setState(current => stageReducer(current, event, knownTechIds, choosableIn)), [knownTechIds, choosableIn]);
  useEffect(() => {
    if (state.stage !== 'entering') rememberEntranceSeen(worldId, mode);
  }, [state.stage, worldId, mode]);
  // The host's request: each new id once (StrictMode runs the effect twice; the id is remembered).
  const taken = useRef<number | null>(null);
  useEffect(() => {
    if (!request || taken.current === request.id) return;
    taken.current = request.id;
    dispatch({ type: 'REQUEST', stage: request.stage });
  }, [request, dispatch]);
  // The host hears each change of stage, from the stage it started in.
  const latest = useRef(onChange);
  const told = useRef(state.stage);
  useEffect(() => {
    latest.current = onChange;
  });
  useEffect(() => {
    if (told.current === state.stage) return;
    told.current = state.stage;
    latest.current?.(state.stage);
  }, [state.stage]);
  return { state, dispatch, reducedMotion };
}
