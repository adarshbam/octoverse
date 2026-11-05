import { restFromCurve, type ArmRest } from '../../engine/character/armChain';
import { ARM_IDS, type ArmId, type Point2 } from '../../engine/config/types';
import { BODY_X, FLUX_POSES } from './poses';
import type { StagePose, SwimPoseSet } from '../../engine/poses/types';

// Flux's swim poses (spec 7.4, 7.9), read from P1 (docs/design/references/Flux/native-panels/01 -
// Flux Enters the Pipeline World.png). P1 shows him in three-quarter view facing right, in a quick
// glide: the head forward, the eight arms streaming back to the left in a loose, wavy bundle, each
// one rippling in an S (neighbours bow opposite ways, so the bundle ripples) and ending in an open
// curl of half a turn to a turn; the bundle is looser and wavier than Nox's, and spreads a little as
// it trails. The swim poses are not that side view: they are the arm shapes in the space the arms
// are authored in (seen from the front), which the stage swings back behind him as the stroke has
// it (ArmDrive.pitch; motion/stroke.ts). So P1 is carried as shapes, not traced pixels:
//  - `open` is the arms flung out round him like an opening umbrella, each nearly straight with a
//    gentle bow, the tips curling open (spec 7.1: open curls);
//  - `trail` is P1's bundle streaming behind in the glide: the arms side by side, leaving down in a
//    loose fan, each in an S that bows against its neighbour's, the tips' open curls kept.
// Each arm keeps its intro root and its intro length, and its tip curls the way it does in the
// intro, so blending to and from the intro never turns any part of an arm more than about 150
// degrees, where the blender's short way round would fold it (swim.test.ts checks it). The method is
// Veyra's (worlds/veyra/swim.ts), copied, not imported.

/**
 * One arm of a swim pose, in degrees: the way it leaves the body (counter-clockwise from +x), a
 * bend through its middle (positive counter-clockwise), and the curl of its tip, wound the same way
 * as the intro's, starting `from` along the arm (CURL_FROM unless given).
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
const CURL_FROM = 0.64;
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
  ...FLUX_POSES.intro,
  arms: Object.fromEntries(ARM_IDS.map(id => [id, swimCurve(intro[id], arms[id])])) as Record<ArmId, Point2[]>,
  expression: 'happy',
});

/**
 * Open: flung out, an umbrella opening round him. The eight arms go round the body from the upper
 * left, under it, to the upper right, about 36 degrees apart, nearly straight, each bowing a little,
 * the tips in open curls (spec 7.1: half a turn to a turn).
 */
const OPEN: Record<ArmId, SwimArm> = {
  T1: { heading: 146, bend: -12, curl: 150 },
  T2: { heading: 190, bend: -14, curl: 300 },
  T3: { heading: 218, bend: -10, curl: 240 },
  T4: { heading: 253, bend: 10, curl: 200 },
  T5: { heading: 287, bend: -10, curl: 200 },
  T6: { heading: 322, bend: 10, curl: 240 },
  T7: { heading: 352, bend: 12, curl: 270 },
  T8: { heading: 34, bend: 12, curl: 150 },
};

/**
 * Trail: P1's loose bundle streaming behind him. The arms leave downward side by side in their order
 * round the body, a looser fan than Nox's (P1's arms spread a little as they stream back), each
 * bowing the opposite way to its neighbour so the bundle ripples as P1's does, the tips in open
 * curls. The rear arms (T1, T8) rise beside the head in the intro, so they curl late here: blending
 * between the two never swings their middle more than about 150 degrees.
 */
const TRAIL: Record<ArmId, SwimArm> = {
  T1: { heading: 232, bend: -12, curl: 150, from: 0.7 },
  T2: { heading: 243, bend: 12, curl: 240 },
  T3: { heading: 254, bend: -12, curl: 220 },
  T4: { heading: 265, bend: 10, curl: 200 },
  T5: { heading: 275, bend: -10, curl: 200 },
  T6: { heading: 286, bend: 12, curl: 220 },
  T7: { heading: 297, bend: -12, curl: 240 },
  T8: { heading: 308, bend: 12, curl: 150, from: 0.7 },
};

/** The arms stretch out as he swims: more than Veyra's glide (1.12), less than Nox's fifth (1.2). */
export const FLUX_SWIM_STRETCH = 1.15;

let built: { open: StagePose; trail: StagePose } | null = null;
function build() {
  if (!built) {
    const intro = Object.fromEntries(ARM_IDS.map(id => [id, restFromCurve(FLUX_POSES.intro.arms[id])])) as IntroRests;
    built = { open: pose(intro, OPEN), trail: pose(intro, TRAIL) };
  }
  return built;
}

/**
 * Flux's swim (`FLUX_BUNDLE.swim`). The two poses are built on first use (16 curve fits plus the
 * eight intro fits), not when the page loads: nothing here may delay the first frame. The intro arms
 * they are fitted to are shared and never changed.
 */
export const SWIM_POSES: SwimPoseSet = {
  get open() {
    return build().open;
  },
  get trail() {
    return build().trail;
  },
  stretch: FLUX_SWIM_STRETCH,
  bodyX: BODY_X,
};
