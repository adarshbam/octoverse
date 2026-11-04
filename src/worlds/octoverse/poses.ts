import { HOST, HOST_FACES } from './character';
import { armDepth, restFromCurve, type ArmRest } from '../../engine/character/armChain';
import { CAMERA_Z } from '../../engine/config/stage';
import { ARM_IDS, type ArmId, type ArmSpec, type Point2, type StageId } from '../../engine/config/types';
import { flattenForDepth, withRoot as withRootAt } from '../../engine/poses/authoring';
import type { StagePose } from '../../engine/poses/types';

// The host's stage poses (platform spec 7.4), authored for the host and never derived from a
// world's. Task 2 traced the intro from P2; Task 6 the overview (How It Works) from P3, with
// `headMorph: 0` so the head never swells, the How It Works cards' places, and the entering pose and
// the swim from P1.

/** The body's centre line in the arms' space, and the hidden roots' height under the mantle. */
export const BODY_X = 0;
const ROOT_Y = -1.0;

/** The engine's root helper, bound to the host's body line and root height. */
const withRoot = (spec: ArmSpec, visible: readonly Point2[]) => withRootAt(spec, visible, { bodyX: BODY_X, rootY: ROOT_Y });

const spec = (id: ArmId) => HOST.arms.find(arm => arm.id === id)!;

/**
 * How much wider than P2 the shoulder and low arms (T2, T3, T6, T7) are spread, about the body's
 * centre line. P2's own silhouette spans 4.42 units (the P2 mask, x -2.38 to +2.04: its right-hand
 * arms reach less far than its left); spec 2.2 asks 4.70 ± 0.20, the widest of all octopuses. Those
 * four set the span; they keep P2's shapes and curls and are spread by this much across. The rising
 * pair (T1, T8) hugs the head as painted, and the centre pair hangs as painted. Task 3 took the spread
 * from 1.06 to 1.04 when the arms grew to P2's thickness (their own width now carries the span).
 */
export const ARM_SPREAD = 1.04;
const SPREAD_ARMS: readonly ArmId[] = ['T2', 'T3', 'T6', 'T7'];
const spread = (id: ArmId, points: readonly Point2[]): Point2[] => {
  const k = SPREAD_ARMS.includes(id) ? ARM_SPREAD : 1;
  return points.map(([x, y]) => [BODY_X + (x - BODY_X) * k, y]);
};

/**
 * P2, traced in stage units on the 3x panel (docs/design/references/Octoverse/02 - Octoverse
 * Arrives and Introduces Itself.png; native px (256 + 100 x, 254 - 100 y)): each arm's centre line
 * from where it leaves the body to its tip, the tip spirals as authored points. The painting shows
 * more than eight arms below the body (two diagonal lower arms each side); the host keeps exactly
 * eight, so the lower pair traced is the central one, and their tips, hidden behind P2's pill, curl
 * outward as spec 7.4 asks.
 * - T1, T8: rise beside the head and arch outward above shoulder height, curling inward at the tip.
 * - T2, T7: spiral out at shoulder height (T2 sweeps left, T7 climbs right), tips rolled under.
 * - T3, T6: sweep out low and curl down at the tips.
 * - T4, T5: hang down the centre, curling at the tips.
 * Task 3 re-traced these against the P2 mask with the arms at P2's thickness (root radius 0.22): the
 * shoulder arms sit a little lower, the rising pair a little closer to the head, so the solid flesh
 * beside the head and under the shoulder arms is arm, not water (silhouette IoU, spec 2.2); the centre
 * pair's tips are lifted clear of the pill's edge, where P2's mask stops. Round 2 moved T1's rise
 * 0.02 to 0.06 closer still, closing the gap P2 fills with deep blue beside the head, so spec 2.1's
 * arm sample (native 165, 305) lies on the arm, not on its rim light.
 */
