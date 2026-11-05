import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import { NOX_BUNDLE } from '../../worlds/nox/bundle';
import { ArmChain } from '../character/armChain';
import { ARM_IDS, type ArmId } from '../config/types';
import { createInstanceState } from '../host/instance';
import { seededRng } from '../motion/micro';
import { STAGE_IDS } from '../config/types';
import { FLOURISH_SECONDS, FLOURISH_UNROLL, type FlourishEvent, FlourishEvents, FlourishScheduler, flourishCurve, flourishMayPlay, flourishRate, flourishUnroll, yieldedUnroll } from './flourish';

/** `seconds` of frames (60 per second, from `from`) through `scheduler`, recording each start. */
function run(scheduler: FlourishScheduler, seconds = 60, busy?: (arm: ArmId) => boolean, events?: FlourishEvents, from = 0) {
  const starts: FlourishEvent[] = [];
  let last: FlourishEvent | null = null;
  for (let i = 0; i <= seconds * 60; i++) {
    const t = from + i / 60;
    const now = scheduler.step(t, busy, events);
    if (now && (!last || now.start !== last.start)) starts.push({ arm: now.arm, start: now.start });
    last = now;
  }
  return starts;
}

test('the curve runs 0 to 1 to 0 over 3 s: 0 at both ends and outside, 1 at the middle, smooth', () => {
  expect(FLOURISH_SECONDS).toBe(3);
  const start = 7.25;
  expect(flourishCurve(start, start)).toBe(0);
  expect(flourishCurve(start + 3, start)).toBe(0);
  expect(flourishCurve(start + 1.5, start)).toBe(1);
  expect(flourishCurve(start - 0.5, start)).toBe(0);
  expect(flourishCurve(start + 3.5, start)).toBe(0);
  let prev = 0;
  for (let i = 1; i <= 300; i++) {
    const t = start + (i / 300) * 3;
    const v = flourishCurve(t, start);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
    // Rising to the middle, falling after it, never by a jump.
    if (i <= 150) expect(v).toBeGreaterThanOrEqual(prev);
    else expect(v).toBeLessThanOrEqual(prev);
    expect(Math.abs(v - prev)).toBeLessThan(0.02);
    prev = v;
  }
  // Eases in and out: the first and last 5% move it very little.
  expect(flourishCurve(start + 0.15, start)).toBeLessThan(0.01);
});

test('the unroll is at most 40% of the tip curl, at the middle of the flourish', () => {
  expect(FLOURISH_UNROLL).toBe(0.4);
  expect(flourishUnroll(1.5, 0)).toBeCloseTo(0.4, 12);
  for (let i = 0; i <= 400; i++) expect(flourishUnroll((i / 400) * 4 - 0.5, 0)).toBeLessThanOrEqual(0.4);
});

test('with flourishRate 4, a minute has 2 to 6 flourishes, never two at once, each wait 12 to 20 s', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const starts = run(new FlourishScheduler(4, seededRng(seed)));
    expect(starts.length, `seed ${seed}`).toBeGreaterThanOrEqual(2);
    expect(starts.length, `seed ${seed}`).toBeLessThanOrEqual(6);
    for (let i = 1; i < starts.length; i++) {
      const gap = starts[i].start - starts[i - 1].start;
      expect(gap).toBeGreaterThanOrEqual(FLOURISH_SECONDS);
      expect(gap).toBeGreaterThanOrEqual(12 - 1 / 60);
      expect(gap).toBeLessThanOrEqual(20 + 1 / 60);
    }
  }
});

test('at most one arm flourishes at any moment, and it is the arm the start named', () => {
  const scheduler = new FlourishScheduler(4, seededRng(3));
  let current: FlourishEvent | null = null;
  for (let i = 0; i <= 120 * 60; i++) {
    const now = scheduler.step(i / 60);
    if (now) {
      if (current && now.start === current.start) expect(now.arm).toBe(current.arm);
      expect(i / 60 - now.start).toBeLessThan(FLOURISH_SECONDS);
    }
    current = now;
  }
});

