import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import { PERSONALITY_VARIANT_DEFAULTS } from '../config/types';
import { seededRng, settleOvershoot } from '../motion/micro';
import { settleWeight } from '../motion/swimArms';
import { BlinkScheduler, breath, floatOffset, settleScale, spring } from './ambient';
import { Attention, nearFace } from './attention';
import { SWIM_BLINK } from './expressions';

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
  const scheduler = new BlinkScheduler([2.6, 7.0], 0.2, NOX.personality.micro.blink, () => 0.99);
  scheduler.sample(1);
  expect(blinkStarts(scheduler, 31, 33.5)).toHaveLength(1);
});

test('blink lasts 170 ms, inside the 120-250 ms rule', () => {
  const scheduler = new BlinkScheduler([2.6, 7.0], 0, NOX.personality.micro.blink, () => 0.5);
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
  const scheduler = new BlinkScheduler([2.6, 7.0], 0.2, NOX.personality.micro.blink, seeded(7));
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

test('between glances the eyes make tiny movements, so they never look frozen', () => {
  const attention = new Attention(NOX.personality, (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })());
  const xs: number[] = [];
  for (let t = 0; t < 12; t += 1 / 60) xs.push(attention.update(null, t, 1 / 60).gazeX);
  // Over half-second windows inside a glance, the gaze still moves a little, and only a little.
  let moving = 0;
  for (let k = 0; k + 30 < xs.length; k += 30) {
    const window = xs.slice(k, k + 30);
    const span = Math.max(...window) - Math.min(...window);
    if (span > 0.004) moving++;
  }
  expect(moving).toBeGreaterThan(xs.length / 30 / 2);
});

test('with nothing to follow, attention rests on a given point (the detail panel)', () => {
  const attention = new Attention(NOX.personality, () => 0.5);
  const rest = { x: 0.5, y: -0.17 };
  const xs: number[] = [];
  for (let t = 0; t < 12; t += 1 / 60) xs.push(attention.update(null, t, 1 / 60, undefined, undefined, rest).gazeX);
  const settled = xs.slice(120);
  expect(settled.filter(x => Math.abs(x - 0.5 * 1.6) < 0.1).length / settled.length).toBeGreaterThan(0.8);
});

test('a moving pointer still takes the eyes from the resting point', () => {
  const attention = new Attention(NOX.personality, () => 0.5);
  const rest = { x: 0.5, y: -0.17 };
  let gaze = attention.update({ x: -0.8, y: -0.17 }, 0, 1 / 60, undefined, undefined, rest);
  for (let t = 1 / 60; t < 1; t += 1 / 60) gaze = attention.update({ x: -0.8, y: -0.17 }, t, 1 / 60, undefined, undefined, rest);
  expect(gaze.gazeX).toBeLessThan(-0.9);
});

test("resting on a point is the eyes' alone: the head holds its pose, and nothing counts as followed", () => {
  const attention = new Attention(NOX.personality, () => 0.5);
  const rest = { x: 0.5, y: -0.17 };
  let gaze = attention.update(null, 0, 1 / 60, undefined, undefined, rest);
  for (let t = 1 / 60; t < 6; t += 1 / 60) gaze = attention.update(null, t, 1 / 60, undefined, undefined, rest);
  expect(Math.abs(gaze.headX)).toBeLessThan(0.05);
  expect(gaze.tracking).toBe(false);
});

test('the pointer is near Nox when it is close to the face, wherever the stage frames the face', () => {
  const face = { x: -0.44, y: 0.05 };
  expect(nearFace(face, face)).toBe(1);
  expect(nearFace({ x: 0, y: -0.17 }, face)).toBeLessThan(0.35);
  expect(nearFace({ x: 0.5, y: 0 }, face)).toBe(0);
});

test('swimming, Nox blinks at a slower rate: the waits between blinks stretch by SWIM_BLINK', () => {
  expect(SWIM_BLINK).toBeGreaterThan(1);
  const gaps = (slower: number) => {
    const scheduler = new BlinkScheduler(NOX.personality.blinkInterval, 0, NOX.personality.micro.blink, seeded(7));
    const starts: number[] = [];
    let was = false;
    for (let t = 0; t <= 120; t += 0.002) {
      const closed = scheduler.sample(t, slower) > 0;
      if (closed && !was) starts.push(t);
      was = closed;
    }
    return starts.slice(1).map((s, i) => s - starts[i]);
  };
  const usual = gaps(1);
  const swimming = gaps(SWIM_BLINK);
  // The same draws, so each wait is SWIM_BLINK times as long (plus the blink itself, 0.17 s).
  swimming.slice(0, 5).forEach((gap, i) => expect(gap - 0.17).toBeCloseTo((usual[i] - 0.17) * SWIM_BLINK, 1));
  expect(swimming.length).toBeLessThan(usual.length);
});

// --- Task 16: the personality's settle (engine contract 14.1) ----------------------------------

/** Nox's ambient motion and landing overshoots from the code before Task 16 (captured at 4770b01). */
const NOX_FIXTURE = JSON.parse(readFileSync(new URL('../motion/fixtures/nox-motion.json', import.meta.url), 'utf8')) as Record<'float' | 'breaths' | 'blinks' | 'springs' | 'settle' | 'weight', unknown[]>;

/** Nox's personality as it is (the new fields unset) and with them set to his values. */
const NOX_BOTH = [NOX.personality, { ...NOX.personality, ...PERSONALITY_VARIANT_DEFAULTS }];

test("with Nox's values the ambient outputs are the pre-change fixtures exactly", () => {
  for (const p of NOX_BOTH) {
    expect(NOX_FIXTURE.float.map((_, i) => floatOffset(i * 0.1, p))).toEqual(NOX_FIXTURE.float);
    expect(NOX_FIXTURE.breaths.map((_, i) => breath(i * 0.1, p.breathPeriod))).toEqual(NOX_FIXTURE.breaths);
    const blinks = new BlinkScheduler(p.blinkInterval, p.doubleBlinkChance, p.micro.blink, seededRng(11));
    expect(NOX_FIXTURE.blinks.map((_, i) => blinks.sample(i / 60))).toEqual(NOX_FIXTURE.blinks);
    const st = { x: 0, v: 0 };
    expect(NOX_FIXTURE.springs.map(() => (spring(st, 1, p.gazeOmega, 1 / 60), st.x))).toEqual(NOX_FIXTURE.springs);
    // The landing overshoots the personality's settle scales: the stage move's and the entrance arms'.
    expect(NOX_FIXTURE.settle.map((_, i) => settleOvershoot(i / 120, p.micro, settleScale(p)))).toEqual(NOX_FIXTURE.settle);
    expect(NOX_FIXTURE.weight.map((_, i) => settleWeight(i / 100, settleScale(p)))).toEqual(NOX_FIXTURE.weight);
  }
});

test('settle 0.6 gives 60% of the overshoot peak, the stage move\'s and the entrance arms\'', () => {
  const calm = { ...NOX.personality, settle: 0.6 };
  const peak = (scale: number) => Math.max(...Array.from({ length: 2001 }, (_, i) => Math.abs(settleOvershoot((i / 2000) * NOX.personality.micro.settle.duration, NOX.personality.micro, scale))));
  expect(peak(settleScale(calm)) / peak(settleScale(NOX.personality))).toBeCloseTo(0.6, 9);
  expect(peak(settleScale(NOX.personality))).toBeCloseTo(NOX.personality.micro.settle.amount, 9);
  // The arms' run past the intro pose as the entrance lands: 60% as far past it.
  const past = (scale: number) => Math.max(...Array.from({ length: 2001 }, (_, i) => settleWeight(i / 2000, scale) - 1));
  expect(past(settleScale(calm)) / past(settleScale(NOX.personality))).toBeCloseTo(0.6, 3);
  // It still lands exactly on the pose, and settle 0 lands with no overshoot at all.
  expect(settleWeight(1, 0.6)).toBe(1);
  expect(past(0)).toBeLessThanOrEqual(0);
  expect(settleScale({ ...NOX.personality, settle: 0 })).toBe(0);
});
