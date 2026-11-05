import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { expect, test, vi } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import { NOX_BUNDLE } from '../../worlds/nox/bundle';
import { FlourishScheduler } from '../behavior/flourish';
import { parseUrlState } from '../behavior/urlState';
import { clampCharacterConfig } from '../config/validate';
import { ARM_IDS, type ArmId, type CharacterConfig, type CupPulse, type SuckerStyle } from '../config/types';
import { createInstanceState } from '../host/instance';
import { seededRng } from '../motion/micro';
import { type WorldBundle, validateBundle } from '../types/bundle';
import { PULSE_ARMS, PULSE_IDLE, createPulseTriggers, cupPulseAt, firePulse, reducedLevel, subscribeIdlePulse, writePulseUniforms } from './cupPulse';
import { createSkinUniforms } from './skinMaterial';
import { createSuckerMaterial } from './suckerMaterial';

// Flux's pulse (spec 2.4, 7.5): 0.75 s root to tip, a band 0.17 of the arm long. The engine's tests
// may not import another world, so the values are written here.
const FLUX: CupPulse = { speed: 1.33, wavelength: 0.17, strength: 0.6, colours: ['#30e8ff', '#b8a0ff', '#f3afef'] };

const sha = (text: string) => createHash('sha256').update(text).digest('hex');

test("with Flux's config the band crosses the arm (arc 0.05 to 0.95, level above 0.5) in 0.6 to 0.9 s", () => {
  const firstLit = (arc: number) => {
    for (let since = 0; since < 3; since += 0.0005) if (cupPulseAt(arc, since, FLUX).level > 0.5) return since;
    return Infinity;
  };
  const crossing = firstLit(0.95) - firstLit(0.05);
  expect(crossing).toBeGreaterThanOrEqual(0.6);
  expect(crossing).toBeLessThanOrEqual(0.9);
});

test('on a 24-cup arm, 3 to 5 cups are lit above half at any time mid-travel', () => {
  const arcs = Array.from({ length: 24 }, (_, i) => (i + 0.5) / 24);
  // Mid-travel: the whole band is on the arm (its tail past the root, its head short of the tip).
  const from = FLUX.wavelength / FLUX.speed;
  const to = 1 / FLUX.speed;
  for (let since = from; since <= to; since += 0.002) {
    const lit = arcs.filter(arc => cupPulseAt(arc, since, FLUX).level > 0.5).length;
    expect(lit, `since ${since.toFixed(3)}`).toBeGreaterThanOrEqual(3);
    expect(lit, `since ${since.toFixed(3)}`).toBeLessThanOrEqual(5);
  }
});

test('the level is 0 before the pulse fires and once it has run off the tip; 0 to 1 between', () => {
  const gone = 1 / FLUX.speed + FLUX.wavelength / FLUX.speed;
  for (let arc = 0; arc <= 1; arc += 0.01) {
    for (const since of [-5, -0.5, -0.001]) expect(cupPulseAt(arc, since, FLUX).level).toBe(0);
    for (const since of [gone + 0.001, gone + 1, 1e4]) expect(cupPulseAt(arc, since, FLUX).level).toBe(0);
    for (let since = 0; since < gone; since += 0.01) {
      const { level, hue } = cupPulseAt(arc, since, FLUX);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThanOrEqual(1);
    }
  }
});

test('cyan leads, lavender is the middle and pink the tail: the hue runs 0 at the head to 1 at the tail', () => {
  const since = 0.5;
  const head = FLUX.speed * since;
  const near = cupPulseAt(head - 0.02 * FLUX.wavelength, since, FLUX).hue;
  const middle = cupPulseAt(head - 0.5 * FLUX.wavelength, since, FLUX).hue;
  const tail = cupPulseAt(head - 0.95 * FLUX.wavelength, since, FLUX).hue;
  expect(near).toBeLessThan(0.1);
  expect(middle).toBeCloseTo(0.5, 5);
  expect(tail).toBeGreaterThan(0.9);
});

