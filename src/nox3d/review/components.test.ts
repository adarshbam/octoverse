import { expect, test } from 'vitest';
import { BACK_VIEW_YAWS, COMPONENT_VIEWS, hqPixel } from './components';

test('every component box lies inside the panel and has positive area', () => {
  const entries = Object.entries(COMPONENT_VIEWS);
  expect(entries.length).toBe(12);
  for (const [id, { box: [x0, y0, x1, y1] }] of entries) {
    expect(x0 < x1 && y0 > y1, id).toBe(true);
    for (const x of [x0, x1]) expect(Math.abs(x), id).toBeLessThanOrEqual(2.53);
    for (const y of [y0, y1]) expect(Math.abs(y), id).toBeLessThanOrEqual(2.52);
  }
});

test('the back view turns the body front, three-quarter, side and back', () => {
  expect(BACK_VIEW_YAWS).toEqual([0, 45, 90, 180]);
  expect(COMPONENT_VIEWS.back.label).toMatch(/back/i);
});

test('the high-quality panel 2 is registered to world units by the eyes', () => {
  // The left eye's big catchlight: world (-0.378, -0.567) in our intro render, (706.3, 611.4) px in the HQ panel.
  const p = hqPixel(-0.378, -0.567);
  expect(Math.abs(p.x - 706.3)).toBeLessThan(1);
  expect(Math.abs(p.y - 611.4)).toBeLessThan(1);
});
