import { restFromCurve, type ArmRest } from '../../engine/character/armChain';
import { ARM_IDS, type ArmId, type Point2 } from '../../engine/config/types';
import { BODY_X, VEYRA_POSES } from './poses';
import type { StagePose, SwimPoseSet } from '../../engine/poses/types';

// Veyra's swim poses (spec 7.9), read from P1 (docs/design/references/Veyra/01 - ..., her entrance).
// P1 shows her from the side, facing right, in a long glide: the head forward and level, the arms
// released behind her in a loose fan that streams back and a little down, each one flowing in a long
// S and ending in a curled tip; T1 loops up over the back of the head. The swim poses are not that
// side view: they are the arm shapes in the space the arms are authored in (seen from the front),
// which the stage swings back behind her as the stroke has it (ArmDrive.pitch: 0.9 rad open, 1.3
// swept back; motion/stroke.ts). So P1's reading is carried as shapes, not traced pixels:
//  - `open` is the arms released and spread round her like an opening umbrella, wide and soft (P1's
//    fan seen from the front), nearly straight with a gentle S in each, the tips curling;
//  - `trail` is the bundle that streams behind in the glide: the arms side by side, leaving down
//    and drawing a little together, longer and looser than Nox's, each in a slow S (P1's arms
//    alternate their bows: one bows up, the next down), with the tips' spirals kept.
// Each arm keeps its intro root and its intro length, and its tip curls the way it does in the
// intro, so blending to and from the intro never turns any part of an arm more than about 150
// degrees, where the blender's short way round would fold it (swim.test.ts checks it).

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
const POINTS = 32;
/** Where the tip curl begins, as a fraction along the arm; it winds tighter toward the tip. */
const CURL_FROM = 0.62;
const CURL_POWER = 1.7;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Each arm's intro shape, fitted once per build and shared by both poses. */
type IntroRests = Record<ArmId, ArmRest>;

/** Which way an arm's tip curls in the intro: +1 counter-clockwise, -1 clockwise. */
function curlOf({ angles }: ArmRest) {
  let turn = 0;
  for (let k = Math.floor(angles.length * 0.6); k < angles.length - 1; k++) turn += Math.atan2(Math.sin(angles[k + 1] - angles[k]), Math.cos(angles[k + 1] - angles[k]));
  return Math.sign(turn);
}

/** An arm's curve from its intro root, `arm`'s heading, bend and curl, at its intro length. */
function swimCurve(root: ArmRest, arm: SwimArm): Point2[] {
  const length = root.segmentLength * root.angles.length;
  const wind = curlOf(root);
  const step = length / POINTS;
  const points: Point2[] = [[root.rootX, root.rootY]];
  let [x, y] = [root.rootX, root.rootY];
  const from = arm.from ?? CURL_FROM;
  for (let i = 0; i < POINTS; i++) {
    const s = (i + 0.5) / POINTS;
    const curl = s > from ? ((s - from) / (1 - from)) ** CURL_POWER : 0;
    // The bend is an S: it bows one way through the first half and gives it back through the second.
    const heading = rad(arm.heading + arm.bend * smoothstep(0.1, 0.62, s) + wind * Math.abs(arm.curl) * curl);
    x += step * Math.cos(heading);
    y += step * Math.sin(heading);
    points.push([x, y]);
  }
  // The arm's spline runs a touch shorter than the polyline: scale it about the root to the intro length.
  const k = length / (restFromCurve(points).segmentLength * root.angles.length);
  return points.map(([px, py]) => [root.rootX + (px - root.rootX) * k, root.rootY + (py - root.rootY) * k] as Point2);
}

const pose = (intro: IntroRests, arms: Record<ArmId, SwimArm>): StagePose => ({
  ...VEYRA_POSES.intro,
  arms: Object.fromEntries(ARM_IDS.map(id => [id, swimCurve(intro[id], arms[id])])) as Record<ArmId, Point2[]>,
  expression: 'happy',
});

/**
 * Open: released, an umbrella opening round her. The eight arms go round the body from the upper
 * left, under it, to the upper right, about 36 degrees apart, nearly straight, each bowing a
 * little against its curl, and the tips curling toward the full turns of her intro (each curl is the most that keeps the blend to the intro from folding it).
 */
const OPEN: Record<ArmId, SwimArm> = {
  T1: { heading: 146, bend: -12, curl: 150 },
  T2: { heading: 182, bend: -12, curl: 315 },
  T3: { heading: 218, bend: -10, curl: 270 },
  T4: { heading: 253, bend: 10, curl: 165 },
  T5: { heading: 287, bend: -10, curl: 240 },
  T6: { heading: 322, bend: 10, curl: 315 },
  T7: { heading: 358, bend: 12, curl: 345 },
  T8: { heading: 34, bend: 12, curl: 270 },
};

/**
 * Trail: the arms streaming behind her. They leave downward, side by side in their order round
 * the body, in a looser fan than a tight bundle (P1's arms fan out behind her), under half the umbrella's width, each bowing the
 * opposite way to its neighbour so the bundle ripples, the tips' curls kept. The rear arms (T1, T8)
 * rise beside the head in the intro, so they curl late here: blending between the two never swings
 * their middle more than about 150 degrees.
 */
const TRAIL: Record<ArmId, SwimArm> = {
  T1: { heading: 236, bend: 8, curl: 150, from: 0.7 },
  T2: { heading: 245, bend: -7, curl: 315 },
  T3: { heading: 255, bend: 7, curl: 225 },
  T4: { heading: 265, bend: -5, curl: 165 },
  T5: { heading: 275, bend: 5, curl: 255 },
  T6: { heading: 285, bend: -7, curl: 255 },
  T7: { heading: 295, bend: 7, curl: 270 },
  T8: { heading: 304, bend: -8, curl: 165, from: 0.7 },
};

/** The arms stretch out a little as she swims, less than Nox's fifth: she glides, she does not strain. */
export const VEYRA_SWIM_STRETCH = 1.12;

let built: { open: StagePose; trail: StagePose } | null = null;
function build() {
  if (!built) {
    const intro = Object.fromEntries(ARM_IDS.map(id => [id, restFromCurve(VEYRA_POSES.intro.arms[id])])) as IntroRests;
    built = { open: pose(intro, OPEN), trail: pose(intro, TRAIL) };
  }
  return built;
}

/**
 * Veyra's swim (`VEYRA_BUNDLE.swim`). The two poses are built on first use (24 curve fits), not
 * when the page loads: nothing here may delay the first frame. The intro arms they are fitted to
 * are shared and never changed.
 */
export const VEYRA_SWIM: SwimPoseSet = {
  get open() {
    return build().open;
  },
  get trail() {
    return build().trail;
  },
  stretch: VEYRA_SWIM_STRETCH,
  bodyX: BODY_X,
};
