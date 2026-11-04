import { expect, test } from 'vitest';
import { floorHeight } from './seabed';
import { KELP, KELP_SWAY_GLSL, kelpLean, kelpSway, motionAmount } from './liveMotion';
import { LIVE_ELEMENTS, STRAND_ELEMENT_IDS } from './live';
import { scatterStrands, strandGeometry } from './live/strands';
import type { StrandConfig } from './types';

const CONFIG: StrandConfig = { count: 60, height: 3.2, sway: 0.18, color: '#2f6b46' };
const times = Array.from({ length: 80 }, (_, i) => i * 0.37);
const phases = [-6, -1.3, 0, 0.9, 2.2, 5.5, 31];

test('kelpSway is bounded by sway and periodic', () => {
  for (const sway of [0, 0.05, CONFIG.sway, 1.5]) {
    for (const phase of phases) {
      for (const t of times) {
        const lean = kelpSway(t, phase, sway);
        expect(Math.abs(lean)).toBeLessThanOrEqual(sway + 1e-12);
        expect(kelpSway(t + KELP.periodSeconds, phase, sway)).toBeCloseTo(lean, 9);
        expect(kelpSway(t + 3 * KELP.periodSeconds, phase, sway)).toBeCloseTo(lean, 9);
      }
    }
  }
  // It does sway: over a period it reaches (nearly) the whole of its range, both ways.
  const swing = times.map(t => kelpSway(t, 0.4, CONFIG.sway));
  expect(Math.max(...swing)).toBeGreaterThan(CONFIG.sway * 0.9);
  expect(Math.min(...swing)).toBeLessThan(-CONFIG.sway * 0.9);
  // A slow current: a period of several seconds.
  expect(KELP.periodSeconds).toBeGreaterThan(4);
});

test('the lean of a point on a strand grows toward the tip, stays inside sway, and holds still with motion held', () => {
  const live = motionAmount({ freeze: false, reducedMotion: false });
  for (const t of times) {
    for (const h of [0, 0.25, 0.5, 1]) {
      const { x, z } = kelpLean(t, 1.1, CONFIG.sway, h, live);
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(CONFIG.sway + 1e-12);
    }
    expect(kelpLean(t, 1.1, CONFIG.sway, 0, live)).toEqual({ x: 0, z: 0 });
  }
  expect(Math.abs(kelpLean(1.7, 1.1, CONFIG.sway, 1, live).x)).toBeGreaterThan(Math.abs(kelpLean(1.7, 1.1, CONFIG.sway, 0.5, live).x));
  for (const flags of [{ freeze: true, reducedMotion: false }, { freeze: false, reducedMotion: true }]) {
    for (const t of [0, 2.2, 19]) expect(kelpLean(t, 1.1, CONFIG.sway, 1, motionAmount(flags))).toEqual({ x: 0, z: 0 });
  }
});

test('the shader carries the same term, scaled by the motion uniform and the strand height', () => {
  expect(KELP_SWAY_GLSL).toContain('uMotion');
  expect(KELP_SWAY_GLSL).toContain('uSway');
  expect(KELP_SWAY_GLSL).toContain(String(KELP.speed));
  // No colour in it: the strand's colour is config.
  expect(KELP_SWAY_GLSL).not.toMatch(/vec3\(\s*[\d.]+\s*,/);
});

test('the strand elements are kelp and seagrass, seagrass shorter in blade', () => {
  expect(STRAND_ELEMENT_IDS).toEqual(['kelp', 'seagrass']);
  expect(LIVE_ELEMENTS.seagrass.width).toBeLessThan(LIVE_ELEMENTS.kelp.width);
});

test('a strand is a tapered ribbon one unit tall, so the instance scale sets its height', () => {
  for (const id of STRAND_ELEMENT_IDS) {
    const shape = LIVE_ELEMENTS[id];
    const geometry = strandGeometry(shape);
    const pos = geometry.attributes.position;
    expect(pos.count).toBe(2 * (shape.segments + 1));
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect([box.min.y, box.max.y]).toEqual([0, 1]);
    expect(box.max.x).toBeCloseTo(shape.width / 2, 6);
    // It tapers: the tip is narrower than the root.
    expect(Math.abs(pos.getX(pos.count - 1))).toBeLessThan(Math.abs(pos.getX(1)));
    // The height along the strand (its `h`) is its y, in the attribute the shader reads.
    expect(geometry.index!.count).toBe(shape.segments * 6);
  }
});

test('strands scatter deterministically on both flanks, off the corridor, standing on the seabed', () => {
  const floorY = -2.45;
  for (const id of STRAND_ELEMENT_IDS) {
    const shape = LIVE_ELEMENTS[id];
    const strands = scatterStrands(CONFIG, shape, floorY);
    expect(strands).toHaveLength(CONFIG.count);
    expect(scatterStrands(CONFIG, shape, floorY)).toEqual(strands);
    expect(strands.some(s => s.x < 0) && strands.some(s => s.x > 0)).toBe(true);
    for (const s of strands) {
      expect(Math.abs(s.x)).toBeGreaterThanOrEqual(shape.clear);
      expect(s.height).toBeGreaterThan(0);
      expect(s.height).toBeLessThanOrEqual(CONFIG.height);
      expect(s.y).toBeCloseTo(floorHeight(s.x, s.z, floorY) - 0.02, 9);
    }
  }
  // Kelp and seagrass do not stand in the same places.
  expect(scatterStrands(CONFIG, LIVE_ELEMENTS.kelp, floorY)[0]).not.toEqual(scatterStrands(CONFIG, LIVE_ELEMENTS.seagrass, floorY)[0]);
  expect(scatterStrands({ ...CONFIG, count: 0 }, LIVE_ELEMENTS.kelp, floorY)).toEqual([]);
});