const P2_TRACE: Record<ArmId, Point2[]> = {
  T1: [[-0.9, -1.0], [-0.96, -0.85], [-1.0, -0.71], [-1.02, -0.57], [-1.07, -0.42], [-1.19, -0.3], [-1.35, -0.22], [-1.48, -0.26], [-1.54, -0.34], [-1.53, -0.42], [-1.47, -0.45], [-1.42, -0.4], [-1.44, -0.37]],
  T2: [[-0.85, -1.05], [-1.1, -1.04], [-1.3, -0.95], [-1.49, -0.83], [-1.69, -0.74], [-1.89, -0.72], [-2.09, -0.78], [-2.23, -0.88], [-2.28, -1.02], [-2.23, -1.15], [-2.13, -1.21], [-2.02, -1.2], [-1.99, -1.14], [-2.04, -1.11]],
  T3: [[-0.55, -1.38], [-0.79, -1.5], [-0.98, -1.52], [-1.18, -1.49], [-1.37, -1.46], [-1.56, -1.49], [-1.7, -1.57], [-1.74, -1.71], [-1.67, -1.84], [-1.56, -1.87], [-1.48, -1.82], [-1.51, -1.78]],
  T4: [[-0.12, -1.25], [-0.2, -1.43], [-0.29, -1.59], [-0.4, -1.74], [-0.53, -1.84], [-0.66, -1.86], [-0.75, -1.8], [-0.77, -1.7], [-0.7, -1.64], [-0.65, -1.67]],
  T5: [[0.15, -1.27], [0.22, -1.45], [0.31, -1.61], [0.41, -1.75], [0.52, -1.84], [0.62, -1.85], [0.69, -1.78], [0.68, -1.68], [0.6, -1.63], [0.55, -1.66]],
  T6: [[0.6, -1.38], [0.89, -1.37], [1.18, -1.3], [1.48, -1.25], [1.72, -1.31], [1.86, -1.48], [1.9, -1.62], [1.82, -1.73], [1.69, -1.76], [1.61, -1.7], [1.62, -1.63], [1.65, -1.64]],
  T7: [[0.85, -1.15], [1.1, -1.11], [1.28, -0.99], [1.33, -0.78], [1.39, -0.58], [1.49, -0.42], [1.64, -0.34], [1.8, -0.34], [1.92, -0.42], [1.95, -0.55], [1.9, -0.63], [1.8, -0.64], [1.76, -0.56], [1.81, -0.51]],
  T8: [[0.82, -1.0], [0.92, -0.86], [0.97, -0.7], [1.0, -0.53], [1.02, -0.33], [1.06, -0.16], [1.14, -0.07], [1.24, -0.07], [1.33, -0.12], [1.35, -0.2], [1.3, -0.24], [1.24, -0.21], [1.26, -0.16]],
};

/** The intro as the camera sees it, in stage units, root first: P2's trace spread, with the hidden root under the mantle. */
export const INTRO_TRACED: Record<ArmId, Point2[]> = Object.fromEntries(ARM_IDS.map(id => [id, withRoot(spec(id), spread(id, P2_TRACE[id]))])) as Record<ArmId, Point2[]>;

const INTRO_ARMS = Object.fromEntries(ARM_IDS.map(id => [id, flattenForDepth(INTRO_TRACED[id], spec(id))])) as Record<ArmId, Point2[]>;

/** P2: front view, the body at the stage's centre (the head sits low in the frame, as painted), the welcome's wide open smile. */
const INTRO: StagePose = { arms: INTRO_ARMS, body: { x: 0, y: 0, scale: 1, yaw: 0 }, expression: HOST_FACES.welcome, headMorph: 0, orbs: 0 };

// ---------------------------------------------------------------------------------------------
// P3, How It Works (Task 6), traced in stage units on the 3x panel (docs/design/references/
// Octoverse/03 - Octoverse How It Works.png) and checked on the native one: native px
// (255.5 + 100 x, 254 - 100 y), P3's panel 511 x 508 with its centre on the stage's.
// The host sits low and a little smaller, its head turned to the viewer's right, with the five
// cards (HOW_IT_WORKS_CARDS) in an arc above and round it (spec 7.4, 7.10).
// ---------------------------------------------------------------------------------------------

