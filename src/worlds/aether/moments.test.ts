import { expect, test } from 'vitest';
import { settleScale } from '../../engine/behavior/ambient';
import { FLOURISH_SECONDS, FLOURISH_UNROLL, FlourishScheduler, flourishRate } from '../../engine/behavior/flourish';
import { IDLE_GATE_RATE, IDLE_TILT_MAX_RATE, IDLE_TILT_SECONDS, idleTiltAt, idleTiltSchedule } from '../../engine/behavior/idleTilt';
import { LOOK_INTERVAL, lookSchedule, pickLookPoint } from '../../engine/behavior/lookPoints';
import { seededRng } from '../../engine/motion/micro';
import { strokeTiming } from '../../engine/motion/stroke';
import { validateBundle } from '../../engine/types/bundle';
import { AETHER_BUNDLE, AETHER_INTRO_TITLE } from './bundle';
import { AETHER } from './character';
import {
  MomentArbiter, SPARK, createSparkState, overlaps, planMoments, sparkBeadAt, sparkBeadIndex, sparkStep, sparkWaveAt,
  type Moment, type MomentKind, type SparkFrame, type SparkInput,
} from './moments';
import { AETHER_POSES, INTRO_LOOK_POINTS } from './poses';

// Task 16: Aether's personality and character moments (spec 7.8). Values are pinned here (and the
// base values in bundle.test.ts); the schedules are the engine's own functions run with Aether's
// numbers; the spark and the one-at-a-time arbiter are the world-level logic in moments.ts.

const P = AETHER.personality;
const DT = 1 / 60;
/** Octopus's fixed tilt seed (engine/character/Octopus.tsx TILT_SEED) and look seed (LOOK_SEED). */
const TILT_SEED = 0x7117;
const LOOK_SEED = 0x100c;
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

// --- The personality (spec 7.8's table) ----------------------------------------------------------

test('the personality is spec 7.8 start values, with the effective numbers restated once', () => {
  expect([P.blinkInterval, P.doubleBlinkChance, P.gazeOmega, P.headOmega, P.sway, P.curl]).toEqual([[2.8, 6.5], 0.25, 14, 2.8, 0.55, 1.25]);
  expect([P.float, P.breathPeriod]).toEqual([{ amplitude: 0.07, period: 6.8 }, 5.0]);
  const t = strokeTiming(P);
  expect([t.recovery, t.power, t.glide]).toEqual([0.6, 0.24, expect.closeTo(0.85, 12)]);
  expect(P.settle).toBe(0.8);
  expect(P.micro.settle.amount * settleScale(P)).toBeCloseTo(0.8 * 0.03, 12);
  expect(P.glideBias).toBe(1.4);
  expect(P.flourishRate).toBe(4.6);
  expect(P.idleTilt).toEqual({ amplitude: 0.105, period: [5, 9] });
  // 6 degrees.
  expect(P.idleTilt!.amplitude).toBeCloseTo((6 * Math.PI) / 180, 2);
  expect(validateBundle(AETHER_BUNDLE).character.personality).toMatchObject({ settle: 0.8, glideBias: 1.4, flourishRate: 4.6, idleTilt: { amplitude: 0.105, period: [5, 9] } });
});

test('the intro wanders between four look points: two jellyfish, the title corner and the visitor; no other stage does', () => {
  expect(INTRO_LOOK_POINTS).toHaveLength(4);
  for (const [x, y] of INTRO_LOOK_POINTS) expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
  expect(AETHER_POSES.intro.lookPoints).toBe(INTRO_LOOK_POINTS);
  // The two jellyfish are P2's: world ((px - 257) / 100, (252 - py) / 100) at P2 px (81, 165) and (427, 151).
  expect(INTRO_LOOK_POINTS[0][0]).toBeCloseTo((81 - 257) / 100, 2);
  expect(INTRO_LOOK_POINTS[0][1]).toBeCloseTo((252 - 165) / 100, 2);
  expect(INTRO_LOOK_POINTS[1][0]).toBeCloseTo((427 - 257) / 100, 2);
  expect(INTRO_LOOK_POINTS[1][1]).toBeCloseTo((252 - 151) / 100, 2);
  // The title's upper right corner.
  expect(INTRO_LOOK_POINTS[2]).toEqual([AETHER_INTRO_TITLE.halfWidth, AETHER_INTRO_TITLE.top]);
  // The visitor: straight ahead on her eye line (face origin x, eyes' rel y).
  expect(INTRO_LOOK_POINTS[3][0]).toBeCloseTo(AETHER.head.faceOrigin[0], 9);
  expect(INTRO_LOOK_POINTS[3][1]).toBeCloseTo(AETHER.head.faceOrigin[1] + AETHER.face.eye.centers[0][1], 9);
  for (const stage of ['entering', 'overview', 'techFocus', 'detail'] as const) expect(AETHER_POSES[stage].lookPoints).toBeUndefined();
});

