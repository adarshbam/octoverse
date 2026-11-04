import { expect, test } from 'vitest';
import { NOX } from '../../nox3d/config/nox.character';
import { type StrokeFrame, type StrokePhase, strokeAt, swimDrive } from './stroke';

const TIMING = NOX.personality.swim;
/** One stroke's length in seconds: the clock runs one unit per stroke. */
const CYCLE = TIMING.recovery + TIMING.power + TIMING.glide;
const STEPS = 6000;
const PHASES: readonly StrokePhase[] = ['recovery', 'power', 'glide'];

/** One stroke (the second, so a stroke index is crossed on the way in), sampled finely. */
const STROKE = Array.from({ length: STEPS }, (_, i) => strokeAt(1 + i / STEPS, TIMING));
const inPhase = (phase: StrokePhase) => STROKE.filter(frame => frame.phase === phase);
const seconds = (phase: StrokePhase) => (inPhase(phase).length / STEPS) * CYCLE;
const mean = (frames: StrokeFrame[], key: keyof Omit<StrokeFrame, 'phase'>) => frames.reduce((sum, f) => sum + f[key], 0) / frames.length;

test("phase durations sit in the spec's ranges", () => {
  // Spec 9.5: recovery 0.45 to 0.6 s, power 0.18 to 0.25 s, glide 0.4 to 0.8 s.
  const ranges: Record<StrokePhase, [number, number]> = { recovery: [0.45, 0.6], power: [0.18, 0.25], glide: [0.4, 0.8] };
  for (const phase of PHASES) {
    expect(seconds(phase), phase).toBeGreaterThanOrEqual(ranges[phase][0]);
    expect(seconds(phase), phase).toBeLessThanOrEqual(ranges[phase][1]);
    // The clock splits each stroke by the personality's own durations.
    expect(Math.abs(seconds(phase) - TIMING[phase]), phase).toBeLessThan(2 * (CYCLE / STEPS));
  }
  // In order, each phase's own progress running from 0 to 1.
  expect(STROKE.map(f => f.phase).filter((p, i, all) => p !== all[i - 1])).toEqual(PHASES);
  for (const phase of PHASES) {
    const us = inPhase(phase).map(f => f.u);
    expect(us[0], phase).toBeLessThan(0.01);
    expect(us.at(-1)!, phase).toBeGreaterThan(0.99);
    for (let i = 1; i < us.length; i++) expect(us[i]).toBeGreaterThan(us[i - 1]);
  }
});

test('power is the fastest phase and carries the most thrust', () => {
  expect(seconds('power')).toBeLessThan(seconds('recovery'));
  expect(seconds('power')).toBeLessThan(seconds('glide'));
  const thrust = Object.fromEntries(PHASES.map(phase => [phase, mean(inPhase(phase), 'thrust')])) as Record<StrokePhase, number>;
  expect(thrust.power).toBeGreaterThan(thrust.glide);
  expect(thrust.glide).toBeGreaterThan(thrust.recovery);
  // The strongest push is in the power stroke, and the arms sweep back faster there than they open in recovery.
  const peak = Math.max(...STROKE.map(f => f.thrust));
  expect(STROKE.find(f => f.thrust === peak)!.phase).toBe('power');
  const fastest = (phase: StrokePhase, key: 'spread' | 'sweep') => {
    const frames = inPhase(phase);
    let most = 0;
    for (let i = 1; i < frames.length; i++) most = Math.max(most, Math.abs(frames[i][key] - frames[i - 1][key]));
    return most / (CYCLE / STEPS);
  };
  expect(fastest('power', 'sweep')).toBeGreaterThan(1.5 * fastest('recovery', 'spread'));
  // Recovery is low (Nox slows); the glide coasts, its push only ever falling.
  expect(Math.max(...inPhase('recovery').map(f => f.thrust))).toBeLessThan(0.25 * peak);
  const glide = inPhase('glide');
  for (let i = 1; i < glide.length; i++) expect(glide[i].thrust).toBeLessThanOrEqual(glide[i - 1].thrust + 1e-12);
  expect(glide[0].thrust).toBeGreaterThan(0.9 * peak);
});

