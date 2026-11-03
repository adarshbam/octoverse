import { expect, test } from 'vitest';
import { ArmChain, restFromCurve } from '../character/armChain';
import { NOX } from '../config/nox.character';
import { ARM_IDS } from '../config/types';
import { BODY_X, NOX_POSES } from '../poses/nox.poses';
import { startle } from './micro';
import { SETTLE_IDLE, type SettleTrack, arrivalDue, inwardSign, settleStep, startleDue, trailSpeed } from './microTriggers';

const MICRO = NOX.personality.micro;
const S = MICRO.startle;
/** A dart that should startle: fast, crossing into `near` this frame, cooldown long past, in the intro. */
const DART = { moving: 1, stage: 'intro' as const, near: S.near + 0.1, nearBefore: S.near - 0.1, speed: S.speed * 2, since: Infinity };

test('the startle starts on the edge into the face, fast, after the cooldown, and never frozen', () => {
  expect(startleDue(DART, MICRO)).toBe(true);
  expect(startleDue({ ...DART, stage: 'overview' }, MICRO)).toBe(true);
  // Lingering near the face (already near last frame) is no edge.
  expect(startleDue({ ...DART, nearBefore: S.near }, MICRO)).toBe(false);
  // Not near enough, or too slow.
  expect(startleDue({ ...DART, near: S.near - 0.01 }, MICRO)).toBe(false);
  expect(startleDue({ ...DART, speed: S.speed - 0.01 }, MICRO)).toBe(false);
  // Inside the cooldown no second startle; at it, one may start.
  expect(startleDue({ ...DART, since: S.cooldown - 0.01 }, MICRO)).toBe(false);
  expect(startleDue({ ...DART, since: S.cooldown }, MICRO)).toBe(true);
  // Not while swimming in, in the detail panel or a technology focus.
  for (const stage of ['entering', 'detail', 'techFocus'] as const) expect(startleDue({ ...DART, stage }, MICRO), stage).toBe(false);
  // ?freeze and reduced motion: moving is 0.
  expect(startleDue({ ...DART, moving: 0 }, MICRO)).toBe(false);
});

test('a frame-by-frame dart startles once, then not again within the cooldown', () => {
  let since = Infinity;
  let nearBefore = 0;
  const starts: number[] = [];
  const dt = 1 / 60;
  // The pointer darts in at 0.5 s, leaves at 1 s, darts in again at 1.5 s and again at 4 s.
  const nearAt = (t: number) => ((t >= 0.5 && t < 1) || (t >= 1.5 && t < 2) || t >= 4 ? 0.9 : 0);
  for (let t = 0; t < 6; t += dt) {
    since += dt;
    const near = nearAt(t);
    if (startleDue({ moving: 1, stage: 'intro', near, nearBefore, speed: 10, since }, MICRO)) {
      starts.push(t);
      since = 0;
    }
    nearBefore = near;
  }
  expect(starts.length).toBe(2);
  expect(starts[0]).toBeCloseTo(0.5, 1);
  expect(starts[1]).toBeCloseTo(4, 1);
});

test('the arrival wiggle fires once after an entrance that ran its course, never after a skip or frozen', () => {
  const frames = (entranceDone: boolean, moving: number) => {
    let arrived = false;
    let fired = 0;
    const stages = ['entering', 'entering', 'intro', 'intro', 'intro', 'overview', 'intro'] as const;
    for (const stage of stages) {
      if (arrivalDue({ moving, stage, arrived, entranceDone })) {
        fired++;
        arrived = true;
      }
    }
    return fired;
  };
  expect(frames(true, 1)).toBe(1);
  expect(frames(false, 1)).toBe(0);
  expect(frames(true, 0)).toBe(0);
  // Never while the entrance is still on stage.
  expect(arrivalDue({ moving: 1, stage: 'entering', arrived: false, entranceDone: true })).toBe(false);
});

