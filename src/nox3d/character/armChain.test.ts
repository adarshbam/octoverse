import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import type { ArmId, Point2 } from '../config/types';
import { NOX_POSES } from '../poses/nox.poses';
import { ArmChain, armDepth, restFromCurve } from './armChain';

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

test('a reaching arm moves smoothly: its tip never jumps from one frame to the next', () => {
  const ids: ArmId[] = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'];
  for (const id of ids) {
    const index = NOX.arms.findIndex(arm => arm.id === id);
    const chain = new ArmChain(restFromCurve(NOX_POSES.intro.arms[id]), spec(id), index);
    chain.solve(still);
    const n = chain.segments;
    const [rx, ry] = [chain.px[0], chain.py[0]];
    const [tx, ty] = [chain.tipX, chain.tipY];
    const out = Math.hypot(tx - rx, ty - ry);
    // Pointer stops an arm reaches for (within 0.8 of its tip): past the tip, either side of it,
    // and back toward the body.
    const [ux, uy] = [(tx - rx) / out, (ty - ry) / out];
    const targets = [
      { x: tx + ux * 0.4, y: ty + uy * 0.4 },
      { x: tx - uy * 0.5, y: ty + ux * 0.5 },
      { x: tx + uy * 0.5, y: ty - ux * 0.5 },
      { x: tx - ux * 0.6, y: ty - uy * 0.6 },
    ];
    for (const target of targets) {
      const tips: [number, number][] = [];
      for (let f = 0; f < 240; f++) {
        chain.solve({ time: f / 60, sway: NOX.personality.sway, curl: NOX.personality.curl, droop: 0, bend: NOX.armBend, reach: { ...target, weight: 1 } });
        tips.push([chain.px[n], chain.py[n]]);
      }
      for (let f = 2; f < tips.length; f++) {
        const jolt = Math.hypot(tips[f][0] - 2 * tips[f - 1][0] + tips[f - 2][0], tips[f][1] - 2 * tips[f - 1][1] + tips[f - 2][1]);
        expect(jolt, `${id} toward (${target.x.toFixed(2)}, ${target.y.toFixed(2)}) frame ${f}`).toBeLessThan(0.006);
      }
    }
  }
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

test('arms fan out in depth from the body: centre arms come forward, top arms go back behind the head', () => {
  const at = (id: ArmId, u: number) => armDepth(u, spec(id));
  expect(at('T4', 1)).toBeGreaterThanOrEqual(0.4);
  expect(at('T4', 1)).toBeGreaterThan(at('T4', 0));
  expect(at('T3', 1)).toBeLessThan(at('T4', 1));
  expect(at('T2', 1)).toBeLessThan(at('T3', 1));
  expect(at('T1', 1)).toBeLessThan(at('T2', 1));
  expect(at('T1', 1)).toBeLessThanOrEqual(-0.5);
  // Most of the fan happens near the body, so the arms leave it already spread.
  expect(Math.abs(at('T1', 0.5) - at('T1', 0))).toBeGreaterThan(0.6 * Math.abs(at('T1', 1) - at('T1', 0)));
});

test('in motion each arm bends at several points along its length, not only near the tip', () => {
  for (const id of ['T2', 'T3', 'T6'] as ArmId[]) {
    const rest = restFromCurve(NOX_POSES.intro.arms[id]);
    const chain = new ArmChain(rest, spec(id), 1);
    const n = rest.angles.length;
    let multi = 0;
    let inner = 0;
    let outer = 0;
    const times = [0.7, 1.9, 3.1, 4.4, 5.6, 6.8];
    for (const time of times) {
      chain.solve({ ...still, time, sway: 0.5 });
      // Bending added by the motion, segment by segment.
      const bend: number[] = [];
      for (let k = 1; k < n; k++) {
        const a = Math.atan2(chain.py[k + 1] - chain.py[k], chain.px[k + 1] - chain.px[k]) - rest.angles[k];
        const b = Math.atan2(chain.py[k] - chain.py[k - 1], chain.px[k] - chain.px[k - 1]) - rest.angles[k - 1];
        bend.push(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
      }
      const span = bend.slice(Math.floor(0.1 * n), Math.floor(0.9 * n));
      let flips = 0;
      for (let i = 1; i < span.length; i++) if (Math.sign(span[i]) !== Math.sign(span[i - 1])) flips++;
      if (flips >= 2) multi++;
      const mean = (from: number, to: number) => bend.slice(Math.floor(from * n), Math.floor(to * n)).reduce((sum, v) => sum + Math.abs(v), 0) / ((to - from) * n);
      inner += mean(0.15, 0.5);
      outer += mean(0.5, 0.95);
    }
    expect(multi, `${id}: times with two or more bend points`).toBeGreaterThanOrEqual(times.length / 2);
    expect(inner / outer, `${id}: bending in the inner half against the outer half`).toBeGreaterThan(0.45);
  }
});

test('the motion bends arms visibly but keeps them in place', () => {
  const rest = restFromCurve(NOX_POSES.intro.arms.T2);
  const chain = new ArmChain(rest, spec('T2'), 1);
  let largest = 0;
  for (const time of [0.5, 1.5, 2.5, 3.5, 4.5]) {
    chain.solve({ ...still, time, sway: 0.5 });
    const end = rest.angles.length;
    let x = rest.rootX;
    let y = rest.rootY;
    for (let k = 0; k < end; k++) { x += rest.segmentLength * Math.cos(rest.angles[k]); y += rest.segmentLength * Math.sin(rest.angles[k]); }
    largest = Math.max(largest, Math.hypot(chain.tipX - x, chain.tipY - y));
  }
  expect(largest).toBeGreaterThan(0.05);
  expect(largest).toBeLessThan(0.45);
});

test('a rest bend gives each arm gentle undulations along its length while keeping it close to its rest', () => {
  for (const id of ['T2', 'T3', 'T6', 'T7'] as ArmId[]) {
    const rest = restFromCurve(NOX_POSES.intro.arms[id]);
    const plain = new ArmChain(rest, spec(id), 1);
    plain.solve(still);
    const bent = new ArmChain(rest, spec(id), 1);
    bent.solve({ ...still, bend: 0.15 });
    const n = rest.angles.length;
    const bend: number[] = [];
    for (let k = 1; k < n; k++) {
      const a = Math.atan2(bent.py[k + 1] - bent.py[k], bent.px[k + 1] - bent.px[k]) - rest.angles[k];
      const b = Math.atan2(bent.py[k] - bent.py[k - 1], bent.px[k] - bent.px[k - 1]) - rest.angles[k - 1];
      bend.push(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    }
    const span = bend.slice(Math.floor(0.1 * n), Math.floor(0.85 * n));
    let flips = 0;
    for (let i = 1; i < span.length; i++) if (Math.sign(span[i]) !== Math.sign(span[i - 1]) && Math.abs(span[i]) > 1e-4) flips++;
    expect(flips, `${id}: bend points`).toBeGreaterThanOrEqual(2);
    let furthest = 0;
    for (let k = 0; k <= n; k++) furthest = Math.max(furthest, Math.hypot(bent.px[k] - plain.px[k], bent.py[k] - plain.py[k]));
    expect(furthest, `${id}: drift`).toBeGreaterThan(0.01);
    expect(furthest, `${id}: drift`).toBeLessThan(0.07);
  }
});

test('idle drift is not synchronised: each arm sways at its own pace', () => {
  const rates = NOX.arms.map((arm, i) => new ArmChain(restFromCurve(NOX_POSES.intro.arms[arm.id]), arm, i).driftRate);
  const sorted = [...rates].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThan(0.02);
  expect(sorted.at(-1)! / sorted[0]).toBeGreaterThan(1.25);
});
