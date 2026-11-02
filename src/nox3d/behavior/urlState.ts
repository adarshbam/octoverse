import type { StageId } from '../config/types';
import type { QualityTier } from '../stage/quality';
import type { Vec3 } from '../world/types';
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
  /** The 3D world in place of the painted plate (until it replaces it for everyone). */
  world: boolean;
  /** Seconds of world time a frozen world shows, for still captures. */
  t?: number;
  /** World box [x0, y0, x1, y1] the camera frames, for real zoom. */
  view?: [number, number, number, number];
  /** Camera hover offset [x, y, z] pinned for still captures (in place of the drift; with `freeze`, 0 otherwise). */
  hover?: Vec3;
  /** A quality tier forced for the session, instead of the one picked for the device. */
  tier?: QualityTier;
  /** Test content in place of the project's own (honoured in development builds only). */
  fixture?: 'nosections';
  /**
   * For measurement captures only: hides the technology orbs, the dome glass and, in the world,
   * the ambient bubbles. The world's embers, and the bubbles and embers without a world, stay.
   */
  solo: boolean;
}

/** Review and debugging switches read from the page URL. Unknown values are ignored. */
export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const state: UrlState = { freeze: params.has('freeze'), orbit: params.has('orbit'), noWebgl: params.has('nowebgl'), world: params.has('world'), solo: params.has('solo') };
  const stage = params.get('stage');
  if (stage && (STAGES as readonly string[]).includes(stage)) state.stage = stage as StageId;
  const tech = params.get('tech');
  if (tech) state.tech = tech;
  const expression = params.get('expression');
  if (expression && Object.hasOwn(EXPRESSIONS, expression)) state.expression = expression as ExpressionId;
  const view = params.get('view')?.split(',').map(Number);
  if (view && view.length === 4 && view.every(Number.isFinite)) state.view = view as UrlState['view'];
  const t = params.get('t');
  if (t && Number.isFinite(Number(t))) state.t = Number(t);
  const hover = params.get('hover')?.split(',').map(Number);
  if (hover && hover.length === 3 && hover.every(Number.isFinite)) state.hover = hover as unknown as Vec3;
  const tier = params.get('tier');
  if (tier === 'high' || tier === 'medium' || tier === 'low') state.tier = tier;
  if (params.get('fixture') === 'nosections') state.fixture = 'nosections';
  return state;
}