test('firePulse starts a pulse on an idle arm, refuses one under half its travel, and restarts one past it', () => {
  const t = createPulseTriggers();
  expect(t.times).toHaveLength(PULSE_ARMS);
  expect(Array.from(t.times).every(v => v === -Infinity)).toBe(true);
  expect(firePulse(t, 'T2', 10, FLUX)).toBe(true);
  expect(t.times[1]).toBe(10);
  // 20% of its travel: refused, nothing changes.
  const before = Array.from(t.times);
  expect(firePulse(t, 'T2', 10 + 0.2 / FLUX.speed, FLUX)).toBe(false);
  expect(Array.from(t.times)).toEqual(before);
  // 60% of its travel: restarted from now.
  const now = 10 + 0.6 / FLUX.speed;
  expect(firePulse(t, 'T2', now, FLUX)).toBe(true);
  expect(t.times[1]).toBe(Math.fround(now));
  // Another arm is its own.
  expect(firePulse(t, 'T7', now, FLUX)).toBe(true);
  expect(t.times[6]).toBe(Math.fround(now));
  expect(t.times[0]).toBe(-Infinity);
});

test('reduced motion: the whole row lights for 0 to 0.3 s and then is dark', () => {
  for (const since of [0, 0.1, 0.29, 0.3]) expect(reducedLevel(since)).toBe(1);
  for (const since of [-0.1, 0.301, 0.5, 10]) expect(reducedLevel(since)).toBe(0);
});

// Nox's cup programs and uniforms before the pulse existed (taken at 90eabb0, before the edit), and
// a frill style's (Veyra's kind of cup) likewise.
const NOX_CUP_VERTEX_SHA256 = 'c44635a27e08f86d9307ecf95ea234ff68611bc9940179a91e0e63d9b47a2525';
const NOX_CUP_FRAGMENT_SHA256 = '952d44988fef3012033161543d82f21f3a0aea6976c23cf7ae03d1fd6b98c201';
const NOX_CUP_UNIFORMS = 'uEdge,uBody,uHot,uHollow,uKeyDir,uKeyLight,uUnderglow,uSkyLight,uGroundLight,uHaze,uHazeColor,uBoost,uFace,uVeil,uVeilColor,uFlare';
const FRILL_CUP_VERTEX_SHA256 = '711191d91a72c2d699115e14294aa9878a2d97410addd079210411a6410588de';
const FRILL_CUP_FRAGMENT_SHA256 = '103707a3e87fce09ba3aa8608ba5c2b08a02b620c9a13359523a91800f2d6bc3';
const FRILL: SuckerStyle = { rimWidth: 0.22, scallop: 0.6, edge: '#e0dc9c', rim: '#f6f0ba', hollow: '#6a9478', glow: 1.3 };

test('a Nox config (no pulse) gives the sucker programs and uniforms of the pre-change snapshot; so does strength 0', () => {
  const skin = createSkinUniforms(NOX);
  const config = clampCharacterConfig(NOX);
  expect(config.suckers.pulse).toBeUndefined();
  for (const cups of [createSuckerMaterial(NOX.palette, skin, config.suckers.style, config.suckers.pulse), createSuckerMaterial(NOX.palette, skin, undefined, { ...FLUX, strength: 0 })]) {
    expect(sha(cups.vertexShader)).toBe(NOX_CUP_VERTEX_SHA256);
    expect(sha(cups.fragmentShader)).toBe(NOX_CUP_FRAGMENT_SHA256);
    expect(Object.keys(cups.uniforms).join(',')).toBe(NOX_CUP_UNIFORMS);
  }
  // A frill without a pulse (Veyra) is unchanged too.
  const frill = createSuckerMaterial(NOX.palette, skin, FRILL);
  expect(sha(frill.vertexShader)).toBe(FRILL_CUP_VERTEX_SHA256);
  expect(sha(frill.fragmentShader)).toBe(FRILL_CUP_FRAGMENT_SHA256);
  expect(Object.keys(frill.uniforms).some(k => k.startsWith('uPulse'))).toBe(false);
});

