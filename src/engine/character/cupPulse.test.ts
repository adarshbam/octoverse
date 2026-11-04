import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import { NOX_BUNDLE } from '../../worlds/nox/bundle';
import { parseUrlState } from '../behavior/urlState';
import { clampCharacterConfig } from '../config/validate';
import type { CupPulse, SuckerStyle } from '../config/types';
import { createInstanceState } from '../host/instance';
import { PULSE_ARMS, PULSE_IDLE, createPulseTriggers, cupPulseAt, firePulse, reducedLevel, writePulseUniforms } from './cupPulse';
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
