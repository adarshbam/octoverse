import { expect, test } from 'vitest';
import { HOVER_EASE_S, cameraHover, easeHover, hoverTarget, worldHover } from './cameraHover';

test('hover amounts by stage', () => {
  expect(hoverTarget('intro', false)).toBe(1);
  expect(hoverTarget('entering', false)).toBe(1);
  expect(hoverTarget('overview', false)).toBe(0.5);
  expect(hoverTarget('techFocus', false)).toBe(0);
  expect(hoverTarget('detail', false)).toBe(0);
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

test('hover eases between amounts within 0.6 s', () => {
  let amount = 1;
  for (let i = 0; i < 36; i++) amount = easeHover(amount, 0, 1 / 60); // 0.6 s
  expect(amount).toBe(0);
  expect(HOVER_EASE_S).toBe(0.6);
  // and it does not jump at once
  expect(easeHover(1, 0, 1 / 60)).toBeGreaterThan(0.9);
  // and back up
  expect(easeHover(0, 1, 0.3)).toBeCloseTo(0.5, 12);
});

test('reduced motion has no hover', () => {
  for (const stage of ['entering', 'intro', 'overview', 'techFocus', 'detail'] as const) expect(hoverTarget(stage, true)).toBe(0);
});

// Hard-coded from cameraHover before the drift took its pace and amount from the world (Task 5).
test('Nox\'s drift (pace 1, amount 1) is today\'s output to the bit', () => {
  const nox = { amount: 1, pace: 1 };
  const full = worldHover(10, 1, nox);
  expect(full).toEqual(cameraHover(10 * 1, 1));
  expect(full.offset[0]).toBeCloseTo(0.6711346909590481, 14);
  expect(full.offset[1]).toBeCloseTo(0.12821396407014893, 14);
  expect(full.offset[2]).toBeCloseTo(1.0694488320737225, 14);
  expect(full.look[0]).toBeCloseTo(0.223711563653016, 14);
  const half = worldHover(33.7, 0.5, nox);
  expect(half.offset[0]).toBeCloseTo(0.4476159342682868, 14);
  expect(half.offset[1]).toBeCloseTo(0.06467896316934033, 14);
  expect(half.offset[2]).toBeCloseTo(-0.321455887029052, 14);
  expect(half.look[0]).toBeCloseTo(0.14920531142276225, 14);
  expect(half.look[1]).toBeCloseTo(-0.025, 14);
});

test('a world\'s pace scales the drift\'s clock and its amount the stage\'s amount', () => {
  expect(worldHover(33.7, 0.8, { amount: 1, pace: 0.5 })).toEqual(cameraHover(33.7 * 0.5, 0.8));
  expect(worldHover(33.7, 0.8, { amount: 0.5, pace: 1 })).toEqual(cameraHover(33.7, 0.4));
  // A slower pace reaches the same place later: the drift at 2t on a half-pace world is the drift at t.
  expect(worldHover(20, 1, { amount: 1, pace: 0.5 })).toEqual(worldHover(10, 1, { amount: 1, pace: 1 }));
  // No amount, no drift.
  expect(worldHover(20, 1, { amount: 0, pace: 1 }).offset).toEqual([0, 0, 0]);
});
