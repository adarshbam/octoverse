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
// Task 6 refitted the traces to the hand-corrected P2 mask (an offline fit of each arm's turn, scale,
// curl size and bow, kept in the arm-span range 3.69 to 3.99), then extended T2, T3, T6 and T7 by
// one point each so four arms close a full curl (spec 2.3; T1 kept short: one more point moved its
// top rim off the P2 sample) and eased T7's bend at x 1.04. Fix round 1 moved single trace points
// (a per-point fit on the real capture's mask, three passes) to bring the IoU to 0.85 with the
// nameplate left out: T1 is held still (five colour samples sit on it), T8's first points rise a
// little toward the painted stub on the right, the others close the water gaps P2 leaves open.
export const INTRO_TRACED: Record<ArmId, Point2[]> = {
  T1: withRoot(spec('T1'), [[-0.6, -1.17], [-0.85, -1.14], [-1.05, -1.01], [-1.23, -0.91], [-1.39, -0.88], [-1.54, -0.855], [-1.69, -0.875], [-1.79, -0.918], [-1.82, -1.02], [-1.83, -1.09], [-1.81, -1.15], [-1.76, -1.18], [-1.72, -1.15], [-1.72, -1.09], [-1.76, -1.05]]),
  T2: withRoot(spec('T2'), [[-0.35, -1.31], [-0.465, -1.38], [-0.642, -1.46], [-0.889, -1.47], [-1.02, -1.38], [-1.11, -1.32], [-1.31, -1.29], [-1.44, -1.35], [-1.56, -1.5], [-1.57, -1.55], [-1.51, -1.69], [-1.44, -1.76], [-1.36, -1.77], [-1.31, -1.68], [-1.33, -1.62], [-1.47, -1.58]]),
  T3: withRoot(spec('T3'), [[-0.28, -1.5], [-0.414, -1.66], [-0.58, -1.78], [-0.786, -1.81], [-0.941, -1.78], [-1.05, -1.85], [-1.08, -1.95], [-1.04, -2.03], [-0.94, -2.06], [-0.873, -2.02], [-0.887, -1.99], [-0.922, -2.03]]),
  T4: withRoot(spec('T4'), [[-0.07, -1.2], [-0.067, -1.32], [-0.062, -1.48], [-0.077, -1.68], [-0.123, -1.86], [-0.178, -1.99], [-0.276, -2.08], [-0.355, -2.1], [-0.415, -2.05], [-0.396, -1.96], [-0.307, -1.93], [-0.234, -1.98]], 0, [-0.02, -1.14]),
  T5: withRoot(spec('T5'), [[0.17, -1.2], [0.223, -1.31], [0.298, -1.44], [0.371, -1.52], [0.478, -1.67], [0.577, -1.82], [0.674, -1.94], [0.792, -2.02], [0.927, -2.03], [1.01, -1.97], [1.02, -1.85], [0.954, -1.81], [0.913, -1.83]], 0, [0.16, -1.14]),
  T6: withRoot(spec('T6'), [[0.4, -1.45], [0.545, -1.56], [0.677, -1.63], [0.815, -1.65], [0.967, -1.66], [1.09, -1.66], [1.19, -1.72], [1.26, -1.81], [1.25, -1.93], [1.16, -2.03], [1.07, -2.03], [1.02, -1.92], [1.08, -1.87], [1.12, -1.89]]),
  T7: withRoot(spec('T7'), [[0.5, -1.3], [0.632, -1.27], [0.836, -1.29], [1.04, -1.29], [1.2, -1.22], [1.34, -1.17], [1.45, -1.14], [1.54, -1.15], [1.62, -1.17], [1.75, -1.24], [1.83, -1.39], [1.85, -1.5], [1.81, -1.59], [1.73, -1.67], [1.65, -1.69], [1.59, -1.58], [1.64, -1.54], [1.68, -1.57]]),
  T8: withRoot(spec('T8'), [[0.603, -0.92], [0.849, -0.951], [1.12, -1.02], [1.2, -1.01], [1.33, -0.919], [1.46, -0.802], [1.55, -0.726], [1.62, -0.701], [1.74, -0.71], [1.83, -0.774], [1.87, -0.854], [1.86, -0.934], [1.82, -0.975], [1.74, -0.935]]),
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