test('a pulse adds one term to the cup programs: eight trigger times, three colours from the config, no colour in its text', () => {
  const skin = createSkinUniforms(NOX);
  for (const style of [undefined, FRILL]) {
    const cups = createSuckerMaterial(NOX.palette, skin, style, FLUX);
    expect(cups.uniforms.uPulseTimes.value).toHaveLength(PULSE_ARMS);
    expect((cups.uniforms.uPulseColours.value as THREE.Color[]).map(c => c.getHex())).toEqual(FLUX.colours.map(c => new THREE.Color(c).getHex()));
    expect(cups.uniforms.uPulse.value.toArray()).toEqual([FLUX.speed, FLUX.wavelength, FLUX.strength, 0]);
    expect(cups.vertexShader).toContain(`uniform float uPulseTimes[${PULSE_ARMS}];`);
    expect(cups.vertexShader).toContain('uPulseTimes[int(aCup.x + 0.5)]');
    expect(cups.fragmentShader).toContain('uniform vec3 uPulseColours[3];');
    const plain = createSuckerMaterial(NOX.palette, skin, style);
    const added = [...cups.vertexShader.split('\n').filter(l => !plain.vertexShader.includes(l)), ...cups.fragmentShader.split('\n').filter(l => !plain.fragmentShader.includes(l))];
    expect(added.length).toBeGreaterThan(6);
    for (const line of added) {
      expect(line).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(line).not.toMatch(/vec[34]\(\s*[-.\d]+\s*,/);
    }
  }
});

test('writing the pulse uniforms updates them in place: idle arms read far in the past, never -Infinity', () => {
  const cups = createSuckerMaterial(NOX.palette, createSkinUniforms(NOX), FRILL, FLUX);
  const times = cups.uniforms.uPulseTimes.value as Float32Array;
  const t = createPulseTriggers();
  firePulse(t, 'T3', 2, FLUX);
  writePulseUniforms(cups.uniforms, t, 2.4, false);
  expect(cups.uniforms.uPulseTimes.value).toBe(times);
  expect(Array.from(times)).toEqual([PULSE_IDLE, PULSE_IDLE, 2, PULSE_IDLE, PULSE_IDLE, PULSE_IDLE, PULSE_IDLE, PULSE_IDLE]);
  expect(cups.uniforms.uPulseClock.value).toBe(2.4);
  expect(cups.uniforms.uPulse.value.w).toBe(0);
  writePulseUniforms(cups.uniforms, t, 3, true);
  expect(cups.uniforms.uPulseTimes.value).toBe(times);
  expect(cups.uniforms.uPulse.value.w).toBe(1);
  // A review still: its arm fired at 0 and the clock at its moment; the triggers are left as they were.
  writePulseUniforms(cups.uniforms, t, 3, false, { arm: 'T5', seconds: 0.4 });
  expect(Array.from(times)).toEqual([PULSE_IDLE, PULSE_IDLE, 2, PULSE_IDLE, 0, PULSE_IDLE, PULSE_IDLE, PULSE_IDLE]);
  expect(cups.uniforms.uPulseClock.value).toBe(0.4);
  expect(t.times[4]).toBe(-Infinity);
  // An idle arm's cups are dark at any clock the page can reach.
  expect(cupPulseAt(0.5, 1e5 - PULSE_IDLE, FLUX).level).toBe(0);
});

test('createInstanceState twice gives distinct pulse.times arrays, all idle', () => {
  const a = createInstanceState(NOX_BUNDLE, 'page');
  const b = createInstanceState(NOX_BUNDLE, 'page');
  expect(a.pulse.times).not.toBe(b.pulse.times);
  firePulse(a.pulse, 'T1', 1, FLUX);
  expect(b.pulse.times[0]).toBe(-Infinity);
  expect(Array.from(b.pulse.times).every(v => v === -Infinity)).toBe(true);
});

test('the config clamp keeps a pulse in range, colours that do not parse read the cups own, and absent stays absent', () => {
  const pulse = (p: unknown) => clampCharacterConfig({ ...NOX, suckers: { ...NOX.suckers, pulse: p as CupPulse } }).suckers.pulse!;
  expect(pulse(FLUX)).toEqual(FLUX);
  const wild = pulse({ speed: 99, wavelength: -1, strength: 7, colours: ['nope', '#b8a0ff'] });
  expect(wild.speed).toBe(5);
  expect(wild.wavelength).toBe(0.02);
  expect(wild.strength).toBe(1);
  expect(wild.colours).toEqual([NOX.palette.suckerHot, '#b8a0ff', NOX.palette.suckerHot]);
  const bad = pulse({ speed: Number.NaN, wavelength: 'x', strength: undefined, colours: undefined });
  expect(bad).toEqual({ speed: 1.33, wavelength: 0.17, strength: 0, colours: [NOX.palette.suckerHot, NOX.palette.suckerHot, NOX.palette.suckerHot] });
  // Nox (no style, no pulse) passes through as it was.
  expect(clampCharacterConfig(NOX).suckers).toBe(NOX.suckers);
});

test('the review switch ?pulse=<arm>@<seconds> names an arm and a moment; anything else is ignored', () => {
  expect(parseUrlState('?world=flux&stage=intro&freeze&pulse=t2@0.35').pulse).toEqual({ arm: 'T2', seconds: 0.35 });
  expect(parseUrlState('?pulse=T8@1').pulse).toEqual({ arm: 'T8', seconds: 1 });
  for (const bad of ['?pulse=t9@0.4', '?pulse=t2', '?pulse=t2@x', '?pulse=@0.4', '?pulse']) expect(parseUrlState(bad).pulse).toBeUndefined();
});

// --- The idle pulse (Flux Task 14, spec 2.4 and 7.8): a share of the idle flourishes pulse their arm ---------

/** Flux's personality as far as the idle pulse reads it (the engine's tests may not import another world). */
const FLUX_CONFIG = { ...NOX, personality: { ...NOX.personality, flourishRate: 10, flourishPulse: 0.75 }, suckers: { ...NOX.suckers, pulse: FLUX } } as CharacterConfig;
const withShare = (flourishPulse: number | undefined) => ({ ...FLUX_CONFIG, personality: { ...FLUX_CONFIG.personality, flourishPulse } }) as CharacterConfig;
const PULSE_SECONDS = (1 + FLUX.wavelength) / FLUX.speed;

/**
 * `seconds` of 60 fps frames: the flourish scheduler is stepped on its own clock (`t`), the pulse
 * clock is the frame clock, which runs from a different origin (+100) as the R3F one does. Returns
 * each idle pulse's frame-clock time and arm, taken from the triggers as they change.
 */
function idleRun(opts: { seconds?: number; seed?: number; pulseSeed?: number; busy?: (arm: ArmId) => boolean; reducedMotion?: boolean; cfg?: CharacterConfig } = {}) {
  const { seconds = 600, seed = 1, pulseSeed = 7, busy, reducedMotion = false, cfg = FLUX_CONFIG } = opts;
  const instance = createInstanceState(NOX_BUNDLE, 'page');
  const idle = subscribeIdlePulse(instance, cfg, { random: seededRng(pulseSeed), busy });
  const scheduler = new FlourishScheduler(cfg.personality.flourishRate ?? 0, seededRng(seed));
  const seen = Array.from(instance.pulse.times);
  const pulses: { clock: number; arm: ArmId }[] = [];
  const flourishes: { arm: ArmId; start: number }[] = [];
  const unsubscribe = instance.flourish.subscribe(e => flourishes.push(e));
  for (let i = 0; i <= seconds * 60; i++) {
    const t = i / 60;
    scheduler.step(t, busy, instance.flourish);
    idle.flush(t + 100, reducedMotion);
    instance.pulse.times.forEach((v, k) => {
      if (v !== seen[k]) {
        pulses.push({ clock: v, arm: ARM_IDS[k] });
        seen[k] = v;
      }
    });
  }
  unsubscribe();
  idle();
  return { pulses, flourishes, instance };
}

test('flourishPulse 0 or absent subscribes nothing: Nox and Veyra are untouched', () => {
  const none = [NOX as CharacterConfig, withShare(0), withShare(undefined), { ...FLUX_CONFIG, suckers: NOX.suckers } as CharacterConfig];
  for (const cfg of none) {
    const instance = createInstanceState(NOX_BUNDLE, 'page');
    const subscribe = vi.spyOn(instance.flourish, 'subscribe');
    const idle = subscribeIdlePulse(instance, cfg);
    expect(subscribe).not.toHaveBeenCalled();
    instance.flourish.emit({ arm: 'T3', start: 5 });
    idle.flush(6);
    expect(Array.from(instance.pulse.times).every(v => v === -Infinity)).toBe(true);
    expect(() => idle()).not.toThrow();
  }
  // With a share and a pulse set, it does subscribe.
  const instance = createInstanceState(NOX_BUNDLE, 'page');
  const subscribe = vi.spyOn(instance.flourish, 'subscribe');
  subscribeIdlePulse(instance, FLUX_CONFIG)();
  expect(subscribe).toHaveBeenCalledTimes(1);
});

test('over 600 s of flourishes at rate 10 and share 0.75, idle pulses average one every 6 to 10 s (about 8.5)', () => {
  const means: number[] = [];
  for (let seed = 1; seed <= 12; seed++) {
    const { pulses, flourishes } = idleRun({ seed, pulseSeed: seed * 31 });
    expect(pulses.length, `seed ${seed}`).toBeGreaterThan(0);
    // 600 s of 4.8 to 8 s waits: 75 to 125 flourishes, about 94; a share of them pulse.
    expect(flourishes.length, `seed ${seed}`).toBeGreaterThanOrEqual(75);
    expect(flourishes.length, `seed ${seed}`).toBeLessThanOrEqual(125);
    const mean = 600 / pulses.length;
    expect(mean, `seed ${seed}`).toBeGreaterThanOrEqual(6);
    expect(mean, `seed ${seed}`).toBeLessThanOrEqual(10);
    means.push(mean);
  }
  expect(means.reduce((a, b) => a + b, 0) / means.length).toBeGreaterThan(7.8);
  expect(means.reduce((a, b) => a + b, 0) / means.length).toBeLessThan(9.2);
});

test('the pulse fires on the flourish arm, on the frame clock the cups read (not the scheduler clock), in the frame it starts', () => {
  const { pulses, flourishes } = idleRun({ seconds: 120 });
  for (const p of pulses) {
    const f = flourishes.find(e => Math.abs(e.start + 100 - p.clock) < 1 / 60 + 1e-3);
    expect(f, `pulse at ${p.clock}`).toBeDefined();
    expect(f!.arm).toBe(p.arm);
  }
  // About three in four of them pulse; the rest are the unroll alone.
  expect(pulses.length / flourishes.length).toBeGreaterThan(0.6);
  expect(pulses.length / flourishes.length).toBeLessThan(0.9);
});

test('no two idle pulses overlap: each is a whole band-length after the last, on any arm', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const { pulses } = idleRun({ seed });
    for (let i = 1; i < pulses.length; i++) expect(pulses[i].clock - pulses[i - 1].clock, `seed ${seed}`).toBeGreaterThan(PULSE_SECONDS);
  }
  // And firePulse's own guard holds when a second event arrives under half way along the same arm.
  const instance = createInstanceState(NOX_BUNDLE, 'page');
  const idle = subscribeIdlePulse(instance, withShare(1));
  instance.flourish.emit({ arm: 'T4', start: 0 });
  idle.flush(50);
  instance.flourish.emit({ arm: 'T4', start: 0.1 });
  idle.flush(50 + 0.2 / FLUX.speed);
  expect(instance.pulse.times[3]).toBe(50);
});

