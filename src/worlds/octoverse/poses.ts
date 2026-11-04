import { HOST, HOST_FACES } from './character';
import { ARM_IDS, type ArmId, type ArmSpec, type Point2, type StageId } from '../../engine/config/types';
import { flattenForDepth, withRoot as withRootAt } from '../../engine/poses/authoring';
import type { StagePose } from '../../engine/poses/types';

// The host's stage poses (platform spec 7.4), authored for the host and never derived from a
// world's. Task 2 traces the intro from P2; the other stages show the intro until Task 6 traces
// the overview from P3 (with `headMorph: 0`, so the head never swells) and the entering pose from P1.

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

/**
 * Until Task 6 every other stage shows the intro. The overview (How It Works) keeps `headMorph: 0`
 * always (contract 19, P2); the technology focus and the detail are unreachable (the host has no
 * choosable artifacts and no detail view, spec 7.4).
 */
export const HOST_POSES: Record<StageId, StagePose> = {
  entering: INTRO,
  intro: INTRO,
  overview: { ...INTRO, headMorph: 0 },
  techFocus: { ...INTRO, headMorph: 0 },
  detail: { ...INTRO, headMorph: 0 },
};
