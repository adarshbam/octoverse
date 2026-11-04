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
// clearly are traced. The curls here are the painting's (about three quarters of a turn): the
// rolled full coils are the jelly pass's work (spec 2.3).
export const INTRO_TRACED: Record<ArmId, Point2[]> = {
  T1: withRoot(spec('T1'), [[-0.72, -0.84], [-0.8, -0.76], [-0.9, -0.64], [-0.97, -0.47], [-1.0, -0.29], [-1.02, -0.13], [-1.08, 0.0], [-1.18, 0.08], [-1.29, 0.09], [-1.38, 0.06], [-1.43, -0.01], [-1.45, -0.07], [-1.42, -0.1]]),
  T2: withRoot(spec('T2'), [[-0.62, -0.92], [-0.85, -0.92], [-1.04, -0.8], [-1.27, -0.7], [-1.44, -0.63], [-1.62, -0.66], [-1.74, -0.74], [-1.8, -0.86], [-1.79, -1.0], [-1.74, -1.09], [-1.67, -1.11], [-1.62, -1.06], [-1.66, -1.01]]),
  T3: withRoot(spec('T3'), [[-0.3, -1.3], [-0.49, -1.37], [-0.71, -1.35], [-0.93, -1.31], [-1.16, -1.31], [-1.3, -1.4], [-1.36, -1.52], [-1.36, -1.63], [-1.3, -1.71], [-1.21, -1.74], [-1.13, -1.69], [-1.15, -1.62], [-1.21, -1.61]]),
  T4: withRoot(spec('T4'), [[0.01, -1.08], [-0.02, -1.26], [-0.1, -1.43], [-0.2, -1.59], [-0.24, -1.7], [-0.2, -1.79], [-0.11, -1.8], [-0.02, -1.74], [0.01, -1.7]], 0, [0.04, -0.98]),
  T5: withRoot(spec('T5'), [[0.26, -1.1], [0.33, -1.25], [0.4, -1.4], [0.41, -1.56], [0.37, -1.7], [0.31, -1.79], [0.25, -1.8], [0.22, -1.74], [0.25, -1.7]], 0, [0.2, -0.98]),
  T6: withRoot(spec('T6'), [[0.55, -1.2], [0.8, -1.26], [1.0, -1.3], [1.18, -1.32], [1.3, -1.36], [1.4, -1.45], [1.43, -1.56], [1.38, -1.67], [1.3, -1.72], [1.21, -1.7], [1.17, -1.63], [1.21, -1.59], [1.27, -1.62]]),
  T7: withRoot(spec('T7'), [[0.55, -0.98], [0.78, -1.04], [0.98, -1.07], [1.18, -1.08], [1.36, -1.05], [1.53, -0.99], [1.68, -0.99], [1.76, -1.08], [1.74, -1.21], [1.67, -1.29], [1.59, -1.28], [1.57, -1.22], [1.62, -1.2]]),
  T8: withRoot(spec('T8'), [[0.55, -0.8], [0.76, -0.84], [0.92, -0.87], [1.09, -0.85], [1.24, -0.69], [1.4, -0.57], [1.56, -0.59], [1.67, -0.69], [1.67, -0.78], [1.6, -0.82], [1.54, -0.77]]),
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
