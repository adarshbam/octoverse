import { restFromCurve, type ArmRest } from '../character/armChain';
import { ARM_IDS, type ArmId, type Point2 } from '../config/types';
import { NOX_POSES } from './nox.poses';
import type { StagePose } from './types';

// The swim's two arm shapes (spec 9.5). A stroke blends from `trail` toward `open` as the arms
// open in recovery and back as they sweep in the power stroke (motion/stroke.ts), while the arm
// drive swings every arm back behind Nox (ArmDrive.pitch: 0.9 rad open, 1.3 swept back). Both are
// drawn in the space the arms are authored in, seen from the front before that swing.
//
// Each arm keeps its intro root and its intro length (no stretch: the anatomy is the approved one),
// and its tip curls the way it does in the intro, toward its cups. The curls stay well wound so
// that blending to and from the intro never turns any part of an arm more than about 150 degrees,
// where the blender's short way round would fold it.

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
  ...NOX_POSES.intro,
  arms: Object.fromEntries(ARM_IDS.map(id => [id, swimCurve(intro[id], arms[id])])) as Record<ArmId, Point2[]>,
  expression: 'happy',
});

/**
 * Open: an opening umbrella. The eight arms go round the body from the upper left, under it, to
 * the upper right, about 36 degrees apart, nearly straight, each bowing a little against its curl
 * so it reads as an S, and hooking at the tip.
 */
const OPEN: Record<ArmId, SwimArm> = {
  T1: { heading: 146, bend: -12, curl: 220 },
  T2: { heading: 182, bend: -12, curl: 215 },
  T3: { heading: 218, bend: -10, curl: 210 },
  T4: { heading: 253, bend: 10, curl: 260 },
  T5: { heading: 287, bend: -10, curl: 260 },
  T6: { heading: 322, bend: 10, curl: 210 },
  T7: { heading: 358, bend: 12, curl: 215 },
  T8: { heading: 34, bend: 12, curl: 220 },
};

/**
 * Trail: a loose bundle. The arms leave downward, side by side in their order round the body,
 * drawing in a little toward the middle, their tips curled. The rear arms (T1, T8) rise beside the
 * head in the intro, so they curl late here: blending between the two never swings their middle
 * more than about 150 degrees.
 */
const TRAIL: Record<ArmId, SwimArm> = {
  T1: { heading: 232, bend: 6, curl: 230, from: 0.7 },
  T2: { heading: 242, bend: 6, curl: 215 },
  T3: { heading: 253, bend: 5, curl: 210 },
  T4: { heading: 264, bend: 3, curl: 260 },
  T5: { heading: 276, bend: -3, curl: 260 },
  T6: { heading: 287, bend: -5, curl: 210 },
  T7: { heading: 298, bend: -6, curl: 215 },
  T8: { heading: 308, bend: -6, curl: 230, from: 0.7 },
};

let built: { open: StagePose; trail: StagePose } | null = null;
function build() {
  if (!built) {
    const intro = Object.fromEntries(ARM_IDS.map(id => [id, restFromCurve(NOX_POSES.intro.arms[id])])) as IntroRests;
    built = { open: pose(intro, OPEN), trail: pose(intro, TRAIL) };
  }
  return built;
}

/**
 * The swim's two poses. Built on first use (24 curve fits, about 15 ms), not when the page loads:
 * nothing here may delay the first frame.
 */
export const SWIM_POSES: { readonly open: StagePose; readonly trail: StagePose } = {
  get open() {
    return build().open;
  },
  get trail() {
    return build().trail;
  },
};
