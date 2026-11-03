import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Project } from '../content/projectTypes';
import { type StageEvent, type StageState, initialStage, stageReducer } from './stageMachine';
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

/**
 * The instance's stage: starts from the review options it was given (the host parsed them from the
 * URL), the visitor's motion preference and, for a page, whether the world's entrance was seen this session.
 */
export function useStage(project: Project, { worldId, mode, options }: { worldId: string; mode: 'page' | 'preview'; options: ReviewOptions }) {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);
  const knownTechIds = useMemo(
    () => new Set([...(project.primaryTechnologyIds ?? []), ...(project.technologyUsages ?? []).map(usage => usage.technologyId)]),
    [project],
  );
  const [state, setState] = useState<StageState>(() => {
    const start = initialStage({ entranceSeen: readEntranceSeen(worldId, mode), requested: options.stage, reducedMotion: readReducedMotion() });
    return start.stage === 'techFocus' && options.tech && knownTechIds.has(options.tech) ? { ...start, techId: options.tech } : start;
  });
  const dispatch = useCallback((event: StageEvent) => setState(current => stageReducer(current, event, knownTechIds)), [knownTechIds]);
  useEffect(() => {
    if (state.stage !== 'entering') rememberEntranceSeen(worldId, mode);
  }, [state.stage, worldId, mode]);
  return { state, dispatch, reducedMotion };
}
