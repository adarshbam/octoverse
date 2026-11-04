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
// the centre and curl at the tips, dipping behind the nameplate. A first trace (Task 2): Task 6
// tightens it against the mask.
export const INTRO_TRACED: Record<ArmId, Point2[]> = {
  T1: withRoot(spec('T1'), [[-0.5, -1.0], [-0.7, -0.93], [-0.85, -0.8], [-0.98, -0.62], [-1.02, -0.42], [-1.0, -0.27], [-1.08, -0.17], [-1.18, -0.14], [-1.25, -0.17], [-1.26, -0.26]]),
  T2: withRoot(spec('T2'), [[-0.7, -1.26], [-0.98, -1.15], [-1.23, -0.94], [-1.48, -0.77], [-1.7, -0.71], [-1.85, -0.75], [-1.93, -0.88], [-1.89, -1.0], [-1.79, -1.05], [-1.73, -0.98], [-1.76, -0.94]]),
  T3: withRoot(spec('T3'), [[-0.7, -1.53], [-1.03, -1.53], [-1.28, -1.55], [-1.43, -1.65], [-1.45, -1.78], [-1.38, -1.86], [-1.29, -1.84], [-1.29, -1.79]]),
  T4: withRoot(spec('T4'), [[-0.16, -1.22], [-0.2, -1.44], [-0.3, -1.62], [-0.44, -1.77], [-0.6, -1.86], [-0.76, -1.89], [-0.9, -1.95], [-0.95, -2.06], [-0.9, -2.18], [-0.81, -2.19], [-0.78, -2.14]], 0, [-0.06, -1.0]),
  T5: withRoot(spec('T5'), [[0.18, -1.2], [0.22, -1.46], [0.38, -1.58], [0.58, -1.64], [0.78, -1.68], [0.94, -1.76], [1.04, -1.88], [1.06, -2.0], [0.98, -2.09], [0.88, -2.08], [0.84, -2.02]], 0, [0.06, -1.0]),
  T6: withRoot(spec('T6'), [[0.72, -1.5], [1.0, -1.48], [1.2, -1.4], [1.35, -1.34], [1.46, -1.4], [1.5, -1.53], [1.46, -1.61], [1.39, -1.65], [1.34, -1.61]]),
  T7: withRoot(spec('T7'), [[0.4, -1.15], [0.65, -1.2], [0.9, -1.23], [1.1, -1.19], [1.3, -1.05], [1.45, -0.9], [1.6, -0.75], [1.77, -0.71], [1.91, -0.79], [1.94, -0.93], [1.88, -1.01], [1.82, -1.0]]),
  T8: withRoot(spec('T8'), [[0.5, -0.9], [0.75, -0.88], [0.95, -0.75], [1.01, -0.55], [1.04, -0.37], [1.07, -0.3], [1.16, -0.31], [1.26, -0.36], [1.29, -0.46], [1.24, -0.5]]),
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
