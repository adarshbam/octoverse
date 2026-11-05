import { describe, expect, it } from 'vitest';
import { BLOOM_SECONDS, type BloomState, bloomLength, bloomState, bloomTiming } from './bloom';

const CHANNELS = ['cupGlow', 'pearl', 'thread', 'orb'] as const;
const step = 1 / 240;

/** Every channel of pendant `index` of `count`, sampled from 0 to `until` seconds. */
function samples(index: number, count: number, until: number, options?: Parameters<typeof bloomState>[3]): BloomState[] {
  const out: BloomState[] = [];
  for (let t = 0; t <= until + 1e-9; t += step) out.push(bloomState(t, index, count, options));
  return out;
}

describe('bloomState (spec 7.5: cup, pearl, thread, orb, in a ripple from order 0)', () => {
  it('is monotonic per channel and complete by 1.2 s for 16 pendants', () => {
    for (let i = 0; i < 16; i++) {
      const run = samples(i, 16, 1.5);
      for (const channel of CHANNELS) {
        for (let k = 1; k < run.length; k++) expect(run[k][channel]).toBeGreaterThanOrEqual(run[k - 1][channel] - 1e-12);
      }
      const done = bloomState(BLOOM_SECONDS, i, 16);
      expect(done).toEqual({ cupGlow: 1, pearl: 1, thread: 1, orb: 1, wobble: 0 });
    }
    expect(BLOOM_SECONDS).toBe(1.2);
  });

  it('starts empty, and ripples from order 0 down: an earlier order is never behind a later one', () => {
    expect(bloomState(0, 0, 16)).toEqual({ cupGlow: 0, pearl: 0, thread: 0, orb: 0, wobble: 0 });
    for (let t = 0; t <= 1.2; t += 0.05) {
      for (let i = 1; i < 16; i++) {
        for (const channel of CHANNELS) expect(bloomState(t, i - 1, 16)[channel]).toBeGreaterThanOrEqual(bloomState(t, i, 16)[channel]);
      }
    }
    // The last pendant has not begun when the first is well under way.
    expect(bloomState(0.3, 0, 16).cupGlow).toBeGreaterThan(0.9);
    expect(bloomState(0.3, 15, 16).cupGlow).toBe(0);
  });

  it('runs in its beats: the cup brightens, the pearl grows, the thread draws down, then the orb swells with a soft wobble', () => {
    const run = samples(0, 1, 1.2);
    const first = (channel: (typeof CHANNELS)[number]) => run.findIndex(s => s[channel] > 0);
    expect(first('cupGlow')).toBeLessThan(first('pearl'));
    expect(first('pearl')).toBeLessThan(first('thread'));
    expect(first('thread')).toBeLessThan(first('orb'));
    const wobble = run.map(s => s.wobble);
    expect(Math.max(...wobble)).toBeGreaterThan(0.02);
    expect(Math.min(...wobble)).toBeLessThan(-0.01);
    expect(Math.max(...wobble.map(Math.abs))).toBeLessThanOrEqual(0.12);
    // No wobble before the orb swells, none once it is done.
    run.forEach(s => { if (s.orb === 0 || s.orb === 1) expect(s.wobble).toBe(0); });
  });

  it('is complete at t 0 with reduced motion, with no wobble', () => {
    for (let i = 0; i < 16; i++) {
      expect(bloomState(0, i, 16, { reducedMotion: true })).toEqual({ cupGlow: 1, pearl: 1, thread: 1, orb: 1, wobble: 0 });
      expect(bloomState(0.4, i, 16, { reducedMotion: true }).wobble).toBe(0);
    }
  });

  it('takes start, span and step from `placement.reveal` when set (A2 X3)', () => {
    const reveal = { start: 0.5, span: 0.8, step: 0.25 };
    expect(bloomTiming(4, reveal)).toEqual(reveal);
    // Pendant 2 begins at 0.5 + 2 x 0.25 = 1.0 and is done 0.8 later.
    expect(bloomState(0.99, 2, 4, { reveal }).cupGlow).toBe(0);
    expect(bloomState(1.0 + 0.8, 2, 4, { reveal })).toEqual({ cupGlow: 1, pearl: 1, thread: 1, orb: 1, wobble: 0 });
    expect(bloomState(1.0 + 0.4, 2, 4, { reveal }).orb).toBeLessThan(1);
    // The run lasts until the last one is done: 0.5 + 3 x 0.25 + 0.8.
    expect(bloomLength(4, reveal)).toBeCloseTo(2.05, 12);
    for (const channel of CHANNELS) {
      const run = samples(3, 4, 2.2, { reveal });
      for (let k = 1; k < run.length; k++) expect(run[k][channel]).toBeGreaterThanOrEqual(run[k - 1][channel] - 1e-12);
    }
  });

  it('keeps its own 1.2 s ripple when `placement.reveal` is absent, whatever the count', () => {
    for (const count of [1, 2, 8, 12, 16]) {
      const timing = bloomTiming(count);
      expect(timing.start).toBe(0);
      expect(timing.start + Math.max(0, count - 1) * timing.step + timing.span).toBeCloseTo(BLOOM_SECONDS, 12);
      expect(bloomLength(count)).toBeCloseTo(BLOOM_SECONDS, 12);
      expect(bloomState(BLOOM_SECONDS, count - 1, count).orb).toBe(1);
      expect(bloomState(BLOOM_SECONDS - 0.05, count - 1, count).orb).toBeLessThan(1);
    }
    // A world's appear duration other than 1.2 s stretches the same ripple.
    expect(bloomLength(16, undefined, 2)).toBeCloseTo(2, 12);
    expect(bloomState(1.99, 15, 16, { duration: 2 }).orb).toBeLessThan(1);
    expect(bloomState(2, 15, 16, { duration: 2 }).orb).toBe(1);
  });

  it('reads a non-finite clock as the start', () => {
    expect(bloomState(Number.NaN, 0, 4)).toEqual({ cupGlow: 0, pearl: 0, thread: 0, orb: 0, wobble: 0 });
  });
});
