import { expect, test } from 'vitest';
import { coreGlowFacing, mantleSqueeze } from './entrance';

const times = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
/** A head turned near profile (Entrance v1's 1.4 rad, traced from panel 1). */
const SIDE_ON = 1.4;

test('a jet pulse squeezes the mantle by 6%', () => {
  expect(mantleSqueeze(1)).toBeCloseTo(0.94, 9);
  expect(mantleSqueeze(0)).toBe(1);
});

test('the glow card before the chin fades as the head turns side-on, so it never shows edge-on', () => {
  expect(coreGlowFacing(0)).toBe(1);
  expect(coreGlowFacing(SIDE_ON)).toBeLessThan(0.05);
  let last = Infinity;
  for (const yaw of times(0, 1400, 10).map(m => (m / 1400) * SIDE_ON)) {
    const facing = coreGlowFacing(yaw);
    expect(facing).toBeLessThanOrEqual(last);
    last = facing;
  }
});
