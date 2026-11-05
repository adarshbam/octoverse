import { AETHER } from './character';
import { ARM_IDS, type ArmId, type ArmSpec, type Point2, type StageId } from '../../engine/config/types';
import { flattenForDepth, toContent, withRoot as withRootAt } from '../../engine/poses/authoring';
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

// Panel 3, the overview (Task 11), traced in world units from the native panel and checked on the
// 3x one: world (x, y) = ((px - 254.5) / 100, (252 - py) / 100), the overview's own framing (bundle.ts).
// Her head opens into the glass dome (character.ts, `dome`), her face at its bottom with the happy
// open smile, and her arms spread into a wide horseshoe round her. P3 places her higher than P2 and
// a little to the left: the eye line at y 289 px (world -0.37, P2's is -0.68) and the dome centred
// at x 256.5 px, so the body moves to (-0.05, 0.31), at P2's size (P3's eyes are as large as P2's).
const OVERVIEW_BODY = { x: -0.05, y: 0.31, scale: 1, yaw: 0 };

// P3 paints more than eight tentacles, each with an orb hanging from its curl. Aether keeps exactly
// eight, so the horseshoe is drawn round where P3's twelve orbs hang (and four more, for the 16 slots
// of spec 7.5), each arm carrying two: one at a mid-arm point, one at its tip. As painted:
//   T1/T8  rise from behind the face and climb the dome's sides, rolling over at the top corners
//          (P3's upper orbs, at y 210 px, hang under these curls);
//   T2/T7  run out level with the cheeks and curl up and over at the sides (P3's y 280 orbs);
//   T3/T6  sweep out low and curl up at the lower sides;
//   T4/T5  hang down the front from under the chin and turn out along the bottom, curling up.
// The roots are the intro's (T4 and T5 at y -1.14 under the open mouth), so nothing pops as she
// changes stage. Left curls wind counter-clockwise, right ones clockwise, as in the intro. The left
// side is the right mirrored about her head's centre line (x +0.02).
export const OVERVIEW_TRACED: Record<ArmId, Point2[]> = {
  T1: [[-0.58, -0.42], [-0.91, -0.2], [-1.21, 0], [-1.44, 0.28], [-1.54, 0.62], [-1.62, 0.92], [-1.76, 1.08], [-1.93, 1.1], [-2.04, 1], [-2.04, 0.88], [-1.96, 0.82], [-1.89, 0.88]],
  T2: [[-0.58, -0.68], [-0.96, -0.62], [-1.36, -0.5], [-1.71, -0.3], [-1.98, -0.02], [-2.16, 0.18], [-2.27, 0.22], [-2.34, 0.12], [-2.3, 0], [-2.21, 0.02]],
  T3: [[-0.41, -0.95], [-0.76, -1.08], [-1.16, -1.18], [-1.56, -1.22], [-1.91, -1.15], [-2.16, -0.98], [-2.28, -0.8], [-2.24, -0.66], [-2.13, -0.66], [-2.1, -0.76]],
  T4: [[-0.16, -0.95], [-0.24, -1.2], [-0.36, -1.42], [-0.58, -1.57], [-0.84, -1.62], [-1.06, -1.58], [-1.2, -1.46], [-1.2, -1.34], [-1.11, -1.3], [-1.06, -1.37]],
  T5: [[0.2, -0.95], [0.28, -1.2], [0.4, -1.42], [0.62, -1.57], [0.88, -1.62], [1.1, -1.58], [1.24, -1.46], [1.24, -1.34], [1.15, -1.3], [1.1, -1.37]],
  T6: [[0.45, -0.95], [0.8, -1.08], [1.2, -1.18], [1.6, -1.22], [1.95, -1.15], [2.2, -0.98], [2.32, -0.8], [2.28, -0.66], [2.17, -0.66], [2.14, -0.76]],
  T7: [[0.62, -0.68], [1.0, -0.62], [1.4, -0.5], [1.75, -0.3], [2.02, -0.02], [2.2, 0.18], [2.31, 0.22], [2.38, 0.12], [2.34, 0], [2.25, 0.02]],
  T8: [[0.62, -0.42], [0.95, -0.2], [1.25, 0], [1.48, 0.28], [1.58, 0.62], [1.66, 0.92], [1.8, 1.08], [1.97, 1.1], [2.08, 1], [2.08, 0.88], [2.0, 0.82], [1.93, 0.88]],
};

/**
 * Where the horseshoe leaves room for an orb on each arm (arc fractions, 0 root to 1 tip): a mid-arm
 * point and a tip point. Orbs 0.6 across hung 0.16 under all 16 do not collide with one another, the
 * dome, the face or the frame (poses.test.ts); most of them do overlap an arm (see OVERVIEW_OPEN_WATER).
 * Task 12 sets the real slots; these are the room the pose leaves. T4/T5's tip point is the low turn
 * just before their short end curl.
 */
export const OVERVIEW_ROOM: Record<ArmId, readonly [number, number]> = {
  T1: [0.55, 0.9], T2: [0.5, 0.82], T3: [0.6, 0.95], T4: [0.35, 0.75],
  T5: [0.35, 0.75], T6: [0.6, 0.95], T7: [0.5, 0.82], T8: [0.55, 0.9],
};

/**
 * The room points whose orb also hangs clear of every arm (orb centre to each arm's centre line more
 * than the orb's radius plus the arm's radius there; poses.test.ts). The other twelve overlap an arm,
 * by 0.01 (T1/T8 tips against the T2/T7 curls) to 0.35 (T3/T6 tips against their own curl), as several
 * of P3's orbs sit over tentacles.
 */
