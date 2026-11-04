import { expect, test } from 'vitest';
import { SECURITY_WORLD } from '../../worlds/nox/place/config';
import { LIVE_ELEMENTS, MAX_JELLYFISH } from './live';
import { JELLY, JELLY_GLSL, bellGeometry, filamentGeometry, filamentWave, jellyContraction, jellyCount, jellyDrift, jellyPulse, scatterJellies } from './live/jelly';
import { motionAmount } from './liveMotion';
import type { JellyfishConfig, WorldConfig } from './types';
import { validateWorld } from './validateWorld';
import { WORLD_TIERS, PHONE_WORLD_TIER } from './worldTiers';

const CONFIG: JellyfishConfig = {
  count: { high: 9, medium: 7, low: 4 },
  size: [0.18, 0.32],
  bell: '#c87ae8',
  filament: '#7ae8f0',
  pulse: [2.4, 3.6],
  drift: 0.08,
  region: { min: [-7, -1.5, -16], max: [7, 6, -4] },
};
const times = Array.from({ length: 90 }, (_, i) => i * 0.29);
const phases = [-5, -0.7, 0, 1.3, 3.1, 6.2, 40];
const periods = [CONFIG.pulse[0], 3, CONFIG.pulse[1], 7.5];
const live = motionAmount({ freeze: false, reducedMotion: false });

test('jellyPulse is periodic in its period, and the bell scale stays within [0.85, 1.1]', () => {
  for (const period of periods) {
    for (const phase of phases) {
      for (const t of times) {
        const p = jellyPulse(t, phase, period);
        expect(p.bellScale).toBeGreaterThanOrEqual(0.85 - 1e-12);
        expect(p.bellScale).toBeLessThanOrEqual(1.1 + 1e-12);
        for (const k of [1, 2, 5]) {
          const q = jellyPulse(t + k * period, phase, period);
          expect(q.bellScale).toBeCloseTo(p.bellScale, 9);
          expect(q.rise).toBeCloseTo(p.rise, 9);
        }
      }
    }
  }
  // It does pulse: over a period the bell reaches (nearly) both ends of its range, and it rises.
  const scales = times.map(t => jellyPulse(t, 0.4, 3).bellScale);
  expect(Math.min(...scales)).toBeLessThan(0.87);
  expect(Math.max(...scales)).toBeGreaterThan(1.08);
  expect(Math.max(...times.map(t => jellyPulse(t, 0.4, 3).rise))).toBeGreaterThan(0);
  // The contraction is quick and the relaxing slow: the bell is smallest early in the beat.
  expect(JELLY.contract).toBeLessThan(0.5);
  expect(jellyContraction(0)).toBe(0);
  expect(jellyContraction(JELLY.contract)).toBe(1);
});

test('with reduced motion (or the world frozen) the jellyfish neither rise nor pulse nor drift', () => {
  for (const flags of [{ freeze: false, reducedMotion: true }, { freeze: true, reducedMotion: false }]) {
    const still = motionAmount(flags);
    for (const t of times) {
      for (const phase of phases) {
        const p = jellyPulse(t, phase, 3, still);
        expect(p.rise).toBe(0);
        expect(p.bellScale).toBe(1);
        expect(filamentWave(t, phase, 1, still)).toBe(0);
      }
      expect(jellyDrift(t, 2, CONFIG, still)).toBeCloseTo(2, 9);
    }
  }
});

test('the drift rises slowly and wraps inside the region, so a jellyfish never leaves it', () => {
  const [lo, hi] = [CONFIG.region.min[1], CONFIG.region.max[1]];
  for (const t of times) {
    const y = jellyDrift(t * 7, 1, CONFIG, live);
    expect(y).toBeGreaterThanOrEqual(lo);
    expect(y).toBeLessThan(hi);
  }
  // Upward: a little later it is a little higher (before it wraps).
  expect(jellyDrift(1, 1, CONFIG, live)).toBeCloseTo(1 + CONFIG.drift, 9);
  // Slow: less than half a stage unit a second.
  expect(CONFIG.drift).toBeLessThan(0.5);
});

test('the filaments wave more toward their tips, and not at their roots', () => {
  for (const t of times) {
    expect(filamentWave(t, 0.7, 0, live)).toBe(0);
    expect(Math.abs(filamentWave(t, 0.7, 1, live))).toBeLessThanOrEqual(JELLY.wave + 1e-12);
  }
});

