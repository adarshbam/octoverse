import { FLUX } from './character';
import { ARM_IDS, type ArmId, type ArmSpec, type Point2, type StageId } from '../../engine/config/types';
import { flattenForDepth, toContent, withRoot as withRootAt } from '../../engine/poses/authoring';
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

// Panel 3 (P3, the overview, public/flux/ref/p3.png, 515 x 510 native px), traced in world units
// (origin at the panel's centre (257.5, 255), 100 px a unit, +y up) on the 3x panel under a
// world-unit grid. The body is placed on the face: P3's irises sit at x -0.36 and 0.40, y -0.415
// (src/worlds/flux/review/p3_targets.json), as far apart as P2's, so the scale stays 1 and the body
// rises 0.13 and moves 0.02 right. The head opens into the dome and the arms spread in a ring round
// it. The painting shows ten tentacles (two more hang in the centre, over the Linux and chart orbs);
// Flux keeps exactly eight.
//
// Task 12 reshaped the arms round P3's twelve orbs (artifacts.ts: the eight tips, and about 55%
// along T1, T8, T2 and T7). The engine hangs an orb straight down from its slot with no thread, and
// P3's orbs are big (radius 0.28), so an orb clears the arm below it only where that arm keeps out
// from under it; Task 11's ring (traced from the painting's ten tentacles) had T2 under T1's mid orb
// and T3 under T2's. Now, left to right mirrored: T1 runs out level under the dome's lower corner
// (its mid orb hangs there, P3's TypeScript place) and climbs beside the dome to a hook whose tip
// holds the top orb (P3's GitHub); T2 runs out level at the shoulder with its mid orb inside (P3's
// Redis) and its tip orb outside (P3's JavaScript, lower); T3 sweeps down and out under them to the
// lower outer orb (P3's Docker, further out); T4 and T5 hang below the face to the two bottom orbs
// (P3's Linux and chart). Every orb stays more than 0.05 clear of the other arms, the face and the
// panel (artifacts.test.ts, slotCriteria.ts); the arms leave the body where Task 11's did.
const OVERVIEW_BODY = { x: 0.02, y: 0.13, scale: 1, yaw: 0 };

export const OVERVIEW_TRACED: Record<ArmId, Point2[]> = {
  T1: [[-0.62, -0.62], [-0.9, -0.5], [-1.17, -0.32], [-1.42, -0.13], [-1.6, -0.04], [-1.69, 0.12], [-1.71, 0.36], [-1.69, 0.6], [-1.71, 0.82], [-1.8, 0.93], [-1.93, 0.9], [-1.97, 0.8], [-1.94, 0.74]],
  T2: [[-0.66, -0.78], [-0.95, -0.85], [-1.2, -0.86], [-1.42, -0.84], [-1.65, -0.82], [-1.88, -0.79], [-2.05, -0.76], [-2.17, -0.8], [-2.19, -0.9], [-2.15, -0.96]],
  T3: [[-0.62, -0.85], [-0.78, -1.1], [-0.94, -1.4], [-1.1, -1.62], [-1.3, -1.75], [-1.5, -1.78], [-1.68, -1.74], [-1.75, -1.66]],
  T4: [[-0.25, -0.95], [-0.29, -1.2], [-0.33, -1.45], [-0.4, -1.63], [-0.5, -1.73], [-0.6, -1.76], [-0.66, -1.73]],
  T5: [[0.29, -0.95], [0.33, -1.2], [0.37, -1.45], [0.44, -1.63], [0.54, -1.73], [0.64, -1.76], [0.7, -1.73]],
  T6: [[0.66, -0.85], [0.82, -1.1], [0.98, -1.4], [1.14, -1.62], [1.34, -1.75], [1.54, -1.78], [1.72, -1.74], [1.79, -1.66]],
  T7: [[0.7, -0.78], [0.99, -0.85], [1.24, -0.86], [1.46, -0.84], [1.69, -0.82], [1.92, -0.79], [2.09, -0.76], [2.21, -0.8], [2.23, -0.9], [2.19, -0.96]],
  T8: [[0.66, -0.62], [0.94, -0.5], [1.21, -0.32], [1.46, -0.13], [1.64, -0.04], [1.73, 0.12], [1.75, 0.36], [1.73, 0.6], [1.75, 0.82], [1.84, 0.93], [1.97, 0.9], [2.01, 0.8], [1.98, 0.74]],
};

