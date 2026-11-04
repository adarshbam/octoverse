import { expect, test } from 'vitest';
import { blendAngles } from '../../engine/behavior/poseBlend';
import { ArmChain, restFromCurve } from '../../engine/character/armChain';
import { NOX } from '../config/nox.character';
import { ARM_IDS, type ArmId } from '../../engine/config/types';
import { NOX_POSES } from './nox.poses';
import { SWIM_POSES } from './nox.swim';
import type { StagePose } from '../../engine/poses/types';

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const rest = (pose: StagePose, id: ArmId) => restFromCurve(pose.arms[id]);
/** Which way the outer 40% of an arm turns: +1 counter-clockwise, -1 clockwise. */
function curlSign(pose: StagePose, id: ArmId) {
  const { angles } = rest(pose, id);
  let turn = 0;
  for (let k = Math.floor(angles.length * 0.6); k < angles.length - 1; k++) turn += wrap(angles[k + 1] - angles[k]);
  return Math.sign(turn);
}
/** The direction an arm leaves the body in: from its root to its middle, radians. */
function heading(pose: StagePose, id: ArmId) {
  const chain = new ArmChain(rest(pose, id), NOX.arms[ARM_IDS.indexOf(id)], ARM_IDS.indexOf(id));
  chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
  const mid = chain.segments / 2;
  return Math.atan2(chain.py[mid] - chain.py[0], chain.px[mid] - chain.px[0]);
}
const deg = (a: number) => (a * 180) / Math.PI;
const POSES = { open: SWIM_POSES.open, trail: SWIM_POSES.trail };

test('the swim keeps the anatomy: eight arms, each from its intro root at its intro length, curling the way it does in the intro', () => {
  for (const [name, pose] of Object.entries(POSES)) {
    expect(Object.keys(pose.arms).sort(), name).toEqual([...ARM_IDS]);
    ARM_IDS.forEach((id, i) => {
      const swim = rest(pose, id);
      const intro = rest(NOX_POSES.intro, id);
      expect(swim.rootX, `${name} ${id}`).toBeCloseTo(intro.rootX, 6);
      expect(swim.rootY, `${name} ${id}`).toBeCloseTo(intro.rootY, 6);
      expect(swim.segmentLength / intro.segmentLength, `${name} ${id}`).toBeCloseTo(1, 4);
      expect(curlSign(pose, id), `${name} ${id}`).toBe(curlSign(NOX_POSES.intro, id));
      // The cups stay on the side the intro lays them out on.
      expect(new ArmChain(swim, NOX.arms[i], i).side, `${name} ${id}`).toBe(new ArmChain(intro, NOX.arms[i], i).side);
    });
    expect(pose.expression, name).toBe('happy');
    expect(pose.headMorph, name).toBe(0);
    expect(pose.orbs, name).toBe(0);
    expect(pose.body, name).toEqual(NOX_POSES.intro.body);
  }
});

test('open spreads the arms round the body like an opening umbrella; trail gathers them in a loose bundle below it', () => {
  // Open: T1 to T8 go round from upper left, under the body, to upper right, evenly spaced, over 200 degrees or more.
  const open = ARM_IDS.map(id => deg(heading(SWIM_POSES.open, id)));
  const around = open.map(a => ((a - 90 + 360) % 360));
  for (let i = 1; i < around.length; i++) {
    expect(around[i] - around[i - 1], ARM_IDS[i]).toBeGreaterThan(22);
    expect(around[i] - around[i - 1], ARM_IDS[i]).toBeLessThan(50);
  }
  expect(around.at(-1)! - around[0]).toBeGreaterThan(200);
  // Trail: all eight leave downward, within 45 degrees of straight down, in order left to right.
  const trail = ARM_IDS.map(id => deg(heading(SWIM_POSES.trail, id)));
  for (const [i, a] of trail.entries()) expect(Math.abs(((a + 360) % 360) - 270), ARM_IDS[i]).toBeLessThan(45);
  for (let i = 1; i < trail.length; i++) expect(((trail[i] + 360) % 360), ARM_IDS[i]).toBeGreaterThan((trail[i - 1] + 360) % 360);
  // The bundle is under half as wide as the umbrella, which spans well beyond the head; it hangs below the body.
  const extent = (pose: StagePose) => {
    const xs = ARM_IDS.flatMap(id => pose.arms[id].map(([x]) => x));
    return Math.max(...xs) - Math.min(...xs);
  };
  expect(extent(SWIM_POSES.trail)).toBeLessThan(0.5 * extent(SWIM_POSES.open));
  expect(extent(SWIM_POSES.open)).toBeGreaterThan(2 * NOX.head.halfWidth + 1.5);
  for (const id of ARM_IDS) {
    const [, tipY] = SWIM_POSES.trail.arms[id].at(-1)!;
    expect(tipY, id).toBeLessThan(NOX.head.bottom - 0.4);
  }
});

test('blending between the swim poses and the intro never folds an arm', () => {
  // The blender turns each segment the short way round (poseBlend.blendAngles); if the short way
  // flipped between neighbouring segments, the arm would kink part-way through the blend. A flip
  // shows as a jump of nearly a full turn between neighbours; the intro's own tight tips differ from
  // a looser curl by up to about 0.75 rad a segment.
  const pairs: [string, StagePose, StagePose][] = [
    ['trail-open', SWIM_POSES.trail, SWIM_POSES.open],
    ['trail-intro', SWIM_POSES.trail, NOX_POSES.intro],
    ['open-intro', SWIM_POSES.open, NOX_POSES.intro],
  ];
  for (const [name, from, to] of pairs) {
    for (const id of ARM_IDS) {
      const a = rest(from, id).angles;
      const b = rest(to, id).angles;
      let prev = wrap(b[0] - a[0]);
      for (let k = 0; k < a.length; k++) {
        const d = wrap(b[k] - a[k]);
        expect(Math.abs(d), `${name} ${id} segment ${k}`).toBeLessThan(Math.PI - 0.25);
        expect(Math.abs(d - prev), `${name} ${id} segment ${k}`).toBeLessThan(1.5);
        prev = d;
      }
      // Half way the arm is a smooth curve: no joint turns more than either pose's sharpest.
      const mid = blendAngles(a, b, 0.5, new Float32Array(a.length));
      const sharpest = (angles: Float32Array) => Math.max(...Array.from(angles.slice(1), (v, k) => Math.abs(wrap(v - angles[k]))));
      expect(sharpest(mid), `${name} ${id}`).toBeLessThan(Math.max(sharpest(a), sharpest(b)) + 0.02);
    }
  }
});