test('mantle fills 4% in recovery and squeezes 6% in power', () => {
  const recovery = inPhase('recovery').map(f => f.mantle);
  const power = inPhase('power').map(f => f.mantle);
  expect(Math.max(...recovery)).toBeCloseTo(TIMING.fill, 4);
  expect(Math.min(...recovery)).toBeGreaterThanOrEqual(0);
  expect(Math.min(...power)).toBeCloseTo(-TIMING.squeeze, 4);
  expect(TIMING.fill).toBe(0.04);
  expect(TIMING.squeeze).toBe(0.06);
  // The glide lets the mantle go back to its own size.
  expect(Math.abs(inPhase('glide').at(-1)!.mantle)).toBeLessThan(1e-3);
});

test('tips straighten late in the power stroke', () => {
  const peak = Math.max(...STROKE.map(f => f.straighten));
  expect(peak).toBeCloseTo(1, 6);
  const first = STROKE.find(f => f.straighten >= peak - 1e-9)!;
  expect(first.phase).toBe('power');
  expect(first.u).toBeGreaterThanOrEqual(0.7);
  // Curled while the arms open, and only easing straight in the second half of the stroke.
  expect(Math.max(...inPhase('recovery').map(f => f.straighten))).toBeLessThan(0.01);
  expect(Math.max(...inPhase('power').filter(f => f.u < 0.4).map(f => f.straighten))).toBeLessThan(0.1);
  // The glide lets the tips curl again before the next opening.
  expect(inPhase('glide').at(-1)!.straighten).toBeLessThan(0.01);
});

test('the arms open in recovery and sweep back in power, held swept back through the glide', () => {
  const recovery = inPhase('recovery');
  const power = inPhase('power');
  expect(recovery[0].sweep).toBeCloseTo(1, 3);
  expect(recovery.at(-1)!.spread).toBeCloseTo(1, 3);
  expect(recovery.at(-1)!.sweep).toBeCloseTo(0, 3);
  expect(power[0].spread).toBeCloseTo(1, 3);
  expect(power.at(-1)!.sweep).toBeCloseTo(1, 3);
  for (const f of inPhase('glide')) expect(f.sweep).toBeCloseTo(1, 9);
  for (const f of STROKE) {
    for (const key of ['spread', 'sweep', 'straighten'] as const) {
      expect(f[key]).toBeGreaterThanOrEqual(0);
      expect(f[key]).toBeLessThanOrEqual(1);
    }
  }
});

test('the stroke never jumps: every drive runs on through the phases and into the next stroke', () => {
  const step = 1 / STEPS;
  let prev = strokeAt(0.5, TIMING);
  for (let clock = 0.5 + step; clock < 3.5; clock += step) {
    const frame = strokeAt(clock, TIMING);
    for (const key of ['spread', 'sweep', 'straighten', 'mantle', 'thrust'] as const) {
      expect(Math.abs(frame[key] - prev[key]), `${key} at ${clock.toFixed(4)}`).toBeLessThan(0.01);
    }
    prev = frame;
  }
});

test('swimming, the arms swing 0.9 rad back, 1.3 swept back; settled, they are exactly as at rest', () => {
  expect(swimDrive({ sweep: 0, straighten: 0 })).toEqual({ pitch: 0.9, straighten: 0 });
  expect(swimDrive({ sweep: 1, straighten: 1 }).pitch).toBeCloseTo(1.3, 9);
  // Wherever the stroke stopped (here mid-whip in the glide), a settled Nox has no swim drive left.
  const stopped = strokeAt(4.6, TIMING);
  expect(stopped.phase).toBe('glide');
  expect(swimDrive(stopped, 1)).toEqual({ pitch: 0, straighten: 0 });
  expect(swimDrive(stopped, 0.5).pitch).toBeCloseTo(0.5 * swimDrive(stopped).pitch, 9);
});

test('the stroke index is the clock’s whole part: every stroke is the same', () => {
  for (const f of [0, 0.2, 0.45, 0.5, 0.8, 0.97]) {
    const later = strokeAt(3 + f, TIMING);
    const first = strokeAt(f, TIMING);
    expect(later.phase).toBe(first.phase);
    for (const key of ['u', 'spread', 'sweep', 'straighten', 'mantle', 'thrust'] as const) expect(later[key], key).toBeCloseTo(first[key], 9);
  }
});
