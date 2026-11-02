import { expect, test } from 'vitest';
import { HOVER_EASE_S, cameraHover, easeHover, hoverTarget } from './cameraHover';

test('hover amounts by stage', () => {
  expect(hoverTarget('intro', false, false)).toBe(1);
  expect(hoverTarget('entering', false, false)).toBe(1);
  expect(hoverTarget('overview', false, false)).toBe(0.5);
  expect(hoverTarget('techFocus', false, false)).toBe(0);
  expect(hoverTarget('detail', false, false)).toBe(0);
  const { offset, look } = cameraHover(10, 1);
  expect(offset[0]).toBeCloseTo(0.9 * Math.sin(2.3), 12);
  expect(offset[1]).toBeCloseTo(0.3 * Math.sin(1.7 + 1), 12);
  expect(offset[2]).toBeCloseTo(1.2 * Math.sin(1.1), 12);
  expect(look[0]).toBeCloseTo(0.3 * Math.sin(2.3), 12);
  expect(look[1]).toBeCloseTo(-0.05, 12);
  expect(look[2]).toBe(-24);
  expect(cameraHover(10, 0.5).offset[0]).toBeCloseTo(0.45 * Math.sin(2.3), 12);
  expect(cameraHover(10, 0).offset).toEqual([0, 0, 0]);
  expect(cameraHover(10, 0).look).toEqual([0, 0, -24]);
});

test('hover eases to still within 0.6 s when a bubble is hovered', () => {
  const target = hoverTarget('overview', true, false);
  expect(target).toBe(0);
  let amount = 1;
  for (let i = 0; i < 36; i++) amount = easeHover(amount, target, 1 / 60); // 0.6 s
  expect(amount).toBe(0);
  expect(HOVER_EASE_S).toBe(0.6);
  // and it does not jump at once
  expect(easeHover(1, 0, 1 / 60)).toBeGreaterThan(0.9);
  // and back up as the bubble is left
  expect(easeHover(0, 1, 0.3)).toBeCloseTo(0.5, 12);
});

test('reduced motion has no hover', () => {
  for (const stage of ['entering', 'intro', 'overview', 'techFocus', 'detail'] as const) expect(hoverTarget(stage, false, true)).toBe(0);
});
