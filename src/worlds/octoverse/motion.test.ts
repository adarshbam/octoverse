import { beforeAll, expect, test } from 'vitest';
import { FLOURISH_SECONDS, FlourishScheduler, flourishRate } from '../../engine/behavior/flourish';
import { IDLE_TILT_SECONDS, idleTiltAt } from '../../engine/behavior/idleTilt';
import { arrivalWiggle, seededRng } from '../../engine/motion/micro';
import { loadWorldSequences, type Sequences } from '../../engine/sequences/theatre';
import { HOST_SEQUENCES } from './bundle';
import { HOST, HOST_FACES } from './character';
import { ARRIVAL_SETTLE, HOST_FLOURISH_ARMS, arrivalFace, arrivalT1Wave, hostFlourishBusy } from './moments';
import { HOST_SEQUENCE_DEFAULTS } from './sequences/defaults';

// The host's motion personality and arrival (platform spec 7.5): warm, attentive, not fidgety; the
// wave reads as hello. Task 11.

let seq: Sequences;
beforeAll(async () => {
  seq = await loadWorldSequences(HOST_SEQUENCES);
});

const p = HOST.personality;

test('the personality is spec 7.5\'s Host column, value for value', () => {
  expect(p.blinkInterval).toEqual([3.0, 7.5]);
  expect(p.doubleBlinkChance).toBe(0.18);
  expect(p.gazeOmega).toBe(14);
  expect(p.headOmega).toBe(2.8);
  expect(p.sway).toBe(0.45);
  expect(p.float).toEqual({ amplitude: 0.05, period: 6.8 });
  expect(p.breathPeriod).toBe(5.0);
  // The stroke as spec 7.5 states it: no glideBias, so the raw glide is the glide it swims.
  expect([p.swim.recovery, p.swim.power, p.swim.glide]).toEqual([0.58, 0.24, 0.8]);
  expect(p.glideBias).toBeUndefined();
  // Settle overshoot 80% of Nox's approved one: the share, on Nox's amount (0.03).
  expect(p.settle).toBe(0.8);
  expect(p.micro.settle.amount).toBe(0.03);
  // The idle tilt: 0.03 rad, one every 9 s (the engine's period is a range of seconds; [9, 9] is every 9 s).
  expect(p.idleTilt).toEqual({ amplitude: 0.03, period: [9, 9] });
});

test('flourishRate 3.4 a minute: waits of 0.8 to 4/3 of 60 / 3.4 s, 14.1 to 23.5 s (spec: every 14 to 22 s)', () => {
  // flourish.ts draws each wait from 0.8 to 4/3 of the mean wait 60 / rate s. Its 5:3 spread cannot
  // match 14 to 22 s (11:7) exactly; 3.4 keeps the shortest wait at 14 s (never fidgety) and the mean
  // (about 18.8 s) near the middle of the spec's range, with the longest a little over (23.5 s).
  expect(p.flourishRate).toBe(3.4);
  const mean = 60 / flourishRate(p);
  expect(mean * 0.8).toBeCloseTo(14.12, 2);
  expect(mean * (4 / 3)).toBeCloseTo(23.53, 2);
  expect(mean * 0.8).toBeGreaterThanOrEqual(14);
});

test('over 120 s simulated, 4 to 9 flourishes, each on an upper arm (T1 or T8) only', () => {
  expect(HOST_FLOURISH_ARMS).toEqual(['T1', 'T8']);
  for (const seed of [1, 7, 42, 2026, 99991]) {
    const s = new FlourishScheduler(flourishRate(p), seededRng(seed));
    const starts: { arm: string; start: number }[] = [];
    let last: number | null = null;
    for (let t = 0; t <= 120; t += 1 / 60) {
      const f = s.step(t, hostFlourishBusy);
      if (f && f.start !== last) {
        last = f.start;
        starts.push({ arm: f.arm, start: f.start });
      }
    }
    expect(starts.length).toBeGreaterThanOrEqual(4);
    expect(starts.length).toBeLessThanOrEqual(9);
    for (const f of starts) expect(['T1', 'T8']).toContain(f.arm);
    // Never two at once, never closer than 14 s apart.
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i].start - starts[i - 1].start).toBeGreaterThanOrEqual(14);
      expect(starts[i].start - starts[i - 1].start).toBeGreaterThan(FLOURISH_SECONDS);
    }
  }
});

