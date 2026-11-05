import { VEYRA } from './character';
import { ARM_IDS, type ArmId, type ArmSpec, type Point2, type StageId } from '../../engine/config/types';
import { flattenForDepth, toContent, withRoot as withRootAt } from '../../engine/poses/authoring';
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

// P3 (the overview), traced in world units from the 3x panel (docs/design/references/Veyra/03 - ...): world (x, y) ->
// 3x px (802.5 + 300 x, 742.5 - 300 y), 100 native px a unit from the panel's centre (the overview frame is
// exactly the panel). Measured first, then traced: the eyes (the dark pixels in each eye box) at (-0.49, -0.33)
// and (0.47, -0.32), their outer corners 1.35 apart; the dome's rim (the greenest pixel along profiles across it)
// fits a superellipse centred (0, 0.655), half-width 1.44, half-height 0.98, power 2.2 (character.ts `dome`).
// The face is painted wider than P2's: the eyes 0.96 apart (P2 0.75) at P2's eye size, so no one scale matches
// both; at 1.18 the eyes' outer corners land on P3's, at 1 the eyes are P2's size. The scale is 1.1 between them
// (the eyes 0.83 apart, 10% larger than P3's), which also keeps the arms near P3's thickness. Each curve is an
// arm's visible centre line, root end first, read at 0.1-unit grid lines on 2x zooms of the 3x panel (the trace
// method is in the Task 12 report). The painting shows about eleven arms (six on the left, five on the right)
// carrying twelve orbs; Veyra keeps eight: the top pair rising beside the dome and hooking over (T1, T8), the
// upper side pair reaching out at shoulder height under the React and Cloudflare orbs (T2, T7), the middle side
// pair out level and curling down at the tips (T3 under JS, T6 over AWS and Linux), and the lower pair down and
// out to the Express and Docker orbs (T4, T5). The two thin centre arms (MongoDB, Redis) and the node arm are
// not traced: their orbs move to the eight (Task 14's slots).
const OVERVIEW_BODY = { x: -0.34, y: 0.225, scale: 1.1, yaw: 0 };

export const OVERVIEW_TRACED: Record<ArmId, Point2[]> = {
  T1: [[-1.15, -0.22], [-1.35, -0.1], [-1.48, 0.1], [-1.53, 0.35], [-1.55, 0.6], [-1.58, 0.8], [-1.66, 0.95], [-1.78, 1.04], [-1.88, 1.05], [-1.95, 1], [-1.95, 0.92], [-1.89, 0.88], [-1.85, 0.92]],
  T2: [[-0.85, -0.45], [-1.05, -0.4], [-1.25, -0.33], [-1.45, -0.21], [-1.62, -0.05], [-1.76, 0.1], [-1.9, 0.17], [-2.03, 0.14], [-2.11, 0.05], [-2.12, -0.05], [-2.06, -0.1], [-2.01, -0.06]],
  T3: [[-0.75, -0.7], [-0.95, -0.71], [-1.15, -0.69], [-1.35, -0.62], [-1.55, -0.56], [-1.75, -0.55], [-1.92, -0.6], [-2.02, -0.7], [-2.03, -0.82], [-1.97, -0.88], [-1.91, -0.84], [-1.92, -0.78]],
  T4: [[-0.4, -0.85], [-0.55, -1], [-0.68, -1.15], [-0.8, -1.28], [-0.9, -1.4], [-0.96, -1.52], [-0.95, -1.63], [-0.88, -1.67], [-0.83, -1.62], [-0.86, -1.57]],
  T5: [[0.6, -0.85], [0.8, -0.95], [1, -1.07], [1.18, -1.2], [1.32, -1.3], [1.44, -1.4], [1.5, -1.52], [1.47, -1.62], [1.4, -1.64], [1.37, -1.58], [1.41, -1.55]],
  T6: [[0.75, -0.6], [0.95, -0.64], [1.17, -0.66], [1.38, -0.6], [1.58, -0.56], [1.76, -0.57], [1.92, -0.66], [2.01, -0.8], [2.02, -0.96], [1.96, -1.06], [1.89, -1.03], [1.88, -0.96], [1.93, -0.93]],
  T7: [[0.85, -0.43], [1.05, -0.4], [1.25, -0.36], [1.48, -0.29], [1.7, -0.16], [1.88, -0.03], [2.05, 0.05], [2.17, 0.04], [2.22, -0.04], [2.18, -0.11], [2.11, -0.1], [2.11, -0.04]],
  T8: [[1.1, -0.4], [1.3, -0.22], [1.42, 0], [1.47, 0.25], [1.51, 0.48], [1.58, 0.64], [1.7, 0.73], [1.83, 0.76], [1.94, 0.71], [1.97, 0.62], [1.92, 0.56], [1.86, 0.6]],
};