test('none fires on an arm that is lifting (busy), whether the scheduler picked it or the arm became busy since', () => {
  const lifting = new Set<ArmId>(['T1', 'T2', 'T8']);
  const { pulses, flourishes } = idleRun({ busy: arm => lifting.has(arm) });
  expect(pulses.length).toBeGreaterThan(30);
  for (const p of pulses) expect(lifting.has(p.arm), p.arm).toBe(false);
  for (const f of flourishes) expect(lifting.has(f.arm), f.arm).toBe(false);
  // An event for an arm that went busy after the scheduler chose it is dropped, not fired later.
  const instance = createInstanceState(NOX_BUNDLE, 'page');
  let busy = false;
  const idle = subscribeIdlePulse(instance, withShare(1), { busy: () => busy });
  instance.flourish.emit({ arm: 'T5', start: 1 });
  busy = true;
  idle.flush(10);
  busy = false;
  idle.flush(11);
  expect(instance.pulse.times[4]).toBe(-Infinity);
});

test('with reduced motion no idle pulse fires, and an event heard then does not fire later', () => {
  expect(idleRun({ reducedMotion: true }).pulses).toEqual([]);
  const instance = createInstanceState(NOX_BUNDLE, 'page');
  const idle = subscribeIdlePulse(instance, withShare(1));
  instance.flourish.emit({ arm: 'T6', start: 1 });
  idle.flush(2, true);
  idle.flush(3, false);
  expect(instance.pulse.times[5]).toBe(-Infinity);
});

