import { expect, test } from 'vitest';
import { ArmChain, restFromCurve } from '../character/armChain';
import { NOX } from '../config/nox.character';
import { ARM_IDS } from '../config/types';
import { NOX_POSES } from '../poses/nox.poses';
import { STAGE_FRAMES } from '../stage/framing';
import { ENTRANCE_MS, ENTRANCE_PANEL_MS, ENTRANCE_START_YAW, armFlare, coreGlowFacing, entrancePath, entranceStartX, mantleSqueeze } from './entrance';

const intro = NOX_POSES.intro.body;
const times = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
/** Half the width the stage frame shows: the narrowest any window shows. */
const FRAME_HALF = STAGE_FRAMES.entering.width / 2;

test('entrance starts off-left and ends at the intro transform', () => {
  const start = entrancePath(0);
  expect(start.x).toBeCloseTo(-3.4, 6);
  expect(start.yaw).toBeCloseTo(ENTRANCE_START_YAW, 6);
  // Out of sight: even the head's widest reach is past the frame's left edge.
  expect(start.x + NOX.head.halfWidth * start.scale).toBeLessThan(-FRAME_HALF);
  const end = entrancePath(ENTRANCE_MS);
  expect(end.x).toBeCloseTo(intro.x, 9);
  expect(end.y).toBeCloseTo(intro.y, 9);
  expect(end.scale).toBeCloseTo(intro.scale, 9);
  // Turned to face the visitor.
  expect(end.yaw).toBeCloseTo(0, 9);
  expect(end.pulse).toBe(0);
});

test('on a wider window the entrance starts further out, still out of sight, and passes panel 1 on time', () => {
  // A 16:9 window shows about 4.48 units either side of the centre.
  const from = entranceStartX(4.48);
  const start = entrancePath(0, from);
  expect(start.x).toBe(from);
  expect(start.x + NOX.head.halfWidth * start.scale).toBeLessThan(-4.48);
  expect(entranceStartX(FRAME_HALF)).toBeCloseTo(-3.4, 6);
  expect(entrancePath(ENTRANCE_PANEL_MS, from).x).toBeCloseTo(entrancePath(ENTRANCE_PANEL_MS).x, 6);
});

test('entrance x is monotonic', () => {
  for (const from of [entranceStartX(FRAME_HALF), entranceStartX(4.48), entranceStartX(7)]) {
    let last = -Infinity;
    for (const t of times(0, ENTRANCE_MS + 500, 2)) {
      const { x } = entrancePath(t, from);
      expect(x).toBeGreaterThanOrEqual(last);
      last = x;
    }
  }
});

test('entrance lasts 2.5 s', () => {
  expect(ENTRANCE_MS).toBe(2500);
  // Still turning to face the visitor just before the end, and still from then on.
  expect(entrancePath(ENTRANCE_MS - 100).yaw).toBeGreaterThan(0.01);
  expect(entrancePath(ENTRANCE_MS + 2000)).toEqual(entrancePath(ENTRANCE_MS));
});

test('a jet pulse every 0.8 s: the mantle squeezes by 6%, then Nox glides', () => {
  const peaks = [0, 800, 1600].map(at => Math.max(...times(at, at + 400, 5).map(t => entrancePath(t).pulse)));
  expect(peaks[0]).toBeCloseTo(1, 2);
  expect(peaks[1]).toBeCloseTo(1, 2);
  // The last, as Nox slows, is gentler.
  expect(peaks[2]).toBeGreaterThan(0.3);
  expect(peaks[2]).toBeLessThan(peaks[1]);
  for (const t of [650, 1450, 2300]) expect(entrancePath(t).pulse).toBe(0);
  expect(mantleSqueeze(1)).toBeCloseTo(0.94, 9);
  expect(mantleSqueeze(0)).toBe(1);
});

test('each pulse drives Nox forward: it speeds up just after the squeeze', () => {
  const speed = (t: number) => (entrancePath(t + 10).x - entrancePath(t - 10).x) / 20;
  for (const at of [800, 1600]) expect(speed(at + 200)).toBeGreaterThan(speed(at) * 1.5);
});

test('Nox swims in side-on and turns to face the visitor only as it slows', () => {
  expect(entrancePath(ENTRANCE_PANEL_MS).yaw).toBeCloseTo(ENTRANCE_START_YAW, 6);
  expect(entrancePath(1300).yaw).toBeCloseTo(ENTRANCE_START_YAW, 6);
  let last = Infinity;
  for (const t of times(1300, ENTRANCE_MS, 10)) {
    const { yaw } = entrancePath(t);
    expect(yaw).toBeLessThanOrEqual(last);
    last = yaw;
  }
});

test('the glow card before the chin fades as the head turns side-on, so it never shows edge-on', () => {
  expect(coreGlowFacing(0)).toBe(1);
  expect(coreGlowFacing(ENTRANCE_START_YAW)).toBeLessThan(0.05);
  let last = Infinity;
  for (const yaw of times(0, 1400, 10).map(m => (m / 1400) * ENTRANCE_START_YAW)) {
    const facing = coreGlowFacing(yaw);
    expect(facing).toBeLessThanOrEqual(last);
    last = facing;
  }
});

test('a pulse fans the bundled arms apart, upper arms up and lower arms down', () => {
  const tips = (pulse: number) =>
    ARM_IDS.map((id, i) => {
      const chain = new ArmChain(restFromCurve(NOX_POSES.entering.arms[id]), NOX.arms[i], i);
      chain.solve({ time: 0, sway: 0, curl: 0, droop: 0, flare: armFlare(id) * pulse });
      return chain.tipY;
    });
  const spread = (ys: number[]) => Math.max(...ys) - Math.min(...ys);
  const gathered = tips(0);
  const flared = tips(1);
  expect(spread(flared)).toBeGreaterThan(spread(gathered) + 0.3);
  ARM_IDS.forEach((id, i) => expect(Math.sign(flared[i] - gathered[i]), id).toBe(i < 4 ? 1 : -1));
});
