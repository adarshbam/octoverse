import { expect, test } from 'vitest';
import { ARM_IDS, type ArmId, type Point2 } from '../config/types';
import { NOX_POSES } from '../../worlds/nox/poses';
import type { StagePose } from '../poses/types';
import { EXPRESSIONS } from './expressions';
import { PoseBlender, STAGE_TRANSITION, blendAngles, settledArms } from './poseBlend';

/** The intro pose with every arm curve shifted and the body moved, as a distinct stage. */
function shifted(dx: number, dy: number, expression: StagePose['expression'] = 'happy'): StagePose {
  const intro = NOX_POSES.intro;
  const arms = Object.fromEntries(ARM_IDS.map(id => [id, intro.arms[id].map(([x, y], i) => [x + dx * i * 0.1, y + dy * i * 0.1] as Point2)])) as Record<ArmId, Point2[]>;
  return { arms, body: { x: dx, y: dy, scale: 1.1, yaw: 0.3 }, expression, headMorph: 1, orbs: 1 };
}

test('blendAngles takes the short way across ±π', () => {
  const out = new Float32Array(1);
  blendAngles(Float32Array.of(Math.PI - 0.1), Float32Array.of(-Math.PI + 0.1), 0.5, out);
  expect(Math.abs(out[0])).toBeGreaterThan(3.1);
});

test('retargeting mid-blend is continuous', () => {
  const blender = new PoseBlender(NOX_POSES.intro);
  blender.start(shifted(0.5, 0.2), 0);
  const before = blender.sample(350);
  blender.start(shifted(-0.4, -0.3, 'focused'), 350);
  const after = blender.sample(351);
  for (const id of ARM_IDS) {
    const a = before.arms[id].angles;
    const b = after.arms[id].angles;
    for (let k = 0; k < a.length; k++) {
      const d = Math.atan2(Math.sin(b[k] - a[k]), Math.cos(b[k] - a[k]));
      expect(Math.abs(d), `${id} joint ${k}`).toBeLessThan(0.01);
    }
  }
  expect(Math.abs(after.body.x - before.body.x)).toBeLessThan(0.01);
});

test('blend reaches the target exactly at the end', () => {
  const blender = new PoseBlender(NOX_POSES.intro);
  const target = shifted(0.5, 0.2);
  blender.start(target, 0);
  const end = blender.sample(700 + 8 * 40);
  const exact = new PoseBlender(target).sample(0);
  for (const id of ARM_IDS) {
    expect(Array.from(end.arms[id].angles)).toEqual(Array.from(exact.arms[id].angles));
    expect(end.arms[id].rootX).toBe(exact.arms[id].rootX);
    expect(end.arms[id].segmentLength).toBe(exact.arms[id].segmentLength);
  }
  expect(end.body).toEqual(target.body);
  expect(end.expression).toEqual(EXPRESSIONS.happy);
  expect(end.headMorph).toBe(1);
});

test('arms start one after another, each a stagger later', () => {
  const blender = new PoseBlender(NOX_POSES.intro);
  blender.start(shifted(0.5, 0.2), 0);
  const early = blender.sample(39);
  const start = new PoseBlender(NOX_POSES.intro).sample(0);
  expect(Array.from(early.arms.T2.angles)).toEqual(Array.from(start.arms.T2.angles));
  expect(Array.from(early.arms.T1.angles)).not.toEqual(Array.from(start.arms.T1.angles));
});

test('a zero duration (reduced motion) lands on the target at once', () => {
  const blender = new PoseBlender(NOX_POSES.intro);
  const target = shifted(0.5, 0.2);
  blender.start(target, 100, 0, 0);
  expect(blender.sample(100).body).toEqual(target.body);
});