test('the share is the probability per flourish: 1 pulses every one, and the unsubscribe stops it', () => {
  const all = idleRun({ seconds: 300, cfg: withShare(1) });
  expect(all.pulses.length).toBe(all.flourishes.length);
  const instance = createInstanceState(NOX_BUNDLE, 'page');
  const idle = subscribeIdlePulse(instance, withShare(1));
  idle();
  instance.flourish.emit({ arm: 'T2', start: 1 });
  idle.flush(2);
  expect(instance.pulse.times[1]).toBe(-Infinity);
});

test('flourishPulse is clamped to 0 to 1 and absent stays absent; the bundle refuses it out of range by name', () => {
  const clamp = (v: unknown) => clampCharacterConfig({ ...NOX, personality: { ...NOX.personality, flourishPulse: v as number } }).personality.flourishPulse;
  expect(clamp(0.75)).toBe(0.75);
  expect(clamp(7)).toBe(1);
  expect(clamp(-2)).toBe(0);
  expect(clamp(Number.NaN)).toBe(0);
  expect(clampCharacterConfig(NOX).personality.flourishPulse).toBeUndefined();
  const bundle = (flourishPulse: unknown) => ({ ...NOX_BUNDLE, character: { ...NOX_BUNDLE.character, personality: { ...NOX_BUNDLE.character.personality, flourishPulse } } }) as unknown as WorldBundle;
  for (const ok of [0, 0.75, 1]) expect(() => validateBundle(bundle(ok))).not.toThrow();
  for (const bad of [-0.1, 1.2, Number.NaN, Infinity, '0.75']) {
    expect(() => validateBundle(bundle(bad)), String(bad)).toThrow(/character\.personality\.flourishPulse/);
  }
});

test('the character wires the idle pulse to the frame clock (Octopus.tsx), with the unroll left to play', () => {
  const octopus = readFileSync(new URL('./Octopus.tsx', import.meta.url), 'utf8');
  expect(octopus).toMatch(/subscribeIdlePulse\(instance, config, \{ busy: armBusy \}\)/);
  expect(octopus).toMatch(/\.flush\(state\.clock\.elapsedTime, reducedMotion\)/);
  // The unroll is not suppressed: the flourish layer's own lines are as they were.
  expect(octopus).toMatch(/yieldedUnroll\(flourishUnroll\(m\.flourishClock, playing\.start\), m\.holdWeight\[playing\.index\]\)/);
});
