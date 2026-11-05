import { expect, test } from 'vitest';
import { settleScale } from '../../engine/behavior/ambient';
import { FLOURISH_SECONDS, FlourishScheduler, flourishRate } from '../../engine/behavior/flourish';
import { subscribeIdlePulse } from '../../engine/character/cupPulse';
import { ARM_IDS, type ArmId } from '../../engine/config/types';
import { clampCharacterConfig } from '../../engine/config/validate';
import { createInstanceState } from '../../engine/host/instance';
import { seededRng } from '../../engine/motion/micro';
import { strokeTiming } from '../../engine/motion/stroke';
import { validateBundle } from '../../engine/types/bundle';
import { FLUX_BUNDLE } from './bundle';
import { FLUX } from './character';

// Flux's motion personality (spec 7.8) and the idle pulse (spec 2.4, 7.5), under the flourish
// contract as it landed (owner ruling): the event is { arm, start }; settle is 0 to 1; the tip
// unroll plays on every flourish, so the pulse travels alongside it.

const CONFIG = clampCharacterConfig(FLUX);
const P = FLUX.personality;
/** The nominal pulse length on an arm: the band's head reaches the tip and its tail leaves it. */
const PULSE_SECONDS = (1 + CONFIG.suckers.pulse!.wavelength) / CONFIG.suckers.pulse!.speed;

/**
 * Plays `seconds` of 60 fps frames of Flux's flourish layer (the scheduler on its own clock, the
 * pulse on a frame clock with another origin) and returns every idle pulse as the cups would see it.
 */
function play(seconds: number, seed: number, options: { busy?: (arm: ArmId) => boolean; reducedMotion?: boolean } = {}) {
  const instance = createInstanceState(FLUX_BUNDLE, 'page');
  const idle = subscribeIdlePulse(instance, CONFIG, { random: seededRng(seed * 977 + 5), busy: options.busy });
  const scheduler = new FlourishScheduler(flourishRate(CONFIG.personality), seededRng(seed));
  const seen = Array.from(instance.pulse.times);
  const pulses: { clock: number; arm: ArmId }[] = [];
  const starts: number[] = [];
  const stop = instance.flourish.subscribe(e => starts.push(e.start));
  for (let i = 0; i <= seconds * 60; i++) {
    const t = i / 60;
    scheduler.step(t, options.busy, instance.flourish);
    idle.flush(t + 31.5, options.reducedMotion ?? false);
    instance.pulse.times.forEach((v, k) => {
      if (v !== seen[k]) {
        pulses.push({ clock: v, arm: ARM_IDS[k] });
        seen[k] = v;
      }
    });
  }
  stop();
  idle();
  return { pulses, starts };
}

test('his motion personality is set (spec 7.8, Task 14): settle 1, glideBias 0.55, flourishRate 10, flourishPulse 0.75', () => {
  expect([P.settle, P.glideBias, P.flourishRate, P.flourishPulse]).toEqual([1, 0.55, 10, 0.75]);
  expect(validateBundle(FLUX_BUNDLE).character.personality).toMatchObject({ settle: 1, glideBias: 0.55, flourishRate: 10, flourishPulse: 0.75 });
  // The clamp keeps them.
  expect(CONFIG.personality).toMatchObject({ settle: 1, glideBias: 0.55, flourishRate: 10, flourishPulse: 0.75 });
});

test("the spec's effective values hold once, nothing applied twice: a 0.042 landing overshoot (140% of Nox's 0.03) and a 0.32 s glide", () => {
  // settle can only be 0 to 1 (owner ruling), so the 140% is the base micro.settle.amount, taken whole by settle 1.
  expect(settleScale(P)).toBe(1);
  expect(P.micro.settle.amount * settleScale(P)).toBeCloseTo(0.042, 12);
  expect((P.micro.settle.amount * settleScale(P)) / 0.03).toBeCloseTo(1.4, 12);
  // glideBias 0.55 shortens the glide: the base is restated (0.32 / 0.55) so the effective stroke is the spec's 0.38 / 0.16 / 0.32.
  const timing = strokeTiming(P);
  expect(timing.recovery).toBe(0.38);
  expect(timing.power).toBe(0.16);
  expect(timing.glide).toBeCloseTo(0.32, 3);
  expect(timing.recovery + timing.power + timing.glide).toBeCloseTo(0.86, 3);
});

test('over 600 s of simulated time idle pulses average one every 6 to 10 s (rate 10 and a share of 0.75 give about 8.5)', () => {
  const means: number[] = [];
  for (let seed = 1; seed <= 10; seed++) {
    const { pulses, starts } = play(600, seed);
    // The scheduler waits 0.8 to 4/3 of 6 s: 4.8 to 8 s, so 75 to 125 flourishes in 600 s.
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i] - starts[i - 1], `seed ${seed}`).toBeGreaterThanOrEqual(4.8 - 1 / 60);
      expect(starts[i] - starts[i - 1], `seed ${seed}`).toBeLessThanOrEqual(8 + 1 / 60);
    }
    const mean = 600 / pulses.length;
    expect(mean, `seed ${seed}`).toBeGreaterThanOrEqual(6);
    expect(mean, `seed ${seed}`).toBeLessThanOrEqual(10);
    means.push(mean);
  }
  const average = means.reduce((a, b) => a + b, 0) / means.length;
  expect(average).toBeGreaterThan(7.8);
  expect(average).toBeLessThan(9.2);
});

test('two idle pulses never overlap, and a flourish is never shorter than the pulse it carries', () => {
  expect(FLOURISH_SECONDS).toBeGreaterThan(PULSE_SECONDS);
  for (let seed = 1; seed <= 5; seed++) {
    const { pulses } = play(600, seed);
    for (let i = 1; i < pulses.length; i++) expect(pulses[i].clock - pulses[i - 1].clock).toBeGreaterThan(PULSE_SECONDS);
  }
});

test('the pulse travels alongside the tip unroll: it fires as the flourish starts and has run off the tip before the unroll peaks', () => {
  const { pulses, starts } = play(120, 3);
  expect(pulses.length).toBeGreaterThan(5);
  for (const p of pulses) expect(starts.some(s => Math.abs(s + 31.5 - p.clock) < 1 / 60 + 1e-3), `pulse at ${p.clock}`).toBe(true);
  // The unroll peaks half way through its three seconds; the pulse has gone by then.
  expect(PULSE_SECONDS).toBeLessThan(FLOURISH_SECONDS / 2);
});

test('none fires on a lifting arm, and with reduced motion none fires at all', () => {
  const lifting = new Set<ArmId>(['T1', 'T2', 'T7', 'T8']);
  const { pulses } = play(600, 2, { busy: arm => lifting.has(arm) });
  expect(pulses.length).toBeGreaterThan(30);
  for (const p of pulses) expect(lifting.has(p.arm), p.arm).toBe(false);
  expect(play(600, 2, { reducedMotion: true }).pulses).toEqual([]);
});
