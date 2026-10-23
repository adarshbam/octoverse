import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import type { ArmId, Point2 } from '../config/types';
import { NOX_POSES } from '../poses/nox.poses';
import { ArmChain, restFromCurve } from './armChain';

// Intro curves of T1 and T8 from the spike (src/spike/nox/armPoses.ts), hidden root included.
const T1: Point2[] = [[-0.112, -1.02], [-0.72, -0.95], [-0.85, -0.77], [-0.93, -0.53], [-1.0, -0.33], [-1.07, -0.2], [-1.17, -0.15], [-1.25, -0.18], [-1.28, -0.27], [-1.23, -0.32], [-1.18, -0.3]];
const T8: Point2[] = [[0.186, -1.02], [0.77, -0.95], [0.88, -0.75], [0.97, -0.57], [1.0, -0.42], [1.04, -0.33], [1.1, -0.3], [1.19, -0.31], [1.26, -0.38], [1.26, -0.45], [1.21, -0.48], [1.17, -0.44]];
const spec = (id: ArmId) => NOX.arms.find(arm => arm.id === id)!;
const still = { time: 0, sway: 0, curl: 0, droop: 0 };

test('zero drive reproduces the rest curve tip', () => {
  const chain = new ArmChain(restFromCurve(T1), spec('T1'), 0);
  chain.solve(still);
  expect(Math.hypot(chain.tipX - T1.at(-1)![0], chain.tipY - T1.at(-1)![1])).toBeLessThan(0.01);
});

test('segment lengths are preserved under motion', () => {
  const rest = restFromCurve(T1);
  const chain = new ArmChain(rest, spec('T1'), 0);
  chain.solve({ time: 3.7, sway: 0.5, curl: 1.1, droop: 0.3 });
  for (let k = 0; k < rest.angles.length; k++) {
    const length = Math.hypot(chain.px[k + 1] - chain.px[k], chain.py[k + 1] - chain.py[k]);
    expect(Math.abs(length - rest.segmentLength)).toBeLessThan(1e-5);
  }
});

test('sucker side follows the tip curl: T1 curls counter-clockwise, T8 clockwise', () => {
  expect(new ArmChain(restFromCurve(T1), spec('T1'), 0).side).toBe(1);
  expect(new ArmChain(restFromCurve(T8), spec('T8'), 7).side).toBe(-1);
});

test('the centre arms carry their suckers on the edges that face each other', () => {
  const [t4, t5] = (['T4', 'T5'] as const).map((id, i) => new ArmChain(restFromCurve(NOX_POSES.intro.arms[id]), spec(id), 3 + i));
  const k = 16;
  for (const [arm, other] of [[t4, t5], [t5, t4]]) {
    const tx = arm.px[k + 1] - arm.px[k - 1];
    const ty = arm.py[k + 1] - arm.py[k - 1];
    // Suckers sit on `side` times the left normal (-ty, tx).
    const towardOther = (other.px[k] - arm.px[k]) * -ty + (other.py[k] - arm.py[k]) * tx;
    expect(arm.side * towardOther).toBeGreaterThan(0);
  }
});

test('reach brings the tip closer to the target', () => {
  const chain = new ArmChain(restFromCurve(T1), spec('T1'), 0);
  chain.solve(still);
  const target = { x: chain.tipX + 0.3, y: chain.tipY + 0.3 };
  const before = Math.hypot(target.x - chain.tipX, target.y - chain.tipY);
  chain.solve({ ...still, reach: { ...target, weight: 1 } });
  expect(Math.hypot(target.x - chain.tipX, target.y - chain.tipY)).toBeLessThan(before * 0.5);
});

test('root never moves under reach', () => {
  const rest = restFromCurve(T1);
  const chain = new ArmChain(rest, spec('T1'), 0);
  chain.solve({ time: 2, sway: 0.5, curl: 1.1, droop: 0, reach: { x: -2, y: 1, weight: 1 } });
  // Positions are Float32; compare at float precision.
  expect([chain.px[0], chain.py[0]]).toEqual([Math.fround(rest.rootX), Math.fround(rest.rootY)]);
});

test('pointAt runs from the root at 0 to the tip at 1', () => {
  const chain = new ArmChain(restFromCurve(T8), spec('T8'), 7);
  chain.solve(still);
  const p = { x: 0, y: 0, z: 0 };
  chain.pointAt(0, p);
  expect(p.x).toBeCloseTo(chain.px[0], 6);
  chain.pointAt(1, p);
  expect([p.x, p.y]).toEqual([chain.tipX, chain.tipY]);
});

test('segment count follows the rest', () => {
  expect(new ArmChain(restFromCurve(T1, 32), spec('T1'), 0).px).toHaveLength(33);
});