test('the idle tilt stays within 0.03 rad and starts every 9 s', () => {
  const tilt = p.idleTilt!;
  let peak = 0;
  const starts: number[] = [];
  let was = 0;
  for (let t = 0; t <= 60; t += 0.01) {
    const r = idleTiltAt(t, tilt, 7);
    peak = Math.max(peak, Math.abs(r));
    if (was === 0 && r !== 0) starts.push(t);
    was = r;
  }
  expect(peak).toBeLessThanOrEqual(0.03 + 1e-9);
  expect(peak).toBeGreaterThan(0.015);
  expect(starts.length).toBe(6);
  for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeCloseTo(9, 1);
  expect(IDLE_TILT_SECONDS).toBeLessThan(9);
});

/** Samples a curve of the arrival's clock over its length, 10 ms apart. */
const sweep = (f: (t: number) => number) => {
  const out: [number, number][] = [];
  for (let i = 0; i <= 160; i++) out.push([i / 100, f(i / 100)]);
  return out;
};

test('the arrival wave peaks twice on T1 between the settle and the settle + 1.2 s', () => {
  // The arrival plays from the settle (the entrance handing over: arrival clock 0, ARRIVAL_SETTLE).
  expect(ARRIVAL_SETTLE).toBe(0);
  const wave = sweep(t => arrivalT1Wave(seq, t, p.micro));
  const peaks = wave.filter(([, v], i) => i > 0 && i < wave.length - 1 && v > 0.5 && v >= wave[i - 1][1] && v > wave[i + 1][1]).map(([t]) => t);
  expect(peaks).toHaveLength(2);
  for (const t of peaks) {
    expect(t).toBeGreaterThan(ARRIVAL_SETTLE);
    expect(t).toBeLessThanOrEqual(ARRIVAL_SETTLE + 1.2);
  }
  // Two distinct waves: the arm comes back between them, and is down again by the end.
  const between = Math.min(...wave.filter(([t]) => t > peaks[0] && t < peaks[1]).map(([, v]) => v));
  expect(between).toBeLessThan(0.5);
  expect(arrivalT1Wave(seq, 1.4, p.micro)).toBe(0);
  // At rest before the arrival begins and once it is over.
  expect(arrivalT1Wave(seq, Infinity, p.micro)).toBe(0);
});

test('delighted lasts 0.6 +- 0.1 s from the settle, then the face returns to welcome', () => {
  const faces = sweep(t => (arrivalFace(seq, t, p.micro) === HOST_FACES.delighted ? 1 : 0));
  const on = faces.filter(([, v]) => v === 1).map(([t]) => t);
  expect(on.length).toBeGreaterThan(0);
  const first = on[0];
  const last = on[on.length - 1];
  // One unbroken spell.
  expect(on.length).toBe(Math.round((last - first) * 100) + 1);
  expect(last - first + 0.01).toBeGreaterThanOrEqual(0.5);
  expect(last - first + 0.01).toBeLessThanOrEqual(0.7);
  expect(first).toBeLessThan(0.15);
  for (const [t] of faces.filter(([t]) => t > last)) expect(arrivalFace(seq, t, p.micro)).toBe(HOST_FACES.welcome);
  expect(arrivalFace(seq, Infinity, p.micro)).toBe(HOST_FACES.welcome);
});

test('the arrival sheet is authored data: its keys in the saved Theatre state, its length the personality\'s duration', async () => {
  const def = HOST_SEQUENCE_DEFAULTS.arrival;
  expect(def.length).toBe(1.4);
  expect(p.micro.arrival.duration).toBe(def.length);
  expect(Object.keys(def.objects.main.keys).sort()).toEqual(['armWave', 'delighted', 'roll', 't1Wave']);
  // Seeded into the saved state (scripts/theatre-seed.mjs), the entrance's sheet left out (Task 12's).
  const saved = (await HOST_SEQUENCES.state()) as { sheetsById: Record<string, { sequence: { length: number; tracksByObject: { main: { trackIdByPropPath: Record<string, string> } } } }> };
  expect(Object.keys(saved.sheetsById)).toEqual(['arrival']);
  expect(saved.sheetsById.arrival.sequence.length).toBe(1.4);
  expect(Object.keys(saved.sheetsById.arrival.sequence.tracksByObject.main.trackIdByPropPath).sort()).toEqual(['["armWave"]', '["delighted"]', '["roll"]', '["t1Wave"]']);
  // The engine's own wiggle (body rock, all arms fanning) plays the same two beats, small.
  const fan = sweep(t => arrivalWiggle(seq, t, p.micro).armWave);
  expect(Math.max(...fan.map(([, v]) => v))).toBeLessThanOrEqual(p.micro.arrival.armWave);
  expect(Math.max(...fan.map(([, v]) => v))).toBeGreaterThan(0);
});

test('the entrance placeholder is untouched (Task 12 replaces it)', () => {
  expect(HOST_SEQUENCE_DEFAULTS.entrance.length).toBe(5.4);
  expect(HOST_SEQUENCE_DEFAULTS.entrance.objects.main.keys).toEqual({});
});