test('the look points are picked every 4 to 8 s, never the same twice running, and all four get used', () => {
  expect(LOOK_INTERVAL).toEqual([4, 8]);
  const seen = new Set<number>();
  let prev = -1;
  let changes = 0;
  const lastChange = { t: 0 };
  for (let t = 0; t < 120; t += 0.05) {
    const p = pickLookPoint(t, INTRO_LOOK_POINTS, LOOK_INTERVAL, LOOK_SEED);
    const i = INTRO_LOOK_POINTS.findIndex(q => p && q[0] === p[0] && q[1] === p[1]);
    expect(i).toBeGreaterThanOrEqual(0);
    if (i !== prev) {
      if (prev >= 0) {
        changes++;
        expect(t - lastChange.t).toBeGreaterThanOrEqual(4 - 0.06);
        expect(t - lastChange.t).toBeLessThanOrEqual(8 + 0.06);
      }
      lastChange.t = t;
      prev = i;
    }
    seen.add(i);
  }
  expect(changes).toBeGreaterThanOrEqual(120 / 8 - 1);
  expect(seen.size).toBe(4);
});

// --- The tilt and the reach over 60 s of idle ----------------------------------------------------

/** Every tilt start before `until` seconds for a seed: the engine's own schedule, Aether's period. */
function tiltStarts(seed: number, until: number): number[] {
  idleTiltAt(until, P.idleTilt!, seed);
  return idleTiltSchedule(P.idleTilt!.period, seed).events.map(e => e.start).filter(s => s < until);
}

/** Every reach start before `until` seconds: the flourish scheduler at Aether's rate, stepped at 60 Hz. */
function reachStarts(seed: number, until: number): number[] {
  const scheduler = new FlourishScheduler(flourishRate(P), seededRng(seed));
  const starts: number[] = [];
  for (let t = 0; t < until; t += DT) {
    const playing = scheduler.step(t);
    if (playing && playing.start !== starts.at(-1)) starts.push(playing.start);
  }
  return starts;
}

test('over 60 s of idle, 6 to 12 tilts and 3 to 6 reaches start, for every seed tried', () => {
  for (const seed of [TILT_SEED, ...SEEDS]) {
    const tilts = tiltStarts(seed, 60).length;
    expect(tilts, `tilt seed ${seed}`).toBeGreaterThanOrEqual(6);
    expect(tilts, `tilt seed ${seed}`).toBeLessThanOrEqual(12);
  }
  for (const seed of SEEDS) {
    const reaches = reachStarts(seed, 60).length;
    expect(reaches, `reach seed ${seed}`).toBeGreaterThanOrEqual(3);
    expect(reaches, `reach seed ${seed}`).toBeLessThanOrEqual(6);
  }
});

test('the reach waits 10 to 16 s (the flourish layer draws 10.4 to 17.4 s at 4.6 a minute) and uncurls the tip at most 40%', () => {
  const starts = reachStarts(7, 3600);
  const waits = starts.slice(1).map((s, i) => s - starts[i]);
  expect(waits.length).toBeGreaterThan(200);
  for (const w of waits) {
    expect(w).toBeGreaterThanOrEqual(60 / 4.6 * 0.8 - 0.05);
    expect(w).toBeLessThanOrEqual(60 / 4.6 * (4 / 3) + 0.05);
  }
  const mean = waits.reduce((a, b) => a + b, 0) / waits.length;
  expect(mean).toBeGreaterThan(12.5);
  expect(mean).toBeLessThan(15.5);
  expect(FLOURISH_UNROLL).toBe(0.4);
});

test('the tilt never moves faster than her head turns, gate included', () => {
  const amp = P.idleTilt!.amplitude;
  // A head turn of the tilt's size, critically damped at headOmega, peaks at omega / e per unit of the turn.
  const headRate = (P.headOmega / Math.E) * amp;
  expect((IDLE_TILT_MAX_RATE + IDLE_GATE_RATE) * amp).toBeLessThanOrEqual(headRate);
  let worst = 0;
  for (const seed of [TILT_SEED, 1, 2, 3]) {
    let prev = idleTiltAt(0, P.idleTilt!, seed);
    for (let t = DT; t < 120; t += DT) {
      const now = idleTiltAt(t, P.idleTilt!, seed);
      worst = Math.max(worst, Math.abs(now - prev) / DT);
      expect(Math.abs(now)).toBeLessThanOrEqual(amp + 1e-12);
      prev = now;
    }
  }
  // Measured on the roll itself (before the gate): under the head's rate with room for the gate.
  expect(worst).toBeLessThanOrEqual(headRate - IDLE_GATE_RATE * amp + 1e-9);
  expect(IDLE_TILT_SECONDS).toBeCloseTo(4.6, 9);
});

