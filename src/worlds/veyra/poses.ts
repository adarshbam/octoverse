import { VEYRA } from './character';
import { ARM_IDS, type ArmId, type ArmSpec, type Point2, type StageId } from '../../engine/config/types';
import { flattenForDepth, withRoot as withRootAt } from '../../engine/poses/authoring';
import type { StagePose } from '../../engine/poses/types';

/** Centre the hidden arm roots gather around (the neck, under the chin), and where the roots sit. */
export const BODY_X = 0.12;
const ROOT_Y = -1.02;

/** The engine's root helper, bound to Veyra's body line and root height. */
const withRoot = (spec: ArmSpec, visible: readonly Point2[], spread?: number, root?: Point2) => withRootAt(spec, visible, { bodyX: BODY_X, rootY: ROOT_Y }, spread, root);

const spec = (id: ArmId) => VEYRA.arms.find(arm => arm.id === id)!;

// P2 (the intro), traced in world units from the 3x panel (docs/design/references/Veyra/02 - ...):
// world (x, y) -> panel px (732 + 300 x, 742.5 - 300 y) at 3x, i.e. 100 px a unit from the native
// panel's centre. Each curve is an arm's centre line, root end first, ending in its tip's spiral as
// authored points (the contract has no curl field). T1 rises beside the head and curls outward
// above shoulder height; T2 and T7 spiral out at shoulder height; T3 and T6 spiral out lower; T4
// and T5 hang down the centre. The painting shows nine or ten arms (a third hangs between T5 and
// T6, and one more hangs behind T3); Veyra keeps exactly eight, so the eight that read most
// clearly are traced. Task 7 re-fitted every trace against the P2 silhouette mask (band middles and
// widths, IoU); the curls are the painting's: a full turn on T2, T3, T6, T7 and T8, a hook on T1,
// T4 and T5.
export const INTRO_TRACED: Record<ArmId, Point2[]> = {
  T1: withRoot(spec('T1'), [[-0.72, -0.84], [-0.8, -0.76], [-0.9, -0.64], [-0.97, -0.47], [-1.0, -0.29], [-1.02, -0.13], [-1.08, -0.01], [-1.18, 0.05], [-1.29, 0.07], [-1.38, 0.04], [-1.43, -0.02], [-1.43, -0.08], [-1.39, -0.1]]),
  T2: withRoot(spec('T2'), [[-0.6, -1.05], [-0.8, -1.01], [-0.98, -0.94], [-1.14, -0.84], [-1.28, -0.72], [-1.45, -0.65], [-1.613, -0.67], [-1.722, -0.743], [-1.806, -0.861], [-1.808, -0.998], [-1.729, -1.086], [-1.65, -1.07], [-1.62, -1.03], [-1.66, -1.0], [-1.693, -1.012]]),
  T3: withRoot(spec('T3'), [[-0.3, -1.26], [-0.5, -1.22], [-0.75, -1.2], [-1.0, -1.21], [-1.177, -1.25], [-1.287, -1.372], [-1.358, -1.483], [-1.36, -1.62], [-1.28, -1.72], [-1.18, -1.75], [-1.12, -1.68], [-1.16, -1.62], [-1.21, -1.63]]),
  T4: withRoot(spec('T4'), [[0.01, -1.08], [-0.02, -1.26], [-0.1, -1.43], [-0.234, -1.573], [-0.244, -1.7], [-0.2, -1.79], [-0.11, -1.8], [-0.02, -1.74], [0.01, -1.7]], 0, [0.04, -0.98]),
  T5: withRoot(spec('T5'), [[0.25, -1.1], [0.32, -1.25], [0.37, -1.4], [0.36, -1.55], [0.31, -1.68], [0.25, -1.77], [0.19, -1.79], [0.16, -1.74], [0.19, -1.7]], 0, [0.2, -0.98]),
  T6: withRoot(spec('T6'), [[0.55, -1.2], [0.8, -1.26], [1.0, -1.27], [1.18, -1.29], [1.295, -1.34], [1.371, -1.469], [1.39, -1.556], [1.38, -1.63], [1.3, -1.68], [1.21, -1.66], [1.17, -1.59], [1.21, -1.55], [1.27, -1.58]]),
  T7: withRoot(spec('T7'), [[0.55, -1.02], [0.75, -1.05], [0.95, -1.07], [1.15, -1.03], [1.35, -0.975], [1.52, -0.925], [1.698, -0.979], [1.781, -1.081], [1.779, -1.206], [1.73, -1.29], [1.64, -1.29], [1.61, -1.24], [1.64, -1.21], [1.674, -1.219]]),
  T8: withRoot(spec('T8'), [[0.6, -0.9], [0.8, -0.88], [0.99, -0.84], [1.16, -0.75], [1.267, -0.6], [1.45, -0.51], [1.59, -0.54], [1.66, -0.625], [1.66, -0.725], [1.61, -0.79], [1.54, -0.79], [1.51, -0.75], [1.54, -0.725]]),
};

const INTRO_ARMS = Object.fromEntries(ARM_IDS.map(id => [id, flattenForDepth(INTRO_TRACED[id], spec(id))])) as Record<ArmId, Point2[]>;

/**
 * The intro: the body at the origin, the head leaning about ten degrees (positive leans its top to
 * screen left, so the viewer's-left eye sits lower, as in P2), a gentle smile.
 */
const INTRO: StagePose = { arms: INTRO_ARMS, body: { x: 0, y: 0, scale: 1, yaw: 0 }, tilt: 0.18, expression: 'gentle', headMorph: 0, orbs: 0 };

// The other four stages reuse the intro until Milestone 3 traces P1, P3, P4 and P5 (spec 7.4); each
// is its own object so a later trace replaces it alone.
export const VEYRA_POSES: Record<StageId, StagePose> = {
  entering: { ...INTRO },
  intro: INTRO,
  overview: { ...INTRO },
  techFocus: { ...INTRO },
  detail: { ...INTRO },
};
