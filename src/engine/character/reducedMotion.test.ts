import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import { ArmChain, restFromCurve } from './armChain';
import type { Point2 } from '../config/types';

// Reduced motion (spec 7.8: "no float, drift or swim; pendants shown still"): everything that runs on time is scaled by `moving`.

const T1: Point2[] = [[-0.112, -1.02], [-0.72, -0.95], [-0.85, -0.77], [-0.93, -0.53], [-1.0, -0.33], [-1.07, -0.2], [-1.17, -0.15], [-1.25, -0.18], [-1.28, -0.27], [-1.23, -0.32], [-1.18, -0.3]];

test('with the sway and the tip curl at 0, an arm does not move however much time passes', () => {
  const chain = new ArmChain(restFromCurve(T1), NOX.arms.find(arm => arm.id === 'T1')!, 0);
  chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
  const [x, y] = [chain.tipX, chain.tipY];
  for (const time of [0.7, 3.1, 9.4, 40]) {
    chain.solve({ time, sway: 0, curl: 0, droop: 0 });
    expect(chain.tipX).toBeCloseTo(x, 9);
    expect(chain.tipY).toBeCloseTo(y, 9);
  }
});

test('with the tip curl on, the tip does move with time (so the wiring below matters)', () => {
  const chain = new ArmChain(restFromCurve(T1), NOX.arms.find(arm => arm.id === 'T1')!, 0);
  const tips: { x: number; y: number }[] = [];
  for (const time of [0, 2, 4, 6, 8, 10]) {
    chain.solve({ time, sway: 0, curl: NOX.personality.curl, droop: 0 });
    tips.push({ x: chain.tipX, y: chain.tipY });
  }
  const travel = Math.max(...tips.map(t => Math.hypot(t.x - tips[0].x, t.y - tips[0].y)));
  expect(travel).toBeGreaterThan(0.002);
});

test('the depth wave runs on depthTime: a constant clock holds the arm still in depth, the default is time (Nox unchanged)', () => {
  const make = () => new ArmChain(restFromCurve(T1), NOX.arms.find(arm => arm.id === 'T1')!, 0);
  const held = make();
  const plain = make();
  const zs: number[][] = [];
  for (const time of [0, 2, 4, 6]) {
    held.solve({ time, depthTime: 0, sway: 0, curl: 0, droop: 0 });
    plain.solve({ time, sway: 0, curl: 0, droop: 0 });
    zs.push([...held.pz]);
    if (time === 0) expect([...plain.pz]).toEqual([...held.pz]);
  }
  expect(zs[3]).toEqual(zs[0]);
  expect(Math.max(...plain.pz.map((z, k) => Math.abs(z - held.pz[k])))).toBeGreaterThan(0.005);
});

test("the character drives the arms' tip curl with `moving`, which reduced motion zeroes (Octopus.tsx)", () => {
  const octopus = readFileSync(new URL('./Octopus.tsx', import.meta.url), 'utf8');
  expect(octopus).toMatch(/const moving = reducedMotion \? 0 : live;/);
  expect(octopus).toMatch(/sway: moving \* personality\.sway/);
  expect(octopus).toMatch(/curl: moving \* personality\.curl/);
  expect(octopus).not.toMatch(/curl: live \* personality\.curl/);
  // The arms trail against the float's speed (`drift.vy`), and the float itself is scaled by `moving`: so is the trail.
  expect(octopus).toMatch(/depthTime: reducedMotion \? 0 : t,/);
  expect(octopus).toMatch(/const gazeHeld = freeze \|\| \(reducedMotion && !m\.pointerInside\);/);
  expect(octopus).toMatch(/const gaze = \(gazeHeld && !fixed && !rest\) \|\| stage === 'entering'/);
  expect(octopus).toMatch(/droop: drift\.vy \* moving \* 2\.2/);
  expect(octopus).not.toMatch(/droop: drift\.vy \* live/);
});