test('a stage move lands once, even when the pose eases in for ever; a skip and a frozen move do not', () => {
  const run = (steps: readonly (readonly [number, number])[], moving = 1, swimming = false) => {
    let track: SettleTrack = SETTLE_IDLE;
    const landings: { at: number; x: number; y: number }[] = [];
    steps.forEach(([dx, dy], i) => {
      track = settleStep(track, dx, dy, moving, swimming);
      if (track.landed) landings.push({ at: i, ...track.landed });
    });
    return landings;
  };
  // A smootherstep move of 0.5 right over 60 frames, then still.
  const smooth = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);
  const move = Array.from({ length: 80 }, (_, i) => [0.5 * (smooth(Math.min(1, (i + 1) / 60)) - smooth(Math.min(1, i / 60))), 0] as const);
  const landed = run(move);
  expect(landed.length).toBe(1);
  expect(landed[0].x).toBeCloseTo(1, 6);
  expect(landed[0].at).toBeGreaterThanOrEqual(55);
  expect(landed[0].at).toBeLessThanOrEqual(61);
  // A pose that converges asymptotically (each step 90% of the last), never exactly still.
  const asymptotic = Array.from({ length: 300 }, (_, i) => [0, -0.05 * 0.9 ** i] as const);
  const eased = run(asymptotic);
  expect(eased.length).toBe(1);
  expect(eased[0].y).toBeCloseTo(-1, 6);
  // A skip: the whole move in one frame.
  expect(run([[0.5, 0], [0, 0], [0, 0]]).length).toBe(0);
  // Frozen or reduced motion, or swimming: no overshoot.
  expect(run(move, 0).length).toBe(0);
  expect(run(move, 1, true).length).toBe(0);
  // Still: the track is left as it is (no allocation each frame).
  expect(settleStep(SETTLE_IDLE, 0, 0, 1, false)).toBe(SETTLE_IDLE);
});

test("the arms' trail never spikes: zero when frozen, clamped when motion resumes mid-startle", () => {
  expect(trailSpeed(0.05, 0, 1 / 60, 0)).toBe(0);
  expect(trailSpeed(0.05, 0, 0, 1)).toBe(0);
  // Reduced motion switched off mid-startle: the lift reappears at once; the trail stays bounded.
  expect(Math.abs(trailSpeed(0.05, 0, 1 / 60, 1))).toBeLessThanOrEqual(1);
  // An ordinary startle frame is not clamped: its fastest frame stays under the cap.
  let fastest = 0;
  for (let t = 1 / 60; t < S.duration; t += 1 / 60) fastest = Math.max(fastest, Math.abs((startle(t, MICRO).lift - startle(t - 1 / 60, MICRO).lift) * 60));
  expect(fastest).toBeLessThan(1);
});

test('the startle draws every intro arm in toward the body; the arrival wiggle fans it out', () => {
  // The body's middle in the space the arms are authored in (Octopus: BODY_X, PIVOT_Y).
  const [cx, cy] = [BODY_X, -0.6];
  const still = { time: 0, sway: 0, curl: 0, droop: 0 };
  const reach = (chain: ArmChain) => Math.hypot(chain.tipX - cx, chain.tipY - cy);
  ARM_IDS.forEach((id, i) => {
    const spec = NOX.arms[i];
    const chain = new ArmChain(restFromCurve(NOX_POSES.intro.arms[id]), spec, i);
    chain.solve(still);
    const rest = reach(chain);
    const sign = inwardSign(cx, cy, chain.px[0], chain.py[0], chain.tipX, chain.tipY);
    expect(sign, id).not.toBe(0);
    chain.solve({ ...still, flare: sign * MICRO.startle.armsIn });
    const drawnIn = reach(chain);
    chain.solve({ ...still, flare: -sign * MICRO.arrival.armWave });
    const fanned = reach(chain);
    expect(drawnIn, id).toBeLessThan(rest);
    expect(fanned, id).toBeGreaterThan(rest);
  });
});