// --- Never two moments at once -------------------------------------------------------------------

/** The wanted moments of all kinds over `until` seconds, as the engine's schedules would start them. */
function wantedMoments(seed: number, until: number): Moment[] {
  const out: Moment[] = [];
  for (const start of tiltStarts(seed, until)) out.push({ kind: 'tilt', start, end: start + 4.6 });
  for (const start of reachStarts(seed, until)) out.push({ kind: 'reach', start, end: start + FLOURISH_SECONDS });
  pickLookPoint(until, INTRO_LOOK_POINTS, LOOK_INTERVAL, seed);
  const picks = lookSchedule(LOOK_INTERVAL, INTRO_LOOK_POINTS.length, seed);
  // The first pick is at 0 (the pose's resting gaze), not a shift.
  for (const start of picks.starts.slice(1)) if (start < until) out.push({ kind: 'wander', start, end: start + 1.2 });
  return out;
}

test('left to their own schedules the tilt, reach and wander do overlap (the arbiter is needed); arbitrated they never do', () => {
  let rawOverlaps = 0;
  for (const seed of SEEDS) {
    const wanted = wantedMoments(seed, 120);
    if (overlaps(wanted)) rawOverlaps++;
    const { granted, refused } = planMoments(wanted);
    expect(overlaps(granted), `seed ${seed}`).toBe(false);
    expect(granted.length + refused.length).toBe(wanted.length);
    // The tilt alone fills about two thirds of the time, so the arbiter refuses a lot (it defers, a
    // live caller does not drop them): more than a third are granted at the moment they are due.
    expect(granted.length).toBeGreaterThan(wanted.length * 0.35);
  }
  expect(rawOverlaps).toBeGreaterThan(0);
});

test('the arbiter grants one moment at a time and never shortens the one running', () => {
  const arbiter = new MomentArbiter();
  expect(arbiter.claim('tilt', 10)).toBe(true);
  for (const kind of ['reach', 'spark', 'wander', 'tilt'] as MomentKind[]) expect(arbiter.claim(kind, 12)).toBe(false);
  expect(arbiter.active(12)?.kind).toBe('tilt');
  expect(arbiter.active(10 + IDLE_TILT_SECONDS + 0.01)).toBeNull();
  expect(arbiter.claim('spark', 10 + IDLE_TILT_SECONDS)).toBe(true);
  expect(arbiter.claim('reach', 10 + IDLE_TILT_SECONDS + 1.19)).toBe(false);
  expect(arbiter.claim('reach', 10 + IDLE_TILT_SECONDS + 1.2)).toBe(true);
});

// --- The spark of an idea ------------------------------------------------------------------------

const input = (t: number, over: Partial<SparkInput> = {}): SparkInput => ({ t, dt: DT, pointerDistance: 0.8, lifting: false, swelling: false, otherMoment: false, ...over });

/** Runs the spark `seconds` long; `at` gives each frame's inputs; returns the start times. */
function runSpark(seconds: number, at: (t: number) => Partial<SparkInput>): number[] {
  const state = createSparkState();
  const frame: SparkFrame = { active: false, started: false, wave: 0, bead: 0 };
  const starts: number[] = [];
  for (let t = 0; t < seconds; t += DT) {
    sparkStep(state, input(t, at(t)), frame);
    if (frame.started) starts.push(t);
  }
  return starts;
}

test('the spark: pointer within 1.2 units for over 1.5 s starts it; nearer than that for less does not; a cooldown of 8 s follows', () => {
  expect(SPARK).toEqual({ near: 1.2, dwell: 1.5, wave: 1.2, cooldown: 8 });
  const starts = runSpark(40, () => ({}));
  expect(starts[0]).toBeGreaterThanOrEqual(1.5 - DT);
  expect(starts[0]).toBeLessThan(1.5 + 2 * DT);
  // From the end of one spark (1.2 s) to the next start: the cooldown, then the dwell again.
  for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(SPARK.wave + SPARK.cooldown - 1e-9);
  expect(starts.length).toBeGreaterThanOrEqual(3);
  // The pointer arrives at 1.21 (just outside), or leaves before 1.5 s: nothing.
  expect(runSpark(20, () => ({ pointerDistance: 1.21 }))).toEqual([]);
  expect(runSpark(20, () => ({ pointerDistance: null }))).toEqual([]);
  expect(runSpark(20, t => ({ pointerDistance: t % 2 < 1.4 ? 0.5 : 3 }))).toEqual([]);
  expect(runSpark(20, () => ({ reducedMotion: true }))).toEqual([]);
});