// The centre arms keep the intro's roots (spread 0, by the body's middle), as in P2.
const OVERVIEW_ROOTS: Partial<Record<ArmId, Point2>> = { T4: [-0.06, -1.0], T5: [0.06, -1.0] };

/** An overview-framed arm from its trace: to the arms' space under the overview body, with its hidden root, flattened for depth. */
const overviewArm = (id: ArmId, trace: readonly Point2[]): Point2[] => {
  const root = OVERVIEW_ROOTS[id];
  const visible = toContent(trace, OVERVIEW_BODY);
  return flattenForDepth(root ? withRoot(spec(id), visible, 0, root) : withRoot(spec(id), visible), spec(id));
};

const OVERVIEW_ARMS = Object.fromEntries(ARM_IDS.map(id => [id, overviewArm(id, OVERVIEW_TRACED[id])])) as Record<ArmId, Point2[]>;

const OVERVIEW: StagePose = { arms: OVERVIEW_ARMS, body: OVERVIEW_BODY, expression: 'happy', headMorph: 1, orbs: 1 };

// Panel 4 (P4, the tech focus): the overview's arms with the head closed, and T8 standing tall,
// holding its tip orb high beside the head (spec 7.4: "T8 straight up, its orb held high at the
// tip"). The engine hangs the orb from the tip, so T8 climbs straight up outside its overview hook
// (x 1.98 to 2.0, from y 0.1 to 1.35) and hooks back over, the orb hanging inside the hook at about
// y 1.2 (P4's GitHub orb is at the top right, level with the top of the head). Its first stretch dips
// a little lower than the overview's so its mid orb (55% along) still hangs from a level stretch, at
// the foot of the climb. The face is the eager one (spec 7.3: the `focused` override, P4's
// "opens its mouth slightly").
export const TECH_FOCUS_T8: Point2[] = [[0.66, -0.62], [0.8, -0.7], [1.0, -0.68], [1.2, -0.55], [1.4, -0.32], [1.55, -0.12], [1.7, -0.02], [1.86, 0.0], [1.98, 0.1], [2.0, 0.35], [1.99, 0.7], [1.98, 1.05], [1.96, 1.35], [1.88, 1.55], [1.75, 1.6], [1.66, 1.52], [1.67, 1.42]];

const TECH_FOCUS: StagePose = { ...OVERVIEW, arms: { ...OVERVIEW_ARMS, T8: overviewArm('T8', TECH_FOCUS_T8) }, expression: 'focused', headMorph: 0, orbs: 1 };

// Panel 5 (P5, the detail; native 875 x 513, the detail frame at 100 px a unit, origin at the
// panel's centre (437.5, 256.5)), read on the 3x panel under a 0.2-unit grid: Flux at the left edge,
// his eyes at (-3.71, 0.165) and (-2.94, 0.10), 0.77 apart (P2's 0.74, so a scale of 1.04), his head
// from x -4.03 to -2.63 with its top at 1.02, the smile at (-3.34, -0.09). The body lands his eyes
// there; he turns three-quarter toward the panel on his right (yaw) and looks at it, attentive. The
// arms keep the intro's spread, as Nox's and Veyra's details do: P5's arms spread the same way round
// him and end at about y -1.55, as the intro's do at this scale; the left ones run off the frame's edge.
const DETAIL: StagePose = { ...INTRO, body: { x: -3.33, y: 0.69, scale: 1.04, yaw: 0.35 }, tilt: 0.08, look: [0.3, 0.1], expression: 'attentive', headMorph: 0, orbs: 0 };

export const FLUX_POSES: Record<StageId, StagePose> = {
  entering: INTRO,
  intro: INTRO,
  overview: OVERVIEW,
  techFocus: TECH_FOCUS,
  detail: DETAIL,
};
