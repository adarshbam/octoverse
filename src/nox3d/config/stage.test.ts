import { expect, test } from 'vitest';
import { STAGE_HALF, viewWindow } from './stage';

test('a zoomed view is a window onto the unmoved stage frame, centred on its box', () => {
  const w = viewWindow([-1, 0.5, 1, -1.5], 800, 600);
  const pxPerUnit = 300;
  expect(w.fullHeight).toBeCloseTo(2 * STAGE_HALF * pxPerUnit, 6);
  expect(w.fullWidth / w.fullHeight).toBeCloseTo(800 / 600, 9);
  // The box centre (0, -0.5) sits at the middle of the canvas.
  expect(w.fullWidth / 2 + 0 * pxPerUnit - w.x).toBeCloseTo(400, 6);
  expect(w.fullHeight / 2 + 0.5 * pxPerUnit - w.y).toBeCloseTo(300, 6);
  // The box's height fills the canvas.
  expect(w.fullHeight / 2 - 0.5 * pxPerUnit - w.y).toBeCloseTo(0, 6);
  expect([w.width, w.height]).toEqual([800, 600]);
});