// The tip curls turn by up to ~2.5 rad between stages; at the old 0.7 s a joint swung 0.14 rad in a frame.
test('a stage change is slow and gentle: no joint turns more than 0.06 rad in a 60 fps frame', () => {
  const blender = new PoseBlender(NOX_POSES.intro);
  blender.start(NOX_POSES.overview, 0, STAGE_TRANSITION.durationMs, STAGE_TRANSITION.staggerMs);
  let before = ARM_IDS.map(id => Float32Array.from(blender.sample(0).arms[id].angles));
  const end = STAGE_TRANSITION.durationMs + 8 * STAGE_TRANSITION.staggerMs;
  for (let t = 1000 / 60; t <= end + 20; t += 1000 / 60) {
    const now = ARM_IDS.map(id => Float32Array.from(blender.sample(t).arms[id].angles));
    now.forEach((angles, a) => angles.forEach((v, k) => {
      const d = Math.atan2(Math.sin(v - before[a][k]), Math.cos(v - before[a][k]));
      expect(Math.abs(d), `${ARM_IDS[a]} joint ${k} at ${t.toFixed(0)} ms`).toBeLessThan(0.06);
    }));
    before = now;
  }
}, 15_000);

test('whether the orbs are out blends with the pose', () => {
  const blender = new PoseBlender(NOX_POSES.intro);
  expect(blender.sample(0).orbs).toBe(0);
  blender.start(NOX_POSES.overview, 0, 1000, 0);
  expect(blender.sample(500).orbs).toBeCloseTo(0.5, 6);
  expect(blender.sample(1000).orbs).toBe(1);
});

test('the head tilt blends with the pose', () => {
  const blender = new PoseBlender(NOX_POSES.intro);
  expect(blender.sample(0).tilt).toBe(0);
  blender.start({ ...NOX_POSES.intro, tilt: 0.2 }, 0, 1000, 0);
  expect(blender.sample(500).tilt).toBeCloseTo(0.1, 6);
  expect(blender.sample(1000).tilt).toBe(0.2);
});

test("where the eyes rest is the new pose's from the start of a change", () => {
  const blender = new PoseBlender(NOX_POSES.intro);
  expect(blender.sample(0).look).toBeUndefined();
  blender.start({ ...NOX_POSES.intro, look: [1, 0.5] }, 0, 1000, 0);
  expect(blender.sample(1).look).toEqual([1, 0.5]);
  blender.start(NOX_POSES.intro, 1000, 1000, 0);
  expect(blender.sample(1001).look).toBeUndefined();
});

test('a delayed start holds the current pose until its beat, then blends', () => {
  const blender = new PoseBlender(NOX_POSES.intro);
  const target = shifted(0.5, 0.2);
  blender.start(target, 0, 1000, 0, 200);
  expect(blender.sample(150).body).toEqual(NOX_POSES.intro.body);
  const mid = blender.sample(700).body.x;
  expect(mid).toBeGreaterThan(0);
  expect(mid).toBeLessThan(0.5);
  expect(blender.sample(1200).body).toEqual(target.body);
});

test('starting the same pose again reuses its arms, worked out once', () => {
  const blender = new PoseBlender(NOX_POSES.intro);
  blender.start(NOX_POSES.overview, 0, 100, 0);
  const first = blender.sample(200).arms.T1.angles.slice();
  blender.start(NOX_POSES.intro, 200, 100, 0);
  blender.start(NOX_POSES.overview, 400, 100, 0);
  expect(Array.from(blender.sample(600).arms.T1.angles)).toEqual(Array.from(first));
  expect(settledArms(NOX_POSES.overview, 128)).toBe(settledArms(NOX_POSES.overview, 128));
});

test('the arms can be laid out in another pose than the one the blender starts in', () => {
  // The entrance lays the arms out (cup sides and spacing) in the intro pose Nox swims into.
  const blender = new PoseBlender(NOX_POSES.entering, 32, NOX_POSES.intro);
  expect(blender.layout).toBe(settledArms(NOX_POSES.intro, 32));
  expect(blender.sample(0).arms.T2.segmentLength).toBeCloseTo(settledArms(NOX_POSES.entering, 32).T2.segmentLength, 9);
  // By default they are laid out in the pose it starts in.
  expect(new PoseBlender(NOX_POSES.overview, 32).layout).toBe(settledArms(NOX_POSES.overview, 32));
});
