import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Project } from '../content/projectTypes';
import { type StageEvent, type StageState, initialStage, stageReducer } from './stageMachine';
import { parseUrlState } from './urlState';

const ENTRANCE_SEEN = 'octoverse.nox.entranceSeen';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Whether this session has seen the entrance (it plays once per session). */
export function readEntranceSeen() {
  try {
    return sessionStorage.getItem(ENTRANCE_SEEN) === '1';
  } catch {
    return false;
  }
}

function rememberEntranceSeen() {
  try {
    sessionStorage.setItem(ENTRANCE_SEEN, '1');
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

/** The page's stage: starts from the URL, the visitor's motion preference and whether the entrance was seen this session. */
export function useStage(project: Project) {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);
  const knownTechIds = useMemo(
    () => new Set([...(project.primaryTechnologyIds ?? []), ...(project.technologyUsages ?? []).map(usage => usage.technologyId)]),
    [project],
  );
  const [state, setState] = useState<StageState>(() => {
    const url = parseUrlState(location.search);
    const start = initialStage({ entranceSeen: readEntranceSeen(), requested: url.stage, reducedMotion: readReducedMotion() });
    return start.stage === 'techFocus' && url.tech && knownTechIds.has(url.tech) ? { ...start, techId: url.tech } : start;
  });
  const dispatch = useCallback((event: StageEvent) => setState(current => stageReducer(current, event, knownTechIds)), [knownTechIds]);
  useEffect(() => {
    if (state.stage !== 'entering') rememberEntranceSeen();
  }, [state.stage]);
  return { state, dispatch, reducedMotion };
}