/**
 * The overview's body. P3's head: top at y -0.23, widest at y -0.75 from x -0.75 to +0.83 (centre
 * +0.04, half-width 0.79), against P2's 0.84, so the host is drawn at 0.96. P3's eye line falls to
 * the right by about 11 degrees (eye centres near (-0.47, -0.90) and (+0.18, -1.02)): spec 2.2's
 * "turned toward the viewer's right by 8 to 15 degrees" is that turn of the head about its neck,
 * its top leaning right (`tilt`, negative leans right). P3 shows no turn about the vertical (its face
 * sits, if anything, left of the dome's middle), so the body is not yawed. The tilt carries the
 * dome's widest row about 0.13 right, so the body sits left of the stage's centre.
 * The host's face (P2's layout) sits lower and wider on its dome than P3 paints it, so with the head
 * centred on spec 2.2's numbers (body (-0.10, -0.56)) P3's face-glow sample (native 262, 395) falls on
 * the lower lip (delta E 25.9). The body is placed 0.03 left and 0.04 higher, inside spec 2.2's
 * tolerances, so the sample reads the chin's glow (5.7). Measured on the pose (poses.test.ts): centre x
 * +0.002, half-width 0.81, top -0.20; on the frozen still: +0.00, 0.80, -0.20.
 */
const OVERVIEW_BODY = { x: -0.13, y: -0.52, scale: 0.96, yaw: 0 };
const OVERVIEW_TILT = -0.19;

/**
 * Each arm's centre line as the stage camera sees it, in stage units, from where it leaves the body
 * to its tip (the hidden root is the intro's, so nothing moves under the mantle as the stage changes).
 * As painted:
 * - T1, T8: rise from behind the head, outward beside it, between the cards: T1 under Veyra and
 *   right of Aether, T8 under Nox and above "Your Octopus", their tips curling up near y -0.5
 *   (spec 2.2). T8's curl is lifted a little above P3's (which sits on the gold card's corner) and
 *   T1's held 0.1 in from P3's, so no tip lies on a card (the cards are drawn over the stage).
 * - T2: out low to the left, under Aether, curling down at x -1.25.
 * - T3, T4 / T5, T6: hang down the front in two pairs, curling toward each other near the floor.
 * - T7: down beside the gold card's left edge, curling under at y -2.0 (P3 runs it behind the card).
 * Every tip curls the way it does in the intro (left side counter-clockwise for T1 to T3, the centre
 * pair inward, the right side mirrored), so the blend from the intro never turns one inside out.
 */
export const OVERVIEW_TRACED: Record<ArmId, Point2[]> = {
  T1: [[-0.62, -1.4], [-0.78, -1.31], [-0.9, -1.18], [-0.98, -1.03], [-1.03, -0.88], [-1.06, -0.74], [-1.07, -0.63], [-1.08, -0.55], [-1.11, -0.49], [-1.16, -0.48], [-1.19, -0.53], [-1.17, -0.58], [-1.13, -0.57]],
  T2: [[-0.5, -1.5], [-0.7, -1.56], [-0.9, -1.63], [-1.08, -1.69], [-1.22, -1.76], [-1.3, -1.85], [-1.3, -1.94], [-1.24, -2.0], [-1.16, -1.99], [-1.13, -1.93], [-1.17, -1.9]],
  T3: [[-0.4, -1.62], [-0.5, -1.82], [-0.58, -2.02], [-0.63, -2.18], [-0.61, -2.3], [-0.54, -2.35], [-0.48, -2.31], [-0.49, -2.25], [-0.53, -2.26]],
  T4: [[-0.14, -1.62], [-0.16, -1.8], [-0.16, -1.98], [-0.17, -2.12], [-0.23, -2.18], [-0.28, -2.13], [-0.26, -2.07], [-0.22, -2.09]],
  T5: [[0.18, -1.62], [0.19, -1.8], [0.19, -1.98], [0.2, -2.12], [0.26, -2.18], [0.31, -2.13], [0.29, -2.07], [0.25, -2.09]],
  T6: [[0.38, -1.62], [0.45, -1.85], [0.5, -2.05], [0.53, -2.2], [0.5, -2.32], [0.43, -2.35], [0.38, -2.3], [0.4, -2.24], [0.45, -2.25]],
  T7: [[0.55, -1.42], [0.67, -1.52], [0.75, -1.65], [0.78, -1.8], [0.76, -1.93], [0.71, -2.02], [0.64, -2.04], [0.61, -1.98], [0.64, -1.93], [0.69, -1.95]],
  T8: [[0.6, -1.38], [0.72, -1.24], [0.82, -1.1], [0.9, -0.97], [0.97, -0.85], [1.03, -0.74], [1.08, -0.63], [1.13, -0.54], [1.2, -0.48], [1.27, -0.48], [1.31, -0.53], [1.3, -0.59], [1.25, -0.6], [1.22, -0.56]],
};

