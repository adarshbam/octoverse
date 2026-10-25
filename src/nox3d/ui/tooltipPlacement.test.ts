import { expect, test } from 'vitest';
import { placeTooltip } from './tooltipPlacement';

const viewport = { width: 1280, height: 720 };
const card = { width: 300, height: 160 };
const face = { x: 640, y: 420 };
const overlaps = (p: { left: number; top: number }, point: { x: number; y: number }) =>
  point.x >= p.left && point.x <= p.left + card.width && point.y >= p.top && point.y <= p.top + card.height;

test('the tooltip goes on the side of the orb away from the face', () => {
  const left = placeTooltip({ x: 420, y: 420, size: 80 }, card, face, viewport);
  expect(left.left + card.width).toBeLessThanOrEqual(420 - 40);
  const right = placeTooltip({ x: 860, y: 380, size: 80 }, card, face, viewport);
  expect(right.left).toBeGreaterThanOrEqual(860 + 40);
});

test('with no room outward it goes above the orb, never over the face', () => {
  const p = placeTooltip({ x: 1180, y: 300, size: 110 }, card, face, viewport);
  expect(p.top + card.height).toBeLessThanOrEqual(300 - 55);
  expect(overlaps(p, face)).toBe(false);
});

test('it always stays inside the window', () => {
  for (const orb of [{ x: 30, y: 30, size: 60 }, { x: 1250, y: 700, size: 60 }, { x: 640, y: 40, size: 90 }]) {
    const p = placeTooltip(orb, card, face, viewport);
    expect(p.left).toBeGreaterThanOrEqual(0);
    expect(p.top).toBeGreaterThanOrEqual(0);
    expect(p.left + card.width).toBeLessThanOrEqual(viewport.width);
    expect(p.top + card.height).toBeLessThanOrEqual(viewport.height);
  }
});
