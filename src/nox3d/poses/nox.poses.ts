import type { ArmId, ArmSpec, Point2, StageId } from '../config/types';
import { NOX } from '../config/nox.character';
import type { StagePose } from './types';

/** Centre the hidden arm roots gather around, and where the roots sit. */
export const BODY_X = 0.04;
const ROOT_Y = -1.02;

/**
 * Prepends the hidden root under the mantle so all eight arms share one body.
 * Front arms root lower so their thick base tucks under the chin, not over the mouth.
 */
function withRoot(spec: ArmSpec, visible: readonly Point2[], spread = 0.2, root?: Point2): Point2[] {
  if (root) return [root, ...visible];
  const [x] = visible[0];
  const rootY = spec.depth === 'front' ? ROOT_Y - 0.1 : ROOT_Y;
  return [[BODY_X + (x - BODY_X) * spread, rootY], ...visible];
}

const spec = (id: ArmId) => NOX.arms.find(arm => arm.id === id)!;

// Panel 2 of Nox.jpeg, traced in world units (spike commit 58cf458). Baseline, not final.
const INTRO_ARMS: Record<ArmId, Point2[]> = {
  T1: withRoot(spec('T1'), [[-0.72, -0.95], [-0.85, -0.77], [-0.93, -0.53], [-1.0, -0.33], [-1.07, -0.2], [-1.17, -0.15], [-1.25, -0.18], [-1.28, -0.27], [-1.23, -0.32], [-1.18, -0.3]]),
  T2: withRoot(spec('T2'), [[-0.75, -0.94], [-1.02, -0.88], [-1.35, -0.73], [-1.68, -0.62], [-1.92, -0.62], [-2.06, -0.72], [-2.09, -0.86], [-2.0, -0.99], [-1.9, -1.03], [-1.85, -0.98], [-1.89, -0.92]]),
  T3: withRoot(spec('T3'), [[-0.45, -1.27], [-0.7, -1.29], [-1.0, -1.31], [-1.25, -1.33], [-1.45, -1.4], [-1.56, -1.5], [-1.58, -1.6], [-1.52, -1.69], [-1.42, -1.72], [-1.33, -1.68], [-1.32, -1.61], [-1.37, -1.58]]),
  T4: withRoot(spec('T4'), [[-0.1, -1.12], [-0.14, -1.3], [-0.28, -1.52], [-0.5, -1.66], [-0.7, -1.74], [-0.88, -1.79], [-1.0, -1.8], [-1.06, -1.76], [-1.03, -1.7], [-0.97, -1.72]], 0, [-0.08, -0.98]),
  T5: withRoot(spec('T5'), [[0.18, -1.12], [0.22, -1.3], [0.36, -1.52], [0.58, -1.66], [0.8, -1.74], [0.98, -1.79], [1.12, -1.78], [1.2, -1.71], [1.16, -1.64], [1.09, -1.67]], 0, [0.16, -0.98]),
  T6: withRoot(spec('T6'), [[0.42, -1.25], [0.83, -1.2], [1.17, -1.18], [1.5, -1.18], [1.74, -1.27], [1.85, -1.4], [1.82, -1.52], [1.7, -1.58], [1.6, -1.55], [1.58, -1.48], [1.63, -1.45]]),
  T7: withRoot(spec('T7'), [[0.72, -0.94], [1.0, -0.84], [1.33, -0.67], [1.6, -0.58], [1.83, -0.6], [1.97, -0.72], [1.99, -0.86], [1.9, -0.96], [1.8, -0.94], [1.77, -0.88], [1.82, -0.84]]),
  T8: withRoot(spec('T8'), [[0.77, -0.95], [0.88, -0.75], [0.97, -0.57], [1.0, -0.42], [1.04, -0.33], [1.1, -0.3], [1.19, -0.31], [1.26, -0.38], [1.26, -0.45], [1.21, -0.48], [1.17, -0.44]]),
};

const INTRO: StagePose = { arms: INTRO_ARMS, body: { x: 0, y: 0, scale: 1, yaw: 0 }, expression: 'gentle', headMorph: 0 };

// Other stages are authored against their panels in Tasks 19 to 23; until then they reuse the intro.
export const NOX_POSES: Record<StageId, StagePose> = {
  entering: INTRO,
  intro: INTRO,
  overview: INTRO,
  techFocus: INTRO,
  detail: INTRO,
};