/**
 * A trace in stage units moved into the space the arms are authored in, so that under `body` and
 * at each point's depth (the arm fans forward or back as it leaves the body: armDepth, by arc
 * fraction) the stage camera sees the trace exactly: the inverse of the body's placement and the
 * camera's perspective. The engine's flattenForDepth is this at body (0, 0) and scale 1.
 */
function placeForDepth(root: Point2, trace: readonly Point2[], arm: ArmSpec, body: StagePose['body']): Point2[] {
  const curve: Point2[] = [[body.x + body.scale * root[0], body.y + body.scale * root[1]], ...trace];
  const along = [0];
  for (let i = 1; i < curve.length; i++) along.push(along[i - 1] + Math.hypot(curve[i][0] - curve[i - 1][0], curve[i][1] - curve[i - 1][1]));
  const total = along[along.length - 1] || 1;
  return [root, ...trace.map(([x, y], i) => {
    const f = (CAMERA_Z - body.scale * armDepth(along[i + 1] / total, arm)) / CAMERA_Z;
    return [(x * f - body.x) / body.scale, (y * f - body.y) / body.scale] as Point2;
  })];
}

const OVERVIEW_ARMS = Object.fromEntries(ARM_IDS.map(id => [id, placeForDepth(INTRO_ARMS[id][0], OVERVIEW_TRACED[id], spec(id), OVERVIEW_BODY)])) as Record<ArmId, Point2[]>;

/** How It Works: the presenting face (open smile, brows up), the head never swelling (contract 19, P2). */
const OVERVIEW: StagePose = { arms: OVERVIEW_ARMS, body: OVERVIEW_BODY, tilt: OVERVIEW_TILT, expression: HOST_FACES.presenting, headMorph: 0, orbs: 0 };

/** One How It Works card's place: its world, and its box in stage units (x0 left, y0 top, x1 right, y1 bottom; +y up). */
export interface HowItWorksCard {
  id: 'veyra' | 'flux' | 'nox' | 'aether' | 'yours';
  box: { x0: number; y0: number; x1: number; y1: number };
}

/** P3's native panel (spec 7.10): 511 x 508 px, 100 px a stage unit, its centre on the stage's. */
const P3_PANEL = { width: 511, height: 508 } as const;

/** A box given as shares of P3's panel (left, top, right, bottom), in stage units: native px / 100 from the panel's centre, +y up. */
const fromShares = (left: number, top: number, right: number, bottom: number): HowItWorksCard['box'] => ({
  x0: (left * P3_PANEL.width - P3_PANEL.width / 2) / 100,
  y0: (P3_PANEL.height / 2 - top * P3_PANEL.height) / 100,
  x1: (right * P3_PANEL.width - P3_PANEL.width / 2) / 100,
  y1: (P3_PANEL.height / 2 - bottom * P3_PANEL.height) / 100,
});

