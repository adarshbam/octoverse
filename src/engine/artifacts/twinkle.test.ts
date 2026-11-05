import { expect, test } from 'vitest';
import { ringDrawn } from './satellite';
import { TWINKLE_BEADS_START, TWINKLE_LINE_SECONDS, TWINKLE_SECONDS, twinkleFrame, twinkleLength, twinklePop, twinkleState } from './twinkle';

const STEPS = 280;
const times = Array.from({ length: STEPS + 1 }, (_, i) => (i / STEPS) * 1.6);

test('the line draws over the first 0.6 s and the beads light between 0.6 s and 1.4 s', () => {
  expect([TWINKLE_LINE_SECONDS, TWINKLE_BEADS_START, TWINKLE_SECONDS]).toEqual([0.6, 0.6, 1.4]);
  expect(twinkleState(0, 5, false)).toEqual({ line: 0, beads: [0, 0, 0, 0, 0] });
  const mid = twinkleState(0.3, 5, false);
  expect(mid.line).toBeGreaterThan(0);
  expect(mid.line).toBeLessThan(1);
  expect(mid.beads).toEqual([0, 0, 0, 0, 0]);
  // The line is whole when the first bead begins.
  expect(twinkleState(0.6, 5, false).line).toBe(1);
  expect(twinkleState(0.6, 5, false).beads).toEqual([0, 0, 0, 0, 0]);
});

test('every channel rises once, never falls, and is complete by 1.4 s', () => {
  for (const count of [1, 2, 5, 9]) {
    let last = twinkleState(times[0], count, false);
    for (const t of times.slice(1)) {
      const now = twinkleState(t, count, false);
      expect(now.line).toBeGreaterThanOrEqual(last.line);
      now.beads.forEach((b, i) => expect(b).toBeGreaterThanOrEqual(last.beads[i]));
      last = now;
    }
    const done = twinkleState(TWINKLE_SECONDS, count, false);
    expect(done.line).toBe(1);
    expect(done.beads).toEqual(Array.from({ length: count }, () => 1));
    for (const channel of [done.line, ...done.beads]) expect(channel).toBeLessThanOrEqual(1);
    // And stays complete.
    expect(twinkleState(30, count, false)).toEqual(done);
  }
});

test('bead i lights before bead i + 1, and the last is not lit before the first is', () => {
  const count = 5;
  // The first moment each bead is any lit at all, and the first moment it is full.
  const began = Array.from({ length: count }, (_, i) => times.find(t => twinkleState(t, count, false).beads[i] > 0) ?? Infinity);
  const full = Array.from({ length: count }, (_, i) => times.find(t => twinkleState(t, count, false).beads[i] >= 1) ?? Infinity);
  for (let i = 0; i + 1 < count; i++) {
    expect(began[i]).toBeLessThan(began[i + 1]);
    expect(full[i]).toBeLessThan(full[i + 1]);
  }
  // At every moment a later bead is never ahead of an earlier one.
  for (const t of times) {
    const { beads } = twinkleState(t, count, false);
    for (let i = 0; i + 1 < count; i++) expect(beads[i]).toBeGreaterThanOrEqual(beads[i + 1]);
  }
  // The first begins with the beads' window (0.6 s), the last is full at its end (1.4 s).
  expect(began[0]).toBeGreaterThan(0.6 - 1e-9);
  expect(full[count - 1]).toBeLessThanOrEqual(1.4 + 1e-9);
});

test('with reduced motion the ring is complete at t 0', () => {
  expect(twinkleState(0, 5, true)).toEqual({ line: 1, beads: [1, 1, 1, 1, 1] });
  expect(twinkleState(0.4, 3, true)).toEqual({ line: 1, beads: [1, 1, 1] });
});

