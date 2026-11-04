import { AETHER } from './character';
import { ARM_IDS, type ArmId, type ArmSpec, type Point2, type StageId } from '../../engine/config/types';
import { flattenForDepth, withRoot as withRootAt } from '../../engine/poses/authoring';
import type { StagePose } from '../../engine/poses/types';

/** Centre the hidden arm roots gather around (her head's centre), and where the roots sit (just under the chin). */
export const BODY_X = 0.07;
const ROOT_Y = -1.08;

/** The engine's root helper, bound to Aether's body line and root height. */
const withRoot = (spec: ArmSpec, visible: readonly Point2[], spread?: number, root?: Point2) => withRootAt(spec, visible, { bodyX: BODY_X, rootY: ROOT_Y }, spread, root);

const spec = (id: ArmId) => AETHER.arms.find(arm => arm.id === id)!;

// Panel 2, traced in world units from the 3x panel (docs/design/references/Aether/02 - ...png) and
// checked on the native one: world (x, y) = ((px - 257) / 100, (252 - py) / 100). Each arm is its
// centre line (the middle of its back rim and its cup edge), root first, then the tip's curl as
// authored points winding inward. The painting shows rear tentacle stubs behind the head on both
// sides; Aether keeps exactly eight arms, so only the eight that carry the pose are traced, as
// spec 7.4 names them:
//   T1/T8  the upper side arms, at shoulder height, rolling their tips down and in;
//   T2/T7  the second pair, a little lower, curling;
//   T3/T6  the third pair, low, curling (the painting runs behind the nameplate under y -1.9, so
//          the curl below it is authored here);
//   T4/T5  the centre pair, hanging down the front. Their roots sit at y -1.14, under the chin
//          (P2's chin sample is at y -1.13): rooted any higher, the arms' tops cover the lower
//          half of an open mouth and its tongue (Task 4: at y -1.0 they hid it).
// The left side's curls wind counter-clockwise and the right's clockwise, as painted.
export const INTRO_TRACED: Record<ArmId, Point2[]> = {
  T1: withRoot(spec('T1'), [[-0.6, -1.17], [-0.87, -1.17], [-1.07, -1.065], [-1.22, -0.92], [-1.37, -0.815], [-1.52, -0.78], [-1.67, -0.815], [-1.77, -0.87], [-1.83, -0.95], [-1.84, -1.05], [-1.8, -1.14], [-1.72, -1.19], [-1.65, -1.16], [-1.64, -1.08], [-1.69, -1.03]]),
  T2: withRoot(spec('T2'), [[-0.33, -1.33], [-0.47, -1.39], [-0.67, -1.46], [-0.87, -1.44], [-1.07, -1.38], [-1.27, -1.32], [-1.42, -1.29], [-1.53, -1.33], [-1.6, -1.42], [-1.62, -1.53], [-1.58, -1.64], [-1.49, -1.71], [-1.4, -1.69], [-1.36, -1.61], [-1.4, -1.56]]),
  T3: withRoot(spec('T3'), [[-0.28, -1.5], [-0.41, -1.64], [-0.57, -1.74], [-0.77, -1.75], [-0.92, -1.72], [-1.02, -1.76], [-1.05, -1.83], [-1.0, -1.89], [-0.92, -1.9], [-0.86, -1.85], [-0.89, -1.8]]),
  T4: withRoot(spec('T4'), [[-0.07, -1.2], [-0.09, -1.32], [-0.11, -1.48], [-0.15, -1.68], [-0.22, -1.86], [-0.3, -1.99], [-0.42, -2.08], [-0.52, -2.1], [-0.6, -2.04], [-0.6, -1.95], [-0.53, -1.92], [-0.48, -1.97]], 0, [-0.02, -1.14]),
  T5: withRoot(spec('T5'), [[0.17, -1.2], [0.21, -1.32], [0.27, -1.45], [0.33, -1.55], [0.42, -1.69], [0.5, -1.86], [0.58, -1.99], [0.68, -2.08], [0.78, -2.1], [0.86, -2.04], [0.87, -1.95], [0.8, -1.92], [0.75, -1.97]], 0, [0.16, -1.14]),
  T6: withRoot(spec('T6'), [[0.4, -1.45], [0.53, -1.6], [0.65, -1.68], [0.78, -1.73], [0.93, -1.75], [1.05, -1.74], [1.16, -1.79], [1.21, -1.88], [1.2, -1.98], [1.13, -2.06], [1.05, -2.06], [1.01, -1.98], [1.06, -1.94]]),
  T7: withRoot(spec('T7'), [[0.5, -1.3], [0.63, -1.31], [0.83, -1.36], [1.05, -1.4], [1.2, -1.335], [1.33, -1.27], [1.44, -1.23], [1.53, -1.205], [1.62, -1.22], [1.71, -1.275], [1.8, -1.39], [1.82, -1.47], [1.79, -1.55], [1.73, -1.61], [1.66, -1.6], [1.62, -1.54], [1.65, -1.5]]),
  T8: withRoot(spec('T8'), [[0.6, -1.08], [0.83, -1.1], [1.03, -1.09], [1.23, -0.99], [1.33, -0.9], [1.43, -0.775], [1.54, -0.705], [1.64, -0.68], [1.74, -0.69], [1.83, -0.74], [1.87, -0.83], [1.85, -0.91], [1.79, -0.95], [1.75, -0.91]]),
};

const INTRO_ARMS = Object.fromEntries(ARM_IDS.map(id => [id, flattenForDepth(INTRO_TRACED[id], spec(id))])) as Record<ArmId, Point2[]>;

/** The intro, as the panel 2 trace: she faces the visitor with a soft smile. */
const INTRO: StagePose = { arms: INTRO_ARMS, body: { x: 0, y: 0, scale: 1, yaw: 0 }, expression: 'gentle', headMorph: 0, orbs: 0 };

// Every other stage reuses the intro's arms and body until milestone 3 traces them from her own
// panels (the overview from P3, the detail from P5, the entrance from P1): only what a stage
// means is set, the head's swell and the orbs in the overview and its expression.
const OVERVIEW: StagePose = { ...INTRO, expression: 'happy', headMorph: 1, orbs: 1 };
const TECH_FOCUS: StagePose = { ...OVERVIEW, headMorph: 0 };
const DETAIL: StagePose = { ...INTRO, expression: 'attentive' };
const ENTERING: StagePose = { ...INTRO };

export const AETHER_POSES: Record<StageId, StagePose> = {
  entering: ENTERING,
  intro: INTRO,
  overview: OVERVIEW,
  techFocus: TECH_FOCUS,
  detail: DETAIL,
};