/**
 * The five How It Works cards in reading order, from spec 7.10's table (P3's native boxes as shares
 * of the panel). Stage units, so they follow the stage through the rest camera and the live shift as
 * the text does. Flux's (top centre) is the largest. In stage units:
 * Veyra (-1.94, 1.12) to (-0.97, -0.10); Flux (-0.72, 1.47) to (0.51, -0.05); Nox (0.77, 1.17) to
 * (1.74, -0.10); Aether (-2.30, -0.36) to (-1.33, -1.63); yours (0.92, -0.81) to (2.10, -2.18).
 */
export const HOW_IT_WORKS_CARDS: readonly HowItWorksCard[] = [
  { id: 'veyra', box: fromShares(0.12, 0.28, 0.31, 0.52) },
  { id: 'flux', box: fromShares(0.36, 0.21, 0.6, 0.51) },
  { id: 'nox', box: fromShares(0.65, 0.27, 0.84, 0.52) },
  { id: 'aether', box: fromShares(0.05, 0.57, 0.24, 0.82) },
  { id: 'yours', box: fromShares(0.68, 0.66, 0.91, 0.93) },
];

// ---------------------------------------------------------------------------------------------
// P1, the entrance (Task 6): the host swims in from the left in profile, facing right, its arms
// trailing in a long glowing bundle. The profile and the path are the entrance sheet's (its yaw and
// position, Task 12), as for Nox; the arm shapes are the swim's, drawn here in the space the arms are
// authored in, seen from the front before the stroke's swing (motion/stroke.ts, swimArms.ts): the
// stroke swings every arm back behind the body, so the trail's downward bundle trails behind it.
// ---------------------------------------------------------------------------------------------

/** The host's arms are drawn longer as it swims (P1's bundle is long and graceful, spec 7.4); they gather to their intro lengths as it settles. */
export const SWIM_STRETCH = 1.15;

/**
 * One arm of a swim pose, in degrees: the way it leaves the body (counter-clockwise from +x), a
 * gentle bend through its middle (positive counter-clockwise), and the curl of its tip, wound the
 * same way as the intro's, starting `from` along the arm (CURL_FROM unless given).
 */
interface SwimArm {
  heading: number;
  bend: number;
  curl: number;
  from?: number;
}

/** Points along each generated curve: plenty for the arm's spline to follow it. */
const SWIM_POINTS = 32;
/** Where the tip curl begins, as a fraction along the arm; it winds tighter toward the tip. */
const CURL_FROM = 0.64;
const CURL_POWER = 1.7;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Which way an arm's tip curls in the intro: +1 counter-clockwise, -1 clockwise. */
function curlOf({ angles }: ArmRest) {
  let turn = 0;
  for (let k = Math.floor(angles.length * 0.6); k < angles.length - 1; k++) turn += Math.atan2(Math.sin(angles[k + 1] - angles[k]), Math.cos(angles[k + 1] - angles[k]));
  return Math.sign(turn);
}

/** An arm's swim curve: from its intro root, `arm`'s heading, bend and curl, at SWIM_STRETCH times its intro length. */
function swimCurve(intro: ArmRest, arm: SwimArm): Point2[] {
  const length = intro.segmentLength * intro.angles.length * SWIM_STRETCH;
  const wind = curlOf(intro);
  const step = length / SWIM_POINTS;
  const points: Point2[] = [[intro.rootX, intro.rootY]];
  let [x, y] = [intro.rootX, intro.rootY];
  const from = arm.from ?? CURL_FROM;
  for (let i = 0; i < SWIM_POINTS; i++) {
    const s = (i + 0.5) / SWIM_POINTS;
    const curl = s > from ? ((s - from) / (1 - from)) ** CURL_POWER : 0;
    const heading = rad(arm.heading + arm.bend * smoothstep(0.1, 0.62, s) + wind * Math.abs(arm.curl) * curl);
    x += step * Math.cos(heading);
    y += step * Math.sin(heading);
    points.push([x, y]);
  }
  // The arm's spline runs a touch shorter than the polyline: scale it about the root to the length.
  const k = length / (restFromCurve(points).segmentLength * intro.angles.length);
  return points.map(([px, py]) => [intro.rootX + (px - intro.rootX) * k, intro.rootY + (py - intro.rootY) * k] as Point2);
}

