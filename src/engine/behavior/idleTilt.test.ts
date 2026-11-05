import { expect, test } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import { IDLE_GATE_RATE, IDLE_TILT_MAX_RATE, IDLE_TILT_SECONDS, idleGateStep, idleTiltAt, idleTiltSchedule, idleTiltScheduleCount } from './idleTilt';

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

test('asking again with the same arguments allocates no schedule, builds no new one, and grows nothing', () => {
  const period = [5, 9] as const;
  const seed = 4242;
  const schedule = idleTiltSchedule(period, seed);
  idleTiltAt(100, { amplitude: 0.1, period }, seed);
  const count = idleTiltScheduleCount();
  const drawn = schedule.events.length;
  for (let i = 0; i < 5000; i++) {
    // A frame later each time, and a fresh (equal) period array each call, as a caller that builds one would.
    idleTiltAt(100 + (i % 50) / 60, { amplitude: 0.1, period: [5, 9] }, seed);
    expect(idleTiltSchedule([5, 9], seed)).toBe(schedule);
  }
  expect(idleTiltScheduleCount()).toBe(count);
  // 50 frames inside 100 to 100.83 s: no tilt event is drawn beyond the one past the clock already drawn.
  expect(schedule.events.length).toBe(drawn);
  // Another seed is another schedule, and asking for the first again finds it.
  expect(idleTiltSchedule(period, seed + 1)).not.toBe(schedule);
  expect(idleTiltSchedule(period, seed)).toBe(schedule);
});

test('the gate moves 0 to 1 and back at IDLE_GATE_RATE, and a tilt cut by it never changes faster than the head turns', () => {
  expect(idleGateStep(0, true, 1 / 60)).toBeCloseTo(IDLE_GATE_RATE / 60, 12);
  expect(idleGateStep(1, true, 1 / 60)).toBe(1);
  expect(idleGateStep(0, false, 1 / 60)).toBe(0);
  let g = 0;
  for (let i = 0; i < 60 * 6 + 1; i++) g = idleGateStep(g, true, 1 / 60);
  expect(g).toBe(1);
  for (let i = 0; i < 60 * 6 + 1; i++) g = idleGateStep(g, false, 1 / 60);
  expect(g).toBe(0);
  // The slowest shipped head (omega 2.4, src/worlds/idleVariants.test.ts) sets the limit.
  const limit = (2.4 / Math.E) * TILT.amplitude;
  // Open and close the gate at every point of a tilt (each 1/10 s of 120 s), and watch the roll frame to frame, as Octopus does (frames up to 1/20 s too).
  for (const dt of [1 / 60, 1 / 20]) {
    let fastest = 0;
    for (let open = 0; open < 120; open += 0.1) {
      for (const opening of [true, false]) {
        let gate = opening ? 0 : 1;
        let prev = idleTiltAt(open, TILT, 9) * gate;
        for (let t = open + dt; t < open + 8; t += dt) {
          gate = idleGateStep(gate, opening, dt);
          const v = idleTiltAt(t, TILT, 9) * gate;
          fastest = Math.max(fastest, Math.abs(v - prev) / dt);
          prev = v;
        }
      }
    }
    expect(fastest, `dt ${dt}`).toBeLessThanOrEqual(limit);
  }
  // The bound the sweep stays under: the tilt's peak rate and the gate's, together.
  expect((IDLE_TILT_MAX_RATE + IDLE_GATE_RATE) * TILT.amplitude).toBeLessThanOrEqual(limit);
});
