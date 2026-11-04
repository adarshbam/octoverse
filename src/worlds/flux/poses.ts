import { FLUX } from './character';
import { ARM_IDS, type ArmId, type ArmSpec, type Point2, type StageId } from '../../engine/config/types';
import { flattenForDepth, withRoot as withRootAt } from '../../engine/poses/authoring';
import type { StagePose } from '../../engine/poses/types';

/** The centre the hidden arm roots gather around, and where the roots sit. */
export const BODY_X = 0;
const ROOT_Y = -1.02;

/** The engine's root helper, bound to Flux's body line and root height. */
const withRoot = (spec: ArmSpec, visible: readonly Point2[], spread?: number, root?: Point2) => withRootAt(spec, visible, { bodyX: BODY_X, rootY: ROOT_Y }, spread, root);

const spec = (id: ArmId) => FLUX.arms.find(arm => arm.id === id)!;

// Panel 2 (P2, public/flux/ref/p2.png), traced in world units (1 unit = 100 native px, origin at the
// panel's centre (255.5, 255), +y up) on the 3x panel under a world-unit grid
// (docs/design/references/Flux/02 - ...png). Each polyline is the arm's centreline, from where it
// leaves the body to its tip, and the open tip curls of about half to one turn are authored points
// (spec 7.4): T1 and T8 rise beside the head and curl outward above head height; T2 and T7 reach out
// wide at shoulder height and curl down; T3 and T6 curl out lower at the sides; T4 and T5 hang in
// the centre and curl at the tips, dipping behind the nameplate. First traced in Task 2; Task 6
// moved the points against the P2 mask (public/flux/ref/p2-mask.png) until the frozen render's silhouette
// overlaps it at IoU 0.85 (the rear arms' upper bodies sit about 0.05 outward of their trace in the render).
export const INTRO_TRACED: Record<ArmId, Point2[]> = {
  T1: withRoot(spec('T1'), [[-0.55, -1.02], [-0.82, -0.99], [-1.02, -0.88], [-1.09, -0.72], [-1.05, -0.57], [-0.99, -0.44], [-0.98, -0.32], [-1.03, -0.22], [-1.12, -0.17], [-1.2, -0.2], [-1.24, -0.27], [-1.2, -0.33]]),
  T2: withRoot(spec('T2'), [[-0.7, -1.34], [-0.98, -1.26], [-1.25, -0.97], [-1.48, -0.69], [-1.69, -0.63], [-1.83, -0.68], [-1.91, -0.84], [-1.87, -0.97], [-1.78, -1.01], [-1.72, -0.96], [-1.75, -0.92]]),
  T3: withRoot(spec('T3'), [[-0.7, -1.38], [-1.0, -1.4], [-1.22, -1.47], [-1.36, -1.61], [-1.39, -1.77], [-1.31, -1.87], [-1.23, -1.83], [-1.24, -1.78]]),
  T4: withRoot(spec('T4'), [[-0.22, -1.22], [-0.28, -1.42], [-0.36, -1.6], [-0.47, -1.75], [-0.6, -1.86], [-0.76, -1.89], [-0.9, -1.95], [-0.95, -2.06], [-0.9, -2.18], [-0.81, -2.19], [-0.78, -2.14]], 0, [-0.06, -1.0]),
  T5: withRoot(spec('T5'), [[0.18, -1.2], [0.24, -1.44], [0.36, -1.56], [0.56, -1.6], [0.74, -1.62], [0.88, -1.68], [0.97, -1.79], [0.99, -1.91], [0.92, -2.0], [0.83, -2.0], [0.79, -1.94]], 0, [0.06, -1.0]),
  T6: withRoot(spec('T6'), [[0.72, -1.38], [1.0, -1.34], [1.2, -1.3], [1.33, -1.3], [1.43, -1.38], [1.46, -1.5], [1.42, -1.6], [1.35, -1.63], [1.31, -1.59]]),
  T7: withRoot(spec('T7'), [[0.4, -1.15], [0.65, -1.2], [0.9, -1.23], [1.1, -1.19], [1.3, -1.04], [1.45, -0.88], [1.6, -0.73], [1.77, -0.69], [1.9, -0.77], [1.93, -0.91], [1.87, -1.0], [1.81, -0.99]]),
  T8: withRoot(spec('T8'), [[0.55, -0.95], [0.78, -0.92], [0.94, -0.8], [1.02, -0.62], [1.04, -0.47], [1.07, -0.38], [1.14, -0.36], [1.2, -0.4], [1.21, -0.47], [1.16, -0.5]]),
};

const INTRO_ARMS = Object.fromEntries(ARM_IDS.map(id => [id, flattenForDepth(INTRO_TRACED[id], spec(id))])) as Record<ArmId, Point2[]>;

const INTRO: StagePose = { arms: INTRO_ARMS, body: { x: 0, y: 0, scale: 1, yaw: 0 }, expression: 'happy', headMorph: 0, orbs: 0 };

// Until Milestone 3 traces P3, P4 and P5, every other stage reuses the intro's arms and body, and
// differs only in what a stage is: the overview opens the head into the dome with the orbs out, a
// technology focus closes it again, and the detail turns attentive with no orbs.
export const FLUX_POSES: Record<StageId, StagePose> = {
  entering: INTRO,
  intro: INTRO,
  overview: { ...INTRO, expression: 'happy', headMorph: 1, orbs: 1 },
  techFocus: { ...INTRO, expression: 'happy', headMorph: 0, orbs: 1 },
  detail: { ...INTRO, expression: 'attentive', headMorph: 0, orbs: 0 },
};