export const OVERVIEW_OPEN_WATER: Partial<Record<ArmId, number>> = { T3: 0.6, T4: 0.75, T5: 0.75, T6: 0.6 };

// Every arm keeps its intro root exactly (T4 and T5's under the open mouth), so the roots do not
// move under the mantle as she changes stage.
const OVERVIEW_ARMS = Object.fromEntries(
  ARM_IDS.map(id => [id, flattenForDepth(withRoot(spec(id), toContent(OVERVIEW_TRACED[id], OVERVIEW_BODY), undefined, INTRO_TRACED[id][0]), spec(id))]),
) as Record<ArmId, Point2[]>;

const OVERVIEW: StagePose = { arms: OVERVIEW_ARMS, body: OVERVIEW_BODY, expression: 'happy', headMorph: 1, orbs: 1 };

// Panel 4, a technology in focus (Task 13), traced from the native panel (674 x 519) and checked on
// the 3x one. The head closes again and the other arms keep the overview's places, so their orbs do
// not move round; the arm that holds the chosen orb rises beside the head and its tip curls over the
// top of the orb, holding it (spec 7.5, P4). P4 paints OpenAI on her right; OpenAI is her first
// technology, so it hangs from T1's tip (her left, artifacts.ts: order 0), and the lift is P4's
// mirrored. The arm's centre line was read on P4 relative to the head's near edge (x 347 px) and the
// eyes' midpoint (284, 204.5), at P4's 109 px a unit (its eyes 75.5 px apart, hers 0.69 units), then
// placed on the overview: the closed head's left edge at x -0.725, 0.1 further out (her arms are
// thicker than P4's), and the eyes' midpoint at y -0.37 (faceAnchor, overview). So a P4 point
// (px, py) is (-0.825 - (px - 347) / 109, -0.37 + (204.5 - py) / 109). It runs from under the cheek
// (P4 (365, 235)) up past the eye line to a crest 1.18 above the eyes (P4 (410, 76)) and curls down
// over the orb's far side; the root is the intro's, as every overview arm's is. The engine shows a
// focus in the pose of the stage it came from (WorldHost: the overview) and moves the chosen orb by
// the select strategy (the suction hold, until Task 19's arm lift, whose target this pose is).
// Fix round 1: the first point (under the cheek) sits higher than P4's reading (y -0.6, was -0.65).
// The lifted T1 touched T2's mid-arm orb (T2@0.5, below and outside it) at the elbow there; moving
// the lift outward brings the elbow nearer that orb, so the elbow is raised instead, and it clears the
// orb by more than 0.02 (frames.test.ts).
const P4_LIFT: Point2[] = [[-0.99, -0.6], [-1.082, -0.375], [-1.137, -0.099], [-1.146, 0.13], [-1.119, 0.359], [-1.109, 0.543], [-1.164, 0.68], [-1.275, 0.772], [-1.403, 0.809], [-1.531, 0.791], [-1.623, 0.726]];

/** Where the held orb sits in the tech focus (P4's OpenAI at (428, 122), mirrored to T1), on the stage: under the curl, above the eyes. */
export const TECH_FOCUS_ORB: Point2 = [-1.568, 0.387];

const TECH_FOCUS: StagePose = {
  ...OVERVIEW,
  arms: { ...OVERVIEW_ARMS, T1: flattenForDepth(withRoot(spec('T1'), toContent(P4_LIFT, OVERVIEW_BODY), undefined, INTRO_TRACED.T1[0]), spec('T1')) },
  headMorph: 0,
  expression: 'curious',
};

// Panel 5, the full project view (Task 13), registered on the face against the native panel
// (861 x 519, the detail frame 8.61 x 5.19: world (x, y) = ((px - 430.5) / 100, (259.5 - py) / 100)).
// She moves to the left edge, partly cropped (her left arms run off the frame), turned three-quarters
// toward the project panel with her head leaning: P5's eyes at (87.5, 246) and (152.5, 220) px, so
// their midpoint at (-3.105, 0.265) and the line rising 22 degrees to the right; the smile at (130,
// 256). The body puts her eyes there at P2's size (P5's eyes are 68 px apart, P2's 69), leaning
// 0.37 (21 degrees) and yawed 0.32 toward the panel: P5's eyes' midpoint sits 0.19 right of her head's
// middle, which her face's depth (0.61) gives at that turn. (A wider turn, 0.45 as Veyra's, also
// pushes the additive face-glow card, which faces the camera only as the swim turns, out past her
// right cheek as a pale band: MORNING-REVIEW engine follow-ups.) Her eyes rest on the panel's
// screenshot. Registered on a capture: the eyes land at (91, 249) and (157.5, 222.5) px against P5's
// (87.5, 246) and (152.5, 220), then nudged by that difference. The ring circles her head again (the
// satellite's rest form is drawn in the detail: artifacts.ts, spec 7.5). The arms keep the intro's
// spread, as Nox's and Veyra's details do: P5's own arms (longer, hanging to the frame's bottom) are
// not traced.
const DETAIL: StagePose = { ...INTRO, body: { x: -3.115, y: 0.95, scale: 1, yaw: 0.32 }, tilt: 0.37, look: [0.65, 0.2], expression: 'attentive' };
const ENTERING: StagePose = { ...INTRO };

export const AETHER_POSES: Record<StageId, StagePose> = {
  entering: ENTERING,
  intro: INTRO,
  overview: OVERVIEW,
  techFocus: TECH_FOCUS,
  detail: DETAIL,
};