const OVERVIEW_ARMS = Object.fromEntries(
  ARM_IDS.map(id => [id, flattenForDepth(withRoot(spec(id), toContent(OVERVIEW_TRACED[id], OVERVIEW_BODY)), spec(id))]),
) as Record<ArmId, Point2[]>;

/**
 * The overview: the head opens into the dome with the project panel inside, the face at the dome's
 * bottom with the happy open smile, upright (the dome rides the head's tilt), the arms spread wide.
 */
const OVERVIEW: StagePose = { arms: OVERVIEW_ARMS, body: OVERVIEW_BODY, tilt: 0, expression: 'happy', headMorph: 1, orbs: 1 };

// P4 (the tech focus), traced from the 3x panel (docs/design/references/Veyra/04 - ...; native 667 x 528, world (x, y)
// -> 3x px (1000.5 + 300 x, 792 - 300 y)): the head is closed, the other arms keep floating where they were, and the
// arm that holds React rises from under the face beside the head and curls over the orb, which it holds up beside the
// eyes (the orb at (0.77, 0.99), the eyes at (-0.735, 0.573) and (0.05, 0.79)). P4 paints React on her right; React is
// her first technology, so it hangs from T1 (her left, as in P3, artifacts.ts), and the lift is P4's mirrored. The arm's
// centre line was read on a 0.1-unit grid relative to the head's near edge (P4: 0.57 right of the eyes' midpoint) and the
// eyes' midpoint (height), then placed on the overview: the closed head's left edge at x -1.10 on the stage (and 0.1 further
// out, so the arm clears Veyra's rounder head: 0.1 rounder at the side than P4's), the eyes'
// midpoint at y -0.325, P4 to the overview 1.02 (eyes 0.81 apart in P4, 0.83 in the overview). The engine shows a focus
// in the pose of the stage it came from and moves the chosen arm by the select strategy (the suction hold until Task 19's
// arm lift, whose target this is); this pose is that target as data.
const P4_LIFT: Point2[] = [[-0.863, -1.08], [-1.032, -0.876], [-1.2, -0.672], [-1.287, -0.437], [-1.302, -0.192], [-1.322, 0.042], [-1.389, 0.277], [-1.542, 0.42], [-1.745, 0.45], [-1.944, 0.369], [-2.066, 0.205]];

/** Where the held orb sits in the tech focus (P4's React, mirrored to T1), on the stage: under the curl, beside the eyes. */
export const TECH_FOCUS_ORB: Point2 = [-1.745, -0.009];

const TECH_FOCUS: StagePose = {
  ...OVERVIEW,
  arms: { ...OVERVIEW_ARMS, T1: flattenForDepth(withRoot(spec('T1'), toContent(P4_LIFT, OVERVIEW_BODY)), spec('T1')) },
  headMorph: 0,
  expression: 'focused',
};

// P5 (the detail), traced from the 3x panel (docs/design/references/Veyra/05 - ...; native 867 x 528, the detail frame
// 8.67 x 5.28: world (x, y) -> 3x px (1300.5 + 300 x, 792 - 300 y)). She moves to the left edge, partly cropped, turned
// three-quarters toward the panel with her head leaning: the eyes at (-3.175, 0.013) and (-2.518, 0.29) (0.71 apart, the
// line rising 23 degrees to the right), the head from x -3.79 to -2.32 and its top at 0.89, the open smile at (-2.77,
// -0.08). The body lands her eyes there at the intro's size (P5's near eye is P2's, 0.38 tall), yawed toward the panel
// and leaning. The arms keep the intro's spread, as Nox's detail does: the left ones run off the frame's edge and the
// right ones under the panel, as P5's do; P5's own arms are not traced.
const DETAIL: StagePose = { ...INTRO, body: { x: -3.05, y: 0.6, scale: 0.88, yaw: 0.45 }, tilt: 0.38, look: [0.3, 0.2], expression: 'attentive' };

// The entrance reuses the intro until Milestone 4/5 traces P1 (spec 7.4).
export const VEYRA_POSES: Record<StageId, StagePose> = {
  entering: { ...INTRO },
  intro: INTRO,
  overview: OVERVIEW,
  techFocus: TECH_FOCUS,
  detail: DETAIL,
};