test('a spark never starts during a lift or the head swell, and the dwell is kept so it fires when they end', () => {
  const lift = (t: number) => t < 9;
  const swell = (t: number) => t >= 20 && t < 27;
  const starts = runSpark(60, t => ({ lifting: lift(t), swelling: swell(t) }));
  expect(starts.length).toBeGreaterThan(0);
  for (const s of starts) {
    expect(lift(s)).toBe(false);
    expect(swell(s)).toBe(false);
  }
  // Held at the lift: it fires the frame the lift ends.
  expect(starts[0]).toBeGreaterThanOrEqual(9);
  expect(starts[0]).toBeLessThan(9 + 2 * DT);
  // Lift on the whole time: never.
  expect(runSpark(60, () => ({ lifting: true }))).toEqual([]);
  expect(runSpark(60, () => ({ swelling: true }))).toEqual([]);
  expect(runSpark(60, () => ({ otherMoment: true }))).toEqual([]);
});

test('the spark wave runs from her face to her crown in 1.2 s and the bead flickers once, softly', () => {
  // uSparkleWave: 0 at rest, then 1 (the face) down to 0 (the crown), monotonic and eased at both ends.
  expect(sparkWaveAt(-0.1)).toBe(0);
  expect(sparkWaveAt(0)).toBe(1);
  expect(sparkWaveAt(SPARK.wave)).toBe(0);
  let prev = 1;
  for (let e = 0; e < SPARK.wave; e += 0.01) {
    const w = sparkWaveAt(e);
    expect(w).toBeLessThanOrEqual(prev + 1e-12);
    prev = w;
  }
  // The bead: 0 at both ends, peaks once inside, stays 0 to 1, and never changes faster than a soft pulse.
  expect(sparkBeadAt(0)).toBeCloseTo(0, 12);
  expect(sparkBeadAt(SPARK.wave - 1e-6)).toBeCloseTo(0, 5);
  let peak = 0;
  let worstStep = 0;
  let last = 0;
  for (let e = 0; e < SPARK.wave; e += 0.005) {
    const b = sparkBeadAt(e);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(1);
    peak = Math.max(peak, b);
    worstStep = Math.max(worstStep, Math.abs(b - last) / 0.005);
    last = b;
  }
  expect(peak).toBeGreaterThan(0.8);
  expect(worstStep).toBeLessThan(5);
  // One bead, the same one on a replay, always inside the ring.
  for (let n = 1; n <= 9; n++) {
    const i = sparkBeadIndex(n, 12.5);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(n);
    expect(sparkBeadIndex(n, 12.5)).toBe(i);
  }
});

// --- Everything together -------------------------------------------------------------------------

test('120 s of tilt, reach, wander and spark through one arbiter: never two at once, no spark in a lift or swell', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const arbiter = new MomentArbiter();
    const state = createSparkState();
    const frame: SparkFrame = { active: false, started: false, wave: 0, bead: 0 };
    const pending = wantedMoments(seed, 120).filter(m => m.kind !== 'spark');
    const done: Moment[] = [];
    const lifting = (t: number) => t >= 40 && t < 46;
    const swelling = (t: number) => t >= 70 && t < 74;
    const near = (t: number) => (t >= 20 && t < 34) || (t >= 38 && t < 80);
    let sparks = 0;
    for (let t = 0; t < 120; t += DT) {
      // The spark first (it is the visitor's own trigger), then the oldest waiting moment.
      sparkStep(state, input(t, { pointerDistance: near(t) ? 0.7 : 2.5, lifting: lifting(t), swelling: swelling(t), otherMoment: arbiter.active(t) !== null }), frame);
      if (frame.started) {
        expect(arbiter.claim('spark', t)).toBe(true);
        expect(lifting(t) || swelling(t)).toBe(false);
        done.push({ kind: 'spark', start: t, end: t + SPARK.wave });
        sparks++;
      }
      for (let i = 0; i < pending.length && !arbiter.active(t); i++) {
        if (pending[i].start > t) continue;
        const m = pending[i];
        if (arbiter.claim(m.kind, t)) {
          done.push({ kind: m.kind, start: t, end: t + (m.end - m.start) });
          pending.splice(i, 1);
          break;
        }
      }
    }
    expect(overlaps(done), `seed ${seed}`).toBe(false);
    expect(sparks, `seed ${seed}`).toBeGreaterThanOrEqual(2);
    expect(done.some(m => m.kind === 'tilt')).toBe(true);
    expect(done.some(m => m.kind === 'reach')).toBe(true);
    expect(done.some(m => m.kind === 'wander')).toBe(true);
  }
});