test('jellyfish scatter deterministically inside their region, with sizes and periods from the config', () => {
  const jellies = scatterJellies(CONFIG, LIVE_ELEMENTS.jellyfish);
  expect(jellies).toHaveLength(CONFIG.count.high);
  expect(scatterJellies(CONFIG, LIVE_ELEMENTS.jellyfish)).toEqual(jellies);
  for (const j of jellies) {
    for (const axis of [0, 1, 2] as const) {
      expect(j.position[axis]).toBeGreaterThanOrEqual(CONFIG.region.min[axis]);
      expect(j.position[axis]).toBeLessThanOrEqual(CONFIG.region.max[axis]);
    }
    expect(j.size).toBeGreaterThanOrEqual(CONFIG.size[0]);
    expect(j.size).toBeLessThanOrEqual(CONFIG.size[1]);
    expect(j.period).toBeGreaterThanOrEqual(CONFIG.pulse[0]);
    expect(j.period).toBeLessThanOrEqual(CONFIG.pulse[1]);
  }
  // Out of step: no two pulse together.
  expect(new Set(jellies.map(j => j.phase)).size).toBe(jellies.length);
});

test('the tier decides how many are drawn, through the world tier: 4 at low and on a phone', () => {
  expect(jellyCount(CONFIG, WORLD_TIERS.high)).toBe(9);
  expect(jellyCount(CONFIG, WORLD_TIERS.medium)).toBe(7);
  expect(jellyCount(CONFIG, WORLD_TIERS.low)).toBe(4);
  expect(jellyCount(CONFIG, PHONE_WORLD_TIER)).toBe(4);
});

test('one bell and one filament set, each a single geometry the instances share', () => {
  const shape = LIVE_ELEMENTS.jellyfish;
  const bell = bellGeometry(shape);
  bell.computeBoundingBox();
  // A dome of radius 1 round its rim's centre: the instance scale is the bell's radius.
  expect(bell.boundingBox!.max.x).toBeCloseTo(1, 6);
  expect(bell.boundingBox!.max.y).toBeGreaterThan(0.5);
  const filaments = filamentGeometry(shape);
  // Every filament hangs from the rim (h 0) down to its tip (h 1), `filamentLength` bell radii below.
  const h = filaments.attributes.aFil;
  expect(h.count).toBe(filaments.attributes.position.count);
  filaments.computeBoundingBox();
  expect(filaments.boundingBox!.min.y).toBeCloseTo(-shape.filamentLength, 6);
  expect(filaments.attributes.position.count).toBe(shape.filaments * 2 * (shape.filamentSegments + 1));
});

test('the shader carries the pulse, the drift and the wave, scaled by the motion uniform, with no colour in it', () => {
  for (const term of ['uMotion', 'uTime', 'uDrift', 'aJelly', String(JELLY.contract), String(JELLY.squeeze)]) expect(JELLY_GLSL.common + JELLY_GLSL.instance).toContain(term);
  expect(JELLY_GLSL.common + JELLY_GLSL.instance + JELLY_GLSL.bell + JELLY_GLSL.filament).not.toMatch(/vec3\(\s*[\d.]+\s*,|#[0-9a-f]{6}/i);
});

test('a world with a jellyfish element validates, and each field is checked by name', () => {
  const world: WorldConfig = { ...SECURITY_WORLD, live: { ...SECURITY_WORLD.live, elements: { jellyfish: CONFIG } } };
  expect(validateWorld(world)).toEqual([]);
  const bad = (change: Partial<Record<keyof JellyfishConfig, unknown>>) =>
    validateWorld({ ...world, live: { ...world.live, elements: { jellyfish: { ...CONFIG, ...change } as JellyfishConfig } } }).join('\n');
  expect(bad({ count: { high: 4, medium: 4, low: 6 } })).toContain('live.elements.jellyfish.count.low');
  expect(bad({ count: { high: 9, medium: 10, low: 4 } })).toContain('live.elements.jellyfish.count.medium');
  expect(bad({ count: { high: 9.5, medium: 7, low: 4 } })).toContain('live.elements.jellyfish.count.high');
  expect(bad({ count: { high: MAX_JELLYFISH + 1, medium: 7, low: 4 } })).toContain(`at most ${MAX_JELLYFISH}`);
  expect(bad({ count: { high: 9, low: 4 } })).toContain('live.elements.jellyfish.count.medium');
  expect(bad({ size: [0.3, 0.2] })).toContain('live.elements.jellyfish.size');
  expect(bad({ size: [0, 0.2] })).toContain('live.elements.jellyfish.size');
  expect(bad({ bell: 'pink' })).toContain('live.elements.jellyfish.bell');
  expect(bad({ filament: '#7ae8f' })).toContain('live.elements.jellyfish.filament');
  expect(bad({ pulse: [4, 2] })).toContain('live.elements.jellyfish.pulse');
  expect(bad({ drift: -0.1 })).toContain('live.elements.jellyfish.drift');
  expect(bad({ region: { min: [0, 0, 0], max: [1, 0, 1] } })).toContain('live.elements.jellyfish.region');
  expect(bad({ region: { min: [0, 0, 0] } })).toContain('live.elements.jellyfish.region');
});