test('never on a busy arm (the busy-arm hook Task 19 wires to the pendant lift): a stub keeps T1 and T5 busy', () => {
  const busy = (arm: ArmId) => arm === 'T1' || arm === 'T5';
  for (let seed = 1; seed <= 40; seed++) {
    for (const start of run(new FlourishScheduler(4, seededRng(seed)), 120, busy)) expect(['T1', 'T5']).not.toContain(start.arm);
  }
  // Every arm busy: nothing starts; free again, one starts on the next frame.
  const scheduler = new FlourishScheduler(4, seededRng(9));
  let free = false;
  const all = () => !free;
  for (let i = 0; i <= 60 * 60; i++) expect(scheduler.step(i / 60, all)).toBeNull();
  free = true;
  expect(scheduler.step(60 + 1 / 60, all)).not.toBeNull();
});

test('the arms vary: no arm flourishes twice in a row, and over ten minutes most arms get a turn', () => {
  const starts = run(new FlourishScheduler(4, seededRng(5)), 600);
  for (let i = 1; i < starts.length; i++) expect(starts[i].arm).not.toBe(starts[i - 1].arm);
  expect(new Set(starts.map(s => s.arm)).size).toBeGreaterThanOrEqual(6);
});

test("Nox's rate (unset, or 0) never flourishes; nor does a rate that is not a finite positive number", () => {
  expect(flourishRate(NOX.personality)).toBe(0);
  for (const rate of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(run(new FlourishScheduler(rate, seededRng(1)), 600)).toEqual([]);
});

test('the same seed gives the same flourishes (deterministic for tests)', () => {
  expect(run(new FlourishScheduler(4, seededRng(21)))).toEqual(run(new FlourishScheduler(4, seededRng(21))));
});

test('each start is one event on the instance, with its arm; unsubscribing stops the calls', () => {
  const events = new FlourishEvents();
  const heard: FlourishEvent[] = [];
  const unsubscribe = events.subscribe(e => heard.push(e));
  const scheduler = new FlourishScheduler(4, seededRng(13));
  const starts = run(scheduler, 60, undefined, events);
  expect(starts.length).toBeGreaterThanOrEqual(2);
  expect(heard).toEqual(starts);
  unsubscribe();
  const later = run(scheduler, 60, undefined, events, 60 + 1 / 60);
  expect(later.length).toBeGreaterThan(0);
  expect(heard).toEqual(starts);
  // Unsubscribing twice is harmless.
  unsubscribe();
});

test("two instances do not hear each other's flourishes", () => {
  const a = createInstanceState({ ...NOX_BUNDLE, id: 'a' }, 'page');
  const b = createInstanceState({ ...NOX_BUNDLE, id: 'b' }, 'preview');
  expect(a.flourish).not.toBe(b.flourish);
  const heardA: ArmId[] = [];
  const heardB: ArmId[] = [];
  a.flourish.subscribe(e => heardA.push(e.arm));
  b.flourish.subscribe(e => heardB.push(e.arm));
  run(new FlourishScheduler(4, seededRng(2)), 60, undefined, a.flourish);
  expect(heardA.length).toBeGreaterThan(0);
  expect(heardB).toEqual([]);
});

test("a flourish unrolls the tip curl through the arm chain's straightening: at its peak the outer arm turns 40% less", () => {
  // An arm hanging down whose outer half curls 1.5 rad toward its tip.
  const n = 64;
  const rest = { rootX: 0, rootY: 0, segmentLength: 0.02, angles: Float32Array.from({ length: n }, (_, k) => -Math.PI / 2 + 3 * Math.max(0, (k + 0.5) / n - 0.5)) };
  const direction = (chain: ArmChain, k: number) => Math.atan2(chain.py[k + 1] - chain.py[k], chain.px[k + 1] - chain.px[k]);
  /** The turn over the outer 40% of the arm (radians), where the straightening has full hold. */
  const outerTurn = (chain: ArmChain) => direction(chain, n - 1) - direction(chain, Math.ceil(0.6 * n));
  const drive = { time: 0, sway: 0, curl: 0, droop: 0 };
  const still = new ArmChain(rest, NOX.arms[0], 0);
  still.solve(drive);
  const peak = new ArmChain(rest, NOX.arms[0], 0);
  peak.solve({ ...drive, straighten: flourishUnroll(1.5, 0) });
  expect(outerTurn(still)).toBeGreaterThan(1);
  expect(outerTurn(peak) / outerTurn(still)).toBeCloseTo(1 - FLOURISH_UNROLL, 4);
});

test("the character wires the flourish, the glide bias and the settle into its frame (Octopus.tsx)", () => {
  const octopus = readFileSync(new URL('../character/Octopus.tsx', import.meta.url), 'utf8');
  expect(octopus).toMatch(/strokeTiming\(config\.personality\)/);
  expect(octopus).toMatch(/settleOvershoot\(mc\.settle, micro, settleScale\(personality\)\)/);
  expect(octopus).toMatch(/new FlourishScheduler\(flourishRate\(config\.personality\)\)/);
  expect(octopus).toMatch(/instance\.flourish/);
  // The gate and the yield are the pure functions tested above, not a copy of them.
  expect(octopus).toMatch(/if \(flourishMayPlay\(moving, swim !== null, stage\)\)/);
  expect(octopus).toMatch(/yieldedUnroll\(flourishUnroll\(m\.flourishClock, playing\.start\), m\.holdWeight\[playing\.index\]\)/);
  expect(ARM_IDS.length).toBe(8);
});

test('a flourish plays only with motion on, out of the swim and out of the entrance (reduced motion and freeze make moving 0)', () => {
  for (const stage of STAGE_IDS) {
    expect(flourishMayPlay(1, false, stage), stage).toBe(stage !== 'entering');
    // Reduced motion or `?freeze`: Octopus's `moving` is 0.
    expect(flourishMayPlay(0, false, stage), stage).toBe(false);
    // Swimming (the entrance's stroke is running).
    expect(flourishMayPlay(1, true, stage), stage).toBe(false);
  }
});

test("a playing flourish yields to its arm becoming busy: the unroll fades with the hold's weight and is gone once it holds", () => {
  expect(yieldedUnroll(0.4, 0)).toBe(0.4);
  expect(yieldedUnroll(0.4, 0.5)).toBeCloseTo(0.2, 12);
  expect(yieldedUnroll(0.4, 1)).toBe(0);
  expect(yieldedUnroll(0.4, 1.7)).toBe(0);
  expect(yieldedUnroll(0.4, -0.3)).toBe(0.4);
  // A flourish on its way up when its arm starts to hold (the hold's turn ramping 0 to 1 over 0.5 s): it gives way
  // smoothly, never unrolls more than it would have, and is gone once the arm holds.
  const scheduler = new FlourishScheduler(4, seededRng(4));
  let playing = null as ReturnType<FlourishScheduler['step']>;
  let t = 0;
  for (; !playing; t += 1 / 60) playing = scheduler.step(t);
  const holdFrom = playing.start + 0.5;
  let prev = Infinity;
  for (let u = holdFrom; u < playing.start + FLOURISH_SECONDS; u += 1 / 60) {
    const weight = Math.min(1, (u - holdFrom) / 0.5);
    const unroll = yieldedUnroll(flourishUnroll(u, playing.start), weight);
    expect(unroll).toBeLessThanOrEqual(flourishUnroll(u, playing.start));
    if (weight === 1) expect(unroll).toBe(0);
    // No jump from frame to frame.
    if (prev !== Infinity) expect(Math.abs(unroll - prev)).toBeLessThan(0.02);
    prev = unroll;
  }
});
