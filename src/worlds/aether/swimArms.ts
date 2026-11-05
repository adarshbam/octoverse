import { restFromCurve, type ArmRest } from '../../engine/character/armChain';
import { ARM_IDS, type ArmId, type Point2 } from '../../engine/config/types';

// Aether's swim arm shapes (spec 7.4, 7.9; Task 17), read from P1 (public/aether/ref/p1.png, her
// entrance). P1 shows her three-quarter from the side, facing right, head leading, her arms released
// behind her in long ribbons that stream back and a little down, each rippling in a long wave of
// about one and a half bows along its length, the waves of neighbouring arms out of step, the tips
// rolled in small curls. As with Veyra's (worlds/veyra/swim.ts), the swim poses are not that side
// view: they are arm shapes in the plane the arms are authored in (seen from the front), which the
// stage swings back behind her as the stroke has it (ArmDrive.pitch). So P1 is carried as shapes:
//  - `open` is the arms released round her like an opening bell, the jellyfish's pulse (spec 7.8):
//    wide and soft, each with a long shallow wave, the tips curling;
//  - `trail` is the bundle that streams behind her in the glide: the arms side by side leaving down
//    in a loose fan, each in a long wave (P1's ribbons), neighbours rippling the opposite way.
// Each arm keeps its intro root and its intro length and curls its tip the way the intro does, so
// blending to and from the intro never turns any part of an arm more than about 150 degrees, where
// the blender's short way round would fold it (swim.test.ts checks it).
// This file imports neither the poses nor the swim set: poses.ts (the `entering` pose) and swim.ts
// (the swim set) both build from it, so neither imports the other.

/**
 * One arm of a swim pose, in degrees: the way it leaves the body (counter-clockwise from +x), the
 * size of its wave (the largest swing of its heading either side, positive bowing counter-clockwise
 * first), and the curl of its tip, wound as the intro's, starting `from` along the arm.
 */
export interface SwimArm {
  heading: number;
  wave: number;
  curl: number;
  from?: number;
}

/** Points along each generated curve: plenty for the arm's spline to follow it. */
const POINTS = 32;
/** Where the tip curl begins, as a fraction along the arm; it winds tighter toward the tip. */
const CURL_FROM = 0.68;
const CURL_POWER = 1.7;
/**
 * The wave: one and a half bows along the arm (P1's ribbons), growing from nothing at the root to
 * full by a third of the way out, so the arm leaves the body cleanly and ripples down its length.
 */
const WAVE_BOWS = 1.5;
const WAVE_IN = 0.33;

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

/** An arm's curve from its intro root, `arm`'s heading, wave and curl, at its intro length. */
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
    // The heading swings as a sine along the arm: so the arm's line is a wave (each bow's turn back
    // is its own), fading out into the tip's curl.
    const wave = arm.wave * smoothstep(0, WAVE_IN, s) * Math.sin(2 * Math.PI * WAVE_BOWS * s) * (1 - curl);
    const heading = rad(arm.heading + wave + wind * Math.abs(arm.curl) * curl);
    x += step * Math.cos(heading);
    y += step * Math.sin(heading);
    points.push([x, y]);
  }
  // The arm's spline runs a touch shorter than the polyline: scale it about the root to the intro length.
  const k = length / (restFromCurve(points).segmentLength * root.angles.length);
  return points.map(([px, py]) => [root.rootX + (px - root.rootX) * k, root.rootY + (py - root.rootY) * k] as Point2);
}

/**
 * Open: released, a bell opening round her. The eight arms go round the body from the upper left,
 * under it, to the upper right, about 34 degrees apart, each in a long shallow wave, the tips curling.
 */
export const OPEN: Record<ArmId, SwimArm> = {
  T1: { heading: 150, wave: 10, curl: 225 },
  T2: { heading: 184, wave: -10, curl: 300 },
  T3: { heading: 218, wave: 10, curl: 255 },
  T4: { heading: 252, wave: -8, curl: 165 },
  T5: { heading: 288, wave: 8, curl: 240 },
  T6: { heading: 322, wave: -10, curl: 300 },
  T7: { heading: 356, wave: 10, curl: 330 },
  T8: { heading: 30, wave: -10, curl: 255 },
};

/**
 * Trail: the ribbons streaming behind her. They leave downward, side by side in their order round
 * the body in a loose fan, each in a long wave (P1), each rippling the opposite way to its
 * neighbour. The rear arms (T1, T8) rise beside the head in the intro, so they curl late here, which
 * keeps the blend from swinging their middle past about 150 degrees.
 */
export const TRAIL: Record<ArmId, SwimArm> = {
  T1: { heading: 242, wave: 16, curl: 150, from: 0.74 },
  T2: { heading: 249, wave: -18, curl: 300 },
  T3: { heading: 256, wave: 18, curl: 225 },
  T4: { heading: 264, wave: -14, curl: 200 },
  T5: { heading: 276, wave: 14, curl: 240 },
  T6: { heading: 284, wave: -18, curl: 255 },
  T7: { heading: 291, wave: 18, curl: 270 },
  T8: { heading: 298, wave: -16, curl: 165, from: 0.74 },
};

/** The arms stretch out a little as she swims, less than Nox's fifth (her ribbons glide, they do not strain). */
export const AETHER_SWIM_STRETCH = 1.12;

const built = new WeakMap<object, { open: Record<ArmId, Point2[]>; trail: Record<ArmId, Point2[]> }>();

/**
 * The open and trail arms for these intro arms, built on first use (16 curve fits) and kept: the
 * intro arms they are fitted to are shared and never changed.
 */
export function swimArms(intro: Readonly<Record<ArmId, readonly Point2[]>>) {
  let arms = built.get(intro);
  if (!arms) {
    const rests = Object.fromEntries(ARM_IDS.map(id => [id, restFromCurve(intro[id])])) as Record<ArmId, ArmRest>;
    const make = (shape: Record<ArmId, SwimArm>) => Object.fromEntries(ARM_IDS.map(id => [id, swimCurve(rests[id], shape[id])])) as Record<ArmId, Point2[]>;
    arms = { open: make(OPEN), trail: make(TRAIL) };
    built.set(intro, arms);
  }
  return arms;
}