test('odd inputs give a whole, in-range state (no beads, one bead, a time before 0 or not a number)', () => {
  expect(twinkleState(0.9, 0, false).beads).toEqual([]);
  expect(twinkleState(0.6, 1, false).beads).toEqual([0]);
  expect(twinkleState(1.4, 1, false).beads).toEqual([1]);
  expect(twinkleState(-2, 5, false)).toEqual({ line: 0, beads: [0, 0, 0, 0, 0] });
  expect(twinkleState(Number.NaN, 5, false)).toEqual({ line: 0, beads: [0, 0, 0, 0, 0] });
  expect(twinkleState(0.3, 2.9, false).beads).toHaveLength(2);
});

test('the run lasts the appear duration, and the frame plays the sheet clock over it (an even clock: the state at the same moment)', () => {
  expect(twinkleLength(undefined)).toBe(1.4);
  expect(twinkleLength(2.8)).toBe(2.8);
  // A sheet whose clock runs 0 to 1 straight (length 1.4): the frame at `s` seconds is the state at s.
  const sequences = { length: () => 1.4, sample: (_id: string, _object: string, seconds: number) => ({ clock: seconds / 1.4 }) };
  const same = (a: { line: number; beads: number[] }, b: { line: number; beads: number[] }) => {
    expect(a.line).toBeCloseTo(b.line, 9);
    expect(a.beads).toHaveLength(b.beads.length);
    a.beads.forEach((bead, i) => expect(bead).toBeCloseTo(b.beads[i], 9));
  };
  for (const s of [0, 0.3, 0.8, 1.1, 1.4]) same(twinkleFrame(sequences as never, s, 5, 1.4), twinkleState(s, 5, false));
  // Twice as long: the same shape at half the pace.
  same(twinkleFrame(sequences as never, 1.4, 5, 2.8), twinkleState(0.7, 5, false));
  // Past the run it is whole, before it nothing is drawn.
  same(twinkleFrame(sequences as never, 9, 5, 1.4), twinkleState(1.4, 5, false));
  same(twinkleFrame(sequences as never, -1, 5, 1.4), twinkleState(0, 5, false));
  // No sheet in yet: the first moment.
  same(twinkleFrame(null, 0.9, 5, 1.4), twinkleState(0, 5, false));
});

test('the ring line draws round from one side of the keep-out to the other, and is whole when the line is', () => {
  const ring = { keepOut: Math.PI / 4 };
  const angles = Array.from({ length: 360 }, (_, d) => (d * Math.PI) / 180);
  // Nothing drawn at 0, everything drawn at 1 (exactly as the ring was before it formed).
  for (const a of angles) {
    expect(ringDrawn(a, 0, ring)).toBe(0);
    expect(ringDrawn(a, 1, ring)).toBe(1);
  }
  // It only grows: at every angle, a later moment shows at least as much; and it grows round in angle order (the beads' order).
  let last = angles.map(a => ringDrawn(a, 0, ring));
  for (let i = 1; i <= 20; i++) {
    const now = angles.map(a => ringDrawn(a, i / 20, ring));
    now.forEach((v, k) => expect(v).toBeGreaterThanOrEqual(last[k]));
    // Within the drawn part (from the keep-out onward) the line is never behind a point further on.
    for (let k = 46; k < 314; k++) expect(now[k]).toBeGreaterThanOrEqual(now[k + 1] - 1e-12);
    last = now;
  }
  // By the end of the line's draw the last bead's home (288 degrees) is shown, and at the half the first home (72) is but the last is not.
  expect(ringDrawn((288 * Math.PI) / 180, 1, ring)).toBe(1);
  expect(ringDrawn((72 * Math.PI) / 180, 0.5, ring)).toBe(1);
  expect(ringDrawn((288 * Math.PI) / 180, 0.5, ring)).toBe(0);
});

test('a bead swells past its size as it lights and settles at exactly its size', () => {
  expect(twinklePop(0)).toBe(0);
  expect(twinklePop(1)).toBeCloseTo(1, 12);
  expect(Math.max(...Array.from({ length: 101 }, (_, i) => twinklePop(i / 100)))).toBeGreaterThan(1);
  expect(twinklePop(-1)).toBe(0);
  expect(twinklePop(2)).toBeCloseTo(1, 12);
});