/**
 * Open: an opening umbrella. The eight arms go round the body from the upper left, under it, to the
 * upper right, about 36 degrees apart, each bowing a little against its curl so it reads as an S,
 * hooking at the tip. The rising pair (T1, T8) leave highest, as they rise in the intro.
 */
const SWIM_OPEN: Record<ArmId, SwimArm> = {
  T1: { heading: 146, bend: -12, curl: 220 },
  T2: { heading: 182, bend: -12, curl: 215 },
  T3: { heading: 218, bend: -10, curl: 210 },
  T4: { heading: 253, bend: 10, curl: 250 },
  T5: { heading: 287, bend: -10, curl: 250 },
  T6: { heading: 322, bend: 10, curl: 210 },
  T7: { heading: 358, bend: 12, curl: 215 },
  T8: { heading: 34, bend: 12, curl: 220 },
};

/**
 * Trail: P1's long loose bundle. The arms leave downward, side by side in their order round the body,
 * drawing in toward the middle, their tips curled late (P1's tips roll at the very ends). The rising
 * pair curl latest, so blending to and from the intro never swings their middle more than about 150
 * degrees.
 */
const SWIM_TRAIL: Record<ArmId, SwimArm> = {
  T1: { heading: 234, bend: 6, curl: 230, from: 0.72 },
  T2: { heading: 244, bend: 6, curl: 215, from: 0.7 },
  T3: { heading: 254, bend: 5, curl: 210, from: 0.7 },
  T4: { heading: 264, bend: 3, curl: 250, from: 0.7 },
  T5: { heading: 276, bend: -3, curl: 250, from: 0.7 },
  T6: { heading: 286, bend: -5, curl: 210, from: 0.7 },
  T7: { heading: 296, bend: -6, curl: 215, from: 0.7 },
  T8: { heading: 306, bend: -6, curl: 230, from: 0.72 },
};

let swimBuilt: { open: StagePose; trail: StagePose; entering: StagePose } | null = null;
/**
 * The swim's two poses and the entering pose, built on first read (24 curve fits) rather than when
 * the page loads: the stage reads them as the entrance's sheet arrives (WorldHost), never before the
 * first frame.
 */
export function hostSwimPoses() {
  if (!swimBuilt) {
    const intro = Object.fromEntries(ARM_IDS.map(id => [id, restFromCurve(INTRO_ARMS[id])])) as Record<ArmId, ArmRest>;
    const pose = (arms: Record<ArmId, SwimArm>): StagePose => ({ ...INTRO, arms: Object.fromEntries(ARM_IDS.map(id => [id, swimCurve(intro[id], arms[id])])) as Record<ArmId, Point2[]> });
    const trail = pose(SWIM_TRAIL);
    swimBuilt = { open: pose(SWIM_OPEN), trail, entering: { ...trail, expression: HOST_FACES.welcome } };
  }
  return swimBuilt;
}

/**
 * The host's stage poses. The entering pose is P1's moment as a pose: the trailing bundle on the
 * intro's body with the welcome face (the stage itself swims in on the entrance sheet and the swim
 * poses, and holds the intro pose meanwhile, as for every world). The overview is P3's, with
 * `headMorph: 0` always (contract 19, P2); the technology focus and the detail are unreachable (the
 * host has no choosable artifacts and no detail view, spec 7.4) and equal the overview.
 */
export const HOST_POSES: Record<StageId, StagePose> = {
  get entering() {
    return hostSwimPoses().entering;
  },
  intro: INTRO,
  overview: OVERVIEW,
  techFocus: { ...OVERVIEW },
  detail: { ...OVERVIEW },
};
