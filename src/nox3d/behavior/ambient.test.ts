import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { BlinkScheduler, floatOffset, spring } from './ambient';
import { Attention } from './attention';

/** Deterministic generator for repeatable blink timing. */
const seeded = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function blinkStarts(scheduler: BlinkScheduler, from: number, to: number, step = 0.001) {
  const starts: number[] = [];
  let was = false;
  for (let t = from; t <= to; t += step) {
    const closed = scheduler.sample(t) > 0;
    if (closed && !was) starts.push(t);
    was = closed;
  }
  return starts;
}

test('spring stays bounded after a 5 s frame gap', () => {
  const s = { x: 0, v: 0 };
  spring(s, 1, 16, 5);
  expect(s.x).toBeLessThanOrEqual(1.05);
});

test('a 30 s gap produces at most one blink in progress', () => {
  const scheduler = new BlinkScheduler([2.6, 7.0], 0.2, () => 0.99);
  scheduler.sample(1);
  expect(blinkStarts(scheduler, 31, 33.5)).toHaveLength(1);
});

test('blink lasts 170 ms, inside the 120-250 ms rule', () => {
  const scheduler = new BlinkScheduler([2.6, 7.0], 0, () => 0.5);
  // Time only moves forward: find the first closed window in one pass.
  let t = 0;
  while (scheduler.sample(t) === 0) t += 0.001;
  const start = t;
  while (scheduler.sample(t) > 0) t += 0.001;
  const end = t;
  expect(end - start).toBeGreaterThan(0.16);
  expect(end - start).toBeLessThan(0.175);
});

test('blink intervals stay within the personality range', () => {
  const scheduler = new BlinkScheduler([2.6, 7.0], 0.2, seeded(7));
  const starts = blinkStarts(scheduler, 0, 300, 0.002);
  const gaps = starts.slice(1).map((t, i) => t - starts[i]);
  expect(gaps.length).toBeGreaterThan(40);
  for (const gap of gaps) {
    const ordinary = gap >= 2.6 + 0.17 - 0.01 && gap <= 7.0 + 0.17 + 0.01;
    const double = gap >= 0.27 && gap <= 0.31;
    expect(ordinary || double).toBe(true);
  }
});

test('float stays within its amplitude', () => {
  for (let t = 0; t < 30; t += 0.1) {
    expect(Math.abs(floatOffset(t, NOX.personality).y)).toBeLessThanOrEqual(NOX.personality.float.amplitude * (4 / 3) + 1e-9);
  }
});

test('attention follows the pointer, then drifts to idle glances after 3.5 s', () => {
  const attention = new Attention(NOX.personality, () => 0.5);
  let gaze = attention.update({ x: 1, y: -0.17 }, 0, 1 / 60);
  for (let t = 1 / 60; t < 1; t += 1 / 60) gaze = attention.update({ x: 1, y: -0.17 }, t, 1 / 60);
  expect(gaze.gazeX).toBeGreaterThan(0.95);
  for (let t = 1; t < 6; t += 1 / 60) gaze = attention.update({ x: 1, y: -0.17 }, t, 1 / 60);
  expect(Math.abs(gaze.gazeX)).toBeLessThan(0.3);
});

test('attention holds a fixed target (a focused orb) without drifting to idle glances', () => {
  const attention = new Attention(NOX.personality, () => 0.5);
  let gaze = attention.update(null, 0, 1 / 60, { x: 0.6, y: 0.4 });
  for (let t = 1 / 60; t < 8; t += 1 / 60) gaze = attention.update(null, t, 1 / 60, { x: 0.6, y: 0.4 });
  expect(gaze.tracking).toBe(true);
  expect(gaze.gazeX).toBeCloseTo(Math.min(1, 0.6 * 1.6), 3);
  expect(gaze.gazeY).toBeCloseTo(Math.min(1, (0.4 + 0.17) * 1.6), 3);
});
