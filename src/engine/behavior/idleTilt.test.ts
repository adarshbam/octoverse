import { expect, test } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import { IDLE_TILT_MAX_RATE, IDLE_TILT_SECONDS, idleTiltAt } from './idleTilt';

const TILT = { amplitude: 0.105, period: [5, 9] as const };

/** Frame times (60 a second) from `from` for `seconds`. */
const frames = (seconds: number, from = 0) => Array.from({ length: Math.round(seconds * 60) + 1 }, (_, i) => from + i / 60);

/** The times a tilt starts: the value leaves 0. */
function starts(seconds: number, tilt = TILT, seed = 5) {
  const out: number[] = [];
  let was = 0;
  for (const t of frames(seconds)) {
    const v = idleTiltAt(t, tilt, seed);
    if (v !== 0 && was === 0) out.push(t);
    was = v;
  }
  return out;
}

test('idleTiltAt stays within plus or minus the amplitude, and tilts both ways', () => {
  let low = 0;
  let high = 0;
  for (const seed of [1, 2, 3, 77]) {
    for (const t of frames(240)) {
      const v = idleTiltAt(t, TILT, seed);
      expect(Math.abs(v)).toBeLessThanOrEqual(TILT.amplitude);
      low = Math.min(low, v);
      high = Math.max(high, v);
    }
  }
  expect(low).toBeLessThan(-0.05);
  expect(high).toBeGreaterThan(0.05);
});

test('over 60 s with a period of 5 to 9 s, between 6 and 12 tilts start', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const n = starts(60, TILT, seed).length;
    expect(n, `seed ${seed}`).toBeGreaterThanOrEqual(6);
    expect(n, `seed ${seed}`).toBeLessThanOrEqual(12);
  }
});

test('the gap from one tilt start to the next is inside the period, and the same seed replays', () => {
  const s = starts(300);
  for (let i = 1; i < s.length; i++) {
    expect(s[i] - s[i - 1]).toBeGreaterThanOrEqual(5 - 0.03);
    expect(s[i] - s[i - 1]).toBeLessThanOrEqual(9 + 0.03);
  }
  expect(starts(300)).toEqual(s);
  expect(starts(300, TILT, 6)).not.toEqual(s);
});

test('a tilt tilts, holds and returns: it ends level before the next, and never moves faster than the head turns', () => {
  expect(IDLE_TILT_SECONDS).toBeLessThanOrEqual(5);
  // A critically damped spring chasing a step peaks at omega / e per unit (src/worlds/idleVariants.test.ts holds every shipped head to it).
  const limit = (NOX.personality.headOmega / Math.E) * TILT.amplitude;
  expect(IDLE_TILT_MAX_RATE).toBeLessThanOrEqual(0.75);
  let fastest = 0;
  let held = 0;
  for (const seed of [1, 2, 3]) {
    let prev = idleTiltAt(0, TILT, seed);
    for (const t of frames(200, 1 / 60)) {
      const v = idleTiltAt(t, TILT, seed);
      fastest = Math.max(fastest, Math.abs(v - prev) * 60);
      if (Math.abs(v) > 0.55 * TILT.amplitude && Math.abs(v - prev) < 1e-6) held++;
      prev = v;
    }
  }
  expect(fastest).toBeGreaterThan(0.01);
  expect(fastest).toBeLessThanOrEqual(limit);
  // It holds a moment at the top (neither rising nor falling).
  expect(held).toBeGreaterThan(5);
  // Before the first tilt the head is level.
  expect(idleTiltAt(0, TILT, 1)).toBe(0);
});

test('no tilt: amplitude 0, or a period that is not a range, reads 0', () => {
  for (const t of frames(60)) {
    expect(idleTiltAt(t, { amplitude: 0, period: [5, 9] }, 1)).toBe(0);
    expect(idleTiltAt(t, { amplitude: 0.1, period: [9, 5] }, 1)).toBe(0);
    expect(idleTiltAt(t, { amplitude: Number.NaN, period: [5, 9] }, 1)).toBe(0);
  }
  expect(idleTiltAt(Number.NaN, TILT, 1)).toBe(0);
  expect(idleTiltAt(Infinity, TILT, 1)).toBe(0);
});

test('with reduced motion it returns 0', () => {
  for (const t of frames(60)) expect(idleTiltAt(t, TILT, 1, true)).toBe(0);
  // The same call with motion on does tilt.
  expect(frames(60).some(t => idleTiltAt(t, TILT, 1, false) !== 0)).toBe(true);
});
