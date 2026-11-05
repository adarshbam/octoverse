import { expect, test } from 'vitest';
import type { Point2 } from '../config/types';
import { LOOK_INTERVAL, lookSchedule, lookScheduleCount, pickLookPoint } from './lookPoints';

const POINTS: readonly Point2[] = [
  [-1, 0.2],
  [1.2, 0.4],
  [0.1, -0.6],
  [0.5, 0.9],
];

/** The times the pick changes, sampled every 10 ms. */
function changes(seconds: number, points = POINTS, seed = 3) {
  const out: number[] = [];
  let was = pickLookPoint(0, points, LOOK_INTERVAL, seed);
  for (let i = 1; i <= seconds * 100; i++) {
    const now = pickLookPoint(i / 100, points, LOOK_INTERVAL, seed);
    if (now !== was) out.push(i / 100);
    was = now;
  }
  return out;
}

test('the interval is 4 to 8 s', () => {
  expect(LOOK_INTERVAL).toEqual([4, 8]);
});

test('the pick is one of the points, and changes at intervals inside 4 to 8 s', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const at = changes(300, POINTS, seed);
    expect(at.length).toBeGreaterThan(30);
    for (let i = 1; i < at.length; i++) {
      expect(at[i] - at[i - 1], `seed ${seed}`).toBeGreaterThanOrEqual(4 - 0.011);
      expect(at[i] - at[i - 1], `seed ${seed}`).toBeLessThanOrEqual(8 + 0.011);
    }
    expect(at[0]).toBeGreaterThanOrEqual(4 - 0.011);
    expect(at[0]).toBeLessThanOrEqual(8 + 0.011);
  }
  for (let t = 0; t < 60; t += 0.5) expect(POINTS).toContain(pickLookPoint(t, POINTS, LOOK_INTERVAL, 9));
});

test('a new pick is never the one before it, and the same seed replays', () => {
  let was = pickLookPoint(0, POINTS, LOOK_INTERVAL, 8);
  let n = 0;
  for (let i = 1; i <= 20000; i++) {
    const now = pickLookPoint(i / 100, POINTS, LOOK_INTERVAL, 8);
    if (now !== was) n++;
    was = now;
  }
  // 200 s at 4 to 8 s a pick: 25 to 50 changes (a pick equal to the one before would have skipped one).
  expect(n).toBeGreaterThanOrEqual(24);
  expect(n).toBeLessThanOrEqual(50);
  expect(changes(120)).toEqual(changes(120));
  expect(changes(120, POINTS, 4)).not.toEqual(changes(120, POINTS, 3));
});

test('no points is null, and one point is always that point', () => {
  expect(pickLookPoint(10, [], LOOK_INTERVAL, 1)).toBeNull();
  for (let t = 0; t < 100; t += 3) expect(pickLookPoint(t, [POINTS[0]], LOOK_INTERVAL, 1)).toBe(POINTS[0]);
});

test('an interval that is not a range of seconds, or a time that is not a time, is null', () => {
  expect(pickLookPoint(10, POINTS, [8, 4], 1)).toBeNull();
  expect(pickLookPoint(10, POINTS, [0, 4], 1)).toBeNull();
  expect(pickLookPoint(10, POINTS, [4, Number.NaN], 1)).toBeNull();
  expect(pickLookPoint(Number.NaN, POINTS, LOOK_INTERVAL, 1)).toBeNull();
  expect(pickLookPoint(Infinity, POINTS, LOOK_INTERVAL, 1)).toBeNull();
});

test('with reduced motion it returns null', () => {
  for (let t = 0; t < 60; t += 1) expect(pickLookPoint(t, POINTS, LOOK_INTERVAL, 1, true)).toBeNull();
  expect(pickLookPoint(10, POINTS, LOOK_INTERVAL, 1, false)).not.toBeNull();
});

test('asking again with the same arguments builds no new schedule and grows nothing', () => {
  const seed = 4242;
  pickLookPoint(100, POINTS, LOOK_INTERVAL, seed);
  const schedule = lookSchedule(LOOK_INTERVAL, POINTS.length, seed);
  const count = lookScheduleCount();
  const drawn = schedule.starts.length;
  for (let i = 0; i < 5000; i++) {
    pickLookPoint(100 + (i % 50) / 60, POINTS, [4, 8], seed);
    expect(lookSchedule([4, 8], POINTS.length, seed)).toBe(schedule);
  }
  expect(lookScheduleCount()).toBe(count);
  expect(schedule.starts.length).toBe(drawn);
  expect(lookSchedule(LOOK_INTERVAL, POINTS.length, seed + 1)).not.toBe(schedule);
  expect(lookSchedule(LOOK_INTERVAL, POINTS.length, seed)).toBe(schedule);
});
