import { expect, test } from 'vitest';
import type { TetherStyle } from '../config/types';
import { TETHER_POINTS, capRadius, tetherCurve } from './tether';

const DEG = Math.PI / 180;
const STYLE: TetherStyle = { length: 0.3, color: '#7cf0ff', width: 0.02, sag: 0.12, cap: '#f0e8ac' };
const attach = [1, 2, 0.5] as const;

test('hanging straight down, the thread runs from the attach point to the cap and the orb sits under the cap', () => {
  const { points, orbCentre } = tetherCurve(attach, 0, STYLE, 0.2);
  expect(points).toHaveLength(TETHER_POINTS);
  expect(points[0]).toEqual([1, 2, 0.5]);
  const end = points[points.length - 1];
  expect(end[0]).toBeCloseTo(1, 12);
  expect(end[1]).toBeCloseTo(2 - 0.3, 12);
  expect(end[2]).toBe(0.5);
  expect(orbCentre[0]).toBeCloseTo(1, 12);
  expect(orbCentre[1]).toBeCloseTo(2 - 0.3 - 0.2, 12);
  expect(orbCentre[2]).toBe(0.5);
});

test('the orb has no radius unless given one: its centre is the cap', () => {
  const { points, orbCentre } = tetherCurve(attach, 0.3, STYLE);
  expect(orbCentre).toEqual(points[points.length - 1]);
});

test('a swing of angle a carries the orb along a circle of the tether plus the orb, swung toward +x', () => {
  for (const angle of [-25 * DEG, -10 * DEG, 10 * DEG, 25 * DEG]) {
    const { orbCentre } = tetherCurve(attach, angle, STYLE, 0.2);
    expect(Math.hypot(orbCentre[0] - attach[0], orbCentre[1] - attach[1])).toBeCloseTo(0.5, 12);
    expect(Math.sign(orbCentre[0] - attach[0])).toBe(Math.sign(angle));
    expect(orbCentre[1]).toBeLessThan(attach[1]);
  }
});

test('the thread sags: it bows off the straight line by sag x length at its middle, and not at its ends', () => {
  const { points } = tetherCurve(attach, 0, STYLE, 0);
  const end = points[points.length - 1];
  const bow = (k: number) => {
    // Distance of point k from the straight line attach -> end (vertical here).
    return Math.abs(points[k][0] - attach[0]);
  };
  expect(bow(0)).toBe(0);
  expect(bow(points.length - 1)).toBeCloseTo(0, 12);
  const mid = Math.max(...points.map((_, k) => bow(k)));
  expect(mid).toBeGreaterThan(0.5 * STYLE.sag * STYLE.length);
  expect(mid).toBeLessThanOrEqual(STYLE.sag * STYLE.length + 1e-12);
  // Points run down the line, in order.
  for (let k = 1; k < points.length; k++) expect(points[k][1]).toBeLessThan(points[k - 1][1]);
  expect(end[1]).toBeCloseTo(attach[1] - STYLE.length, 12);
});

test('a tether of length 0 is a cap only: every point is the attach point and the orb hangs its radius below', () => {
  const style = { ...STYLE, length: 0 };
  const { points, orbCentre } = tetherCurve(attach, 0, style, 0.2);
  for (const p of points) expect(p).toEqual([1, 2, 0.5]);
  expect(orbCentre[0]).toBeCloseTo(1, 12);
  expect(orbCentre[1]).toBeCloseTo(1.8, 12);
});

test('the cap is a little wider than the thread, from its width', () => {
  expect(capRadius(STYLE)).toBeGreaterThan(STYLE.width / 2);
  expect(capRadius({ ...STYLE, width: 0.04 })).toBeCloseTo(2 * capRadius(STYLE), 12);
});

test('it reads no globals: the same arguments give the same curve, and the attach point is not changed', () => {
  const a = tetherCurve(attach, 0.2, STYLE, 0.1);
  const b = tetherCurve(attach, 0.2, STYLE, 0.1);
  expect(a).toEqual(b);
  expect(attach).toEqual([1, 2, 0.5]);
});
