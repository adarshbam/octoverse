import { expect, test } from 'vitest';
import { settledArms } from '../behavior/poseBlend';
import { ArmChain } from '../character/armChain';
import { ARM_IDS } from '../config/types';
import { NOX_POSES } from '../poses/nox.poses';
import { SWIM_POSES } from '../poses/nox.swim';
import { SWIM_PITCH, strokeAt, swimDrive } from './stroke';
import { NOX } from '../config/nox.character';
import { TRAIL_PITCH, createSwimRests, settleWeight, swimArmPitch, swimRests } from './swimArms';

const SEGMENTS = ArmChain.SEGMENTS;
const shapes = () => ({ trail: settledArms(SWIM_POSES.trail, SEGMENTS), open: settledArms(SWIM_POSES.open, SEGMENTS), rest: settledArms(NOX_POSES.intro, SEGMENTS) });
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

test('settled, the arms are the intro pose exactly, wherever the stroke stopped', () => {
  const s = shapes();
  for (const clock of [0, 0.3, 0.45, 0.6, 2.95]) {
    const out = swimRests(s, strokeAt(clock, NOX.personality.swim), 1, createSwimRests(SEGMENTS));
    for (const id of ARM_IDS) {
      expect(out[id].rootX).toBe(s.rest[id].rootX);
      expect(out[id].segmentLength).toBe(s.rest[id].segmentLength);
      expect(Array.from(out[id].angles)).toEqual(Array.from(s.rest[id].angles));
    }
  }
});

test('swimming, the arms are the trail swept back and the open umbrella opened', () => {
  const s = shapes();
  const trail = swimRests(s, { spread: 0, sweep: 1 }, 0, createSwimRests(SEGMENTS));
  const open = swimRests(s, { spread: 1, sweep: 0 }, 0, createSwimRests(SEGMENTS));
  for (const id of ARM_IDS) {
    expect(Array.from(trail[id].angles)).toEqual(Array.from(s.trail[id].angles));
    expect(Array.from(open[id].angles)).toEqual(Array.from(s.open[id].angles));
  }
});

test('the settle overshoots the intro pose a little, then lands', () => {
  expect(settleWeight(0)).toBe(0);
  expect(settleWeight(1)).toBe(1);
  const peak = Math.max(...Array.from({ length: 101 }, (_, i) => settleWeight(i / 100)));
  expect(peak).toBeGreaterThan(1.03);
  expect(peak).toBeLessThan(1.06);
  // Through the overshoot the arms run past the intro pose, opening a little wider than it.
  const s = shapes();
  const out = swimRests(s, { spread: 0, sweep: 1 }, 0.9, createSwimRests(SEGMENTS));
  const id = 'T1';
  let past = 0;
  for (let k = 0; k < SEGMENTS; k++) past += wrap(out[id].angles[k] - s.rest[id].angles[k]) * wrap(s.rest[id].angles[k] - s.trail[id].angles[k]);
  expect(past).toBeGreaterThan(0);
});

test('every arm moves smoothly through a whole entrance of strokes and the settle', () => {
  const s = shapes();
  const timing = NOX.personality.swim;
  let prev = swimRests(s, strokeAt(0, timing), 0, createSwimRests(SEGMENTS));
  // A stroke clock and settle as the entrance runs them: 3 strokes, then the settle.
  const steps = 2000;
  let worst = 0;
  for (let i = 1; i <= steps; i++) {
    const u = i / steps;
    const settle = Math.max(0, (u - 0.8) / 0.2);
    const next = swimRests(s, strokeAt(Math.min(u / 0.8, 1) * 3, timing), settle, createSwimRests(SEGMENTS));
    for (const id of ARM_IDS) for (let k = 0; k < SEGMENTS; k++) worst = Math.max(worst, Math.abs(wrap(next[id].angles[k] - prev[id].angles[k])));
    prev = next;
  }
  // 2000 steps over a 6.5 s entrance is 3 ms a step; no joint turns more than about 6 degrees in it.
  expect(worst).toBeLessThan(0.1);
});

test('the trailing bundle and the body lean add up to TRAIL_PITCH; landed, no swing', () => {
  expect(TRAIL_PITCH).toBeCloseTo(1.05, 6);
  const trailing = swimDrive({ sweep: 1, straighten: 0 }, 0).pitch;
  expect(trailing).toBeCloseTo(SWIM_PITCH.base + SWIM_PITCH.sweep, 9);
  for (const lean of [0, 0.2, 0.45]) expect(swimArmPitch(trailing, lean) + lean).toBeCloseTo(TRAIL_PITCH, 9);
  // Opened (sweep 0), the arms swing back less than the bundle does.
  expect(swimArmPitch(swimDrive({ sweep: 0, straighten: 0 }, 0).pitch, 0.45)).toBeLessThan(swimArmPitch(trailing, 0.45));
  expect(swimArmPitch(swimDrive({ sweep: 1, straighten: 1 }, 1).pitch, 0.45)).toBe(0);
});
