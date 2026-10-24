import { armDepth } from '../character/armChain';
import { NOX } from '../config/nox.character';
import { CAMERA_Z } from '../config/stage';
import { ARM_IDS, type ArmId, type ArmSpec, type Point2, type StageId } from '../config/types';
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

/**
 * The flat curve an arm is built from, so that at its depth (it fans forward or back from the
 * body) the stage camera still sees the traced curve: each point moves toward the view axis by
 * (CAMERA_Z - z) / CAMERA_Z, with z read at the point's arc fraction along the curve.
 */
export function flattenForDepth(curve: readonly Point2[], arm: ArmSpec): Point2[] {
  const along = [0];
  for (let i = 1; i < curve.length; i++) along.push(along[i - 1] + Math.hypot(curve[i][0] - curve[i - 1][0], curve[i][1] - curve[i - 1][1]));
  const total = along[along.length - 1] || 1;
  return curve.map(([x, y], i) => {
    const f = (CAMERA_Z - armDepth(along[i] / total, arm)) / CAMERA_Z;
    return [x * f, y * f] as Point2;
  });
}

// Panel 2, re-traced in world units against the high-quality panel
// (docs/design/references/Nox/Nox Introduces the Security Lab.png). The painting shows two extra
// arm tips low on each side; Nox keeps exactly eight arms, so only the eight it shares are traced.
export const INTRO_TRACED: Record<ArmId, Point2[]> = {
  T1: withRoot(spec('T1'), [[-0.98, -0.92], [-1.07, -0.75], [-1.09, -0.58], [-1.1, -0.42], [-1.12, -0.3], [-1.16, -0.21], [-1.24, -0.18], [-1.33, -0.2], [-1.4, -0.26], [-1.39, -0.32], [-1.33, -0.34], [-1.3, -0.3]]),
  T2: withRoot(spec('T2'), [[-0.68, -1.0], [-0.95, -0.98], [-1.2, -0.87], [-1.4, -0.73], [-1.6, -0.62], [-1.8, -0.575], [-2.0, -0.6], [-2.14, -0.69], [-2.2, -0.81], [-2.15, -0.92], [-2.06, -0.96], [-2.0, -0.92], [-2.03, -0.87]]),
  T3: withRoot(spec('T3'), [[-0.5, -1.2], [-0.8, -1.25], [-1.1, -1.26], [-1.38, -1.28], [-1.58, -1.32], [-1.7, -1.41], [-1.71, -1.52], [-1.63, -1.59], [-1.53, -1.58], [-1.49, -1.52], [-1.54, -1.48]]),
  T4: withRoot(spec('T4'), [[-0.1, -1.1], [-0.18, -1.28], [-0.3, -1.46], [-0.45, -1.59], [-0.63, -1.66], [-0.8, -1.66], [-0.93, -1.61], [-0.97, -1.54], [-0.92, -1.5], [-0.86, -1.53], [-0.87, -1.58]], 0, [-0.08, -0.98]),
  T5: withRoot(spec('T5'), [[0.18, -1.1], [0.2, -1.28], [0.27, -1.47], [0.37, -1.62], [0.5, -1.72], [0.62, -1.75], [0.72, -1.72], [0.77, -1.65], [0.73, -1.59], [0.66, -1.6], [0.65, -1.66]], 0, [0.16, -0.98]),
  T6: withRoot(spec('T6'), [[0.45, -1.18], [0.75, -1.18], [1.0, -1.17], [1.3, -1.12], [1.55, -1.1], [1.72, -1.17], [1.8, -1.3], [1.77, -1.43], [1.67, -1.5], [1.58, -1.47], [1.57, -1.4], [1.62, -1.37]]),
  T7: withRoot(spec('T7'), [[0.7, -0.98], [0.95, -0.9], [1.2, -0.77], [1.4, -0.64], [1.6, -0.56], [1.8, -0.555], [1.95, -0.62], [2.02, -0.75], [1.99, -0.88], [1.9, -0.95], [1.82, -0.92], [1.84, -0.86]]),
  T8: withRoot(spec('T8'), [[0.9, -0.95], [0.96, -0.75], [0.98, -0.58], [1.0, -0.46], [1.04, -0.38], [1.11, -0.35], [1.18, -0.37], [1.22, -0.43], [1.2, -0.49], [1.14, -0.51], [1.11, -0.47]]),
};

const INTRO_ARMS = Object.fromEntries(ARM_IDS.map(id => [id, flattenForDepth(INTRO_TRACED[id], spec(id))])) as Record<ArmId, Point2[]>;

const INTRO: StagePose = { arms: INTRO_ARMS, body: { x: 0, y: 0, scale: 1, yaw: 0 }, expression: 'gentle', headMorph: 0 };

// Other stages are authored against their panels in Tasks 19 to 23; until then they reuse the intro.
export const NOX_POSES: Record<StageId, StagePose> = {
  entering: INTRO,
  intro: INTRO,
  overview: INTRO,
  techFocus: INTRO,
  detail: INTRO,
};
