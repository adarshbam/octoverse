import type { StageId } from '../config/types';
import type { QualityTier } from '../stage/quality';
import { EXPRESSIONS, type ExpressionId } from './expressions';

const STAGES: readonly StageId[] = ['entering', 'intro', 'overview', 'techFocus', 'detail'];

export interface UrlState {
  stage?: StageId;
  tech?: string;
  /** Face shown instead of the stage's own, for expression captures. */
  expression?: ExpressionId;
  /** Rest pose, no motion: for comparison captures. */
  freeze: boolean;
  /** Orbit camera for inspecting depth. */
  orbit: boolean;
  noWebgl: boolean;
  /** World box [x0, y0, x1, y1] the camera frames, for real zoom. */
  view?: [number, number, number, number];
  /** A quality tier forced for the session, instead of the one picked for the device. */
  tier?: QualityTier;
  /** Test content in place of the project's own (honoured in development builds only). */
  fixture?: 'nosections';
}

/** Review and debugging switches read from the page URL. Unknown values are ignored. */
export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const state: UrlState = { freeze: params.has('freeze'), orbit: params.has('orbit'), noWebgl: params.has('nowebgl') };
  const stage = params.get('stage');
  if (stage && (STAGES as readonly string[]).includes(stage)) state.stage = stage as StageId;
  const tech = params.get('tech');
  if (tech) state.tech = tech;
  const expression = params.get('expression');
  if (expression && Object.hasOwn(EXPRESSIONS, expression)) state.expression = expression as ExpressionId;
  const view = params.get('view')?.split(',').map(Number);
  if (view && view.length === 4 && view.every(Number.isFinite)) state.view = view as UrlState['view'];
  const tier = params.get('tier');
  if (tier === 'high' || tier === 'medium' || tier === 'low') state.tier = tier;
  if (params.get('fixture') === 'nosections') state.fixture = 'nosections';
  return state;
}
