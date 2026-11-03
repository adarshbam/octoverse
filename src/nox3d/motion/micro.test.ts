import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import type { Personality } from '../config/types';
import { loadSequences, type Sequences } from '../sequences/theatre';
import { arrivalWiggle, idleGlance, seededRng, settleOvershoot, startle } from './micro';

type Micro = Personality['micro'];
const MICRO = NOX.personality.micro;

/** One scalar per channel of each motion at `t`, so every channel is checked the same way. */
const channels = (seq: Sequences) => ({
  'startle.lift': (t: number, p: Micro) => startle(t, p).lift,
  'startle.armsIn': (t: number, p: Micro) => startle(t, p).armsIn,
  'startle.eyes': (t: number, p: Micro) => startle(t, p).eyes,
  settle: (t: number, p: Micro) => settleOvershoot(t, p),
  'arrival.roll': (t: number, p: Micro) => arrivalWiggle(seq, t, p).roll,
  'arrival.armWave': (t: number, p: Micro) => arrivalWiggle(seq, t, p).armWave,
});

/** The first and last moment a channel is not zero, sampled from 1 s before to well after `span`. */
function windowOf(f: (t: number) => number, span: number) {
  let first = Infinity;
  let last = -Infinity;
  let peak = 0;
  let peakAt = NaN;
  const step = span / 4000;
  for (let t = -1; t <= span * 3; t += step) {
    const v = f(t);
    if (v !== 0) {
      first = Math.min(first, t);
      last = Math.max(last, t);
    }
    if (Math.abs(v) > peak) {
      peak = Math.abs(v);
      peakAt = t;
    }
  }
  return { first, last, peak, peakAt };
}

/** Each channel's window length in the personality (seconds) and its strength there. */
const spans = (p: Micro) => ({
  'startle.lift': [p.startle.duration, p.startle.lift],
  'startle.armsIn': [p.startle.duration, p.startle.armsIn],
  'startle.eyes': [p.startle.duration, p.startle.eyes],
  settle: [p.settle.duration, p.settle.amount],
  'arrival.roll': [p.arrival.duration, p.arrival.roll],
  'arrival.armWave': [p.arrival.duration, p.arrival.armWave],
}) as const;

test('each micro-animation is zero outside its window and peaks inside it', async () => {
  const seq = await loadSequences();
  const span = spans(MICRO);
  for (const [name, f] of Object.entries(channels(seq))) {
    const [duration, strength] = span[name as keyof typeof span];
    const w = windowOf(t => f(t, MICRO), duration);
    // Nothing before it starts or after its duration.
    expect(f(-0.01, MICRO), name).toBe(0);
    expect(f(-5, MICRO), name).toBe(0);
    expect(f(duration + 0.01, MICRO), name).toBe(0);
    expect(f(duration + 5, MICRO), name).toBe(0);
    expect(w.first, name).toBeGreaterThanOrEqual(0);
    expect(w.last, name).toBeLessThanOrEqual(duration);
    // It peaks inside, at about the personality's strength.
    expect(w.peakAt, name).toBeGreaterThan(0);
    expect(w.peakAt, name).toBeLessThan(duration);
    expect(w.peak, name).toBeGreaterThan(strength * 0.9);
    expect(w.peak, name).toBeLessThan(strength * 1.1);
  }
  // Idle glances: none before the first is due, then a glance off centre.
  const rng = () => seededRng(11);
  expect(idleGlance(-1, rng(), MICRO)).toBeNull();
  expect(idleGlance(MICRO.glance.first - 0.01, rng(), MICRO)).toBeNull();
  const g = idleGlance(MICRO.glance.first + 0.01, rng(), MICRO);
  expect(g).not.toBeNull();
  expect(Math.hypot(g!.x, g!.y)).toBeGreaterThan(0);
  expect(Math.abs(g!.x)).toBeLessThanOrEqual(MICRO.glance.x / 2);
  expect(Math.abs(g!.y - MICRO.glance.lift)).toBeLessThanOrEqual(MICRO.glance.y / 2);
});

test('timings come from the personality: a doubled duration doubles the window', async () => {
  const seq = await loadSequences();
  const doubled: Micro = {
    ...MICRO,
    startle: { ...MICRO.startle, duration: MICRO.startle.duration * 2 },
    settle: { ...MICRO.settle, duration: MICRO.settle.duration * 2 },
    arrival: { ...MICRO.arrival, duration: MICRO.arrival.duration * 2 },
    glance: { ...MICRO.glance, first: MICRO.glance.first * 2 },
  };
  const span = spans(MICRO);
  for (const [name, f] of Object.entries(channels(seq))) {
    const [duration] = span[name as keyof typeof span];
    const a = windowOf(t => f(t, MICRO), duration * 2);
    const b = windowOf(t => f(t, doubled), duration * 2);
    const tolerance = (duration * 2) / 1000;
    expect(b.last - b.first, name).toBeCloseTo(2 * (a.last - a.first), 2);
    expect(Math.abs(b.last - 2 * a.last), name).toBeLessThan(tolerance + 0.01 * duration);
    expect(Math.abs(b.peakAt - 2 * a.peakAt), name).toBeLessThan(tolerance + 0.01 * duration);
  }
  // The first idle glance comes twice as late.
  const firstGlance = (p: Micro) => {
    for (let t = 0; t < 20; t += 0.001) if (idleGlance(t, seededRng(3), p)) return t;
    return Infinity;
  };
  expect(firstGlance(doubled)).toBeCloseTo(2 * firstGlance(MICRO), 2);
});

test('idle glances never repeat at a fixed interval', () => {
  for (const seed of [1, 7, 42]) {
    const starts: number[] = [];
    let was: { x: number; y: number } | null = null;
    for (let t = 0; t <= 120; t += 1 / 60) {
      const g = idleGlance(t, seededRng(seed), MICRO);
      if (g && (!was || g.x !== was.x || g.y !== was.y)) starts.push(t);
      was = g;
    }
    const gaps = starts.slice(1).map((s, i) => s - starts[i]);
    expect(gaps.length, `seed ${seed}`).toBeGreaterThan(20);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
    expect(sd / mean, `seed ${seed}`).toBeGreaterThan(0.2);
    // Every wait stays in the personality's range.
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(MICRO.glance.wait[0] - 1 / 60);
      expect(gap).toBeLessThanOrEqual(MICRO.glance.wait[1] + 1 / 60);
    }
  }
});
