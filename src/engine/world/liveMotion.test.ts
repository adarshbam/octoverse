import { expect, test } from 'vitest';
import { CORAL_SWAY, LAVA_PULSE, coralSway, lavaPulse, motionAmount } from './liveMotion';

test('the floor lava pulses slowly, and stops under reduced motion and freeze', () => {
  // A slow beat: one swing takes several seconds.
  expect(LAVA_PULSE.periodSeconds).toBeGreaterThan(5);
  expect(LAVA_PULSE.periodSeconds).toBeLessThan(10);
  const live = motionAmount({ freeze: false, reducedMotion: false });
  const values = Array.from({ length: 100 }, (_, i) => lavaPulse(i * 0.1, 1, 2, live));
  expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(LAVA_PULSE.depth * 1.5);
  for (const flags of [{ freeze: true, reducedMotion: false }, { freeze: false, reducedMotion: true }, { freeze: true, reducedMotion: true }]) {
    const still = motionAmount(flags);
    expect(still).toBe(0);
    const held = [0, 1.3, 6, 40].map(t => lavaPulse(t, 1, 2, still));
    expect(new Set(held).size).toBe(1);
    expect(held[0]).toBeCloseTo(LAVA_PULSE.mean, 12);
  }
});

test('the coral sways by a small amount, and holds still under reduced motion and freeze', () => {
  expect(CORAL_SWAY.x).toBeLessThanOrEqual(0.06);
  const live = motionAmount({ freeze: false, reducedMotion: false });
  const moved = [0, 1, 2, 3].map(t => coralSway(t, 0.7, 1.2, 1, live).x);
  expect(Math.max(...moved) - Math.min(...moved)).toBeGreaterThan(0.01);
  expect(Math.abs(coralSway(4, 0.7, 1.2, 1, live).x)).toBeLessThanOrEqual(CORAL_SWAY.x);
  for (const flags of [{ freeze: true, reducedMotion: false }, { freeze: false, reducedMotion: true }]) {
    const still = motionAmount(flags);
    for (const t of [0, 1.7, 6, 33]) expect(coralSway(t, 0.7, 1.2, 1, still)).toEqual({ x: 0, z: 0 });
  }
});

test('the shaders carry the same terms, each scaled by the motion uniform', async () => {
  const { LAVA_PULSE_GLSL, CORAL_SWAY_GLSL } = await import('./liveMotion');
  expect(LAVA_PULSE_GLSL).toContain('uMotion');
  expect(CORAL_SWAY_GLSL).toContain('uMotion');
});
