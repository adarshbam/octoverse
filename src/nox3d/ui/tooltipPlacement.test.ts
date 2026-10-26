import { expect, test } from 'vitest';
import { placeTooltip, sheetFits } from './tooltipPlacement';

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

test('it protects the facial region (eyes and cheeks) when outward does not fit', () => {
  // Kali Linux in 960x640: orb in upper right, face center at 480, 280 with cheeks spanning 340..650
  const vp = { width: 960, height: 640 };
  const kaliOrb = { x: 733, y: 212, size: 68 };
  const cardSize = { width: 280, height: 160 };
  const faceData = {
    x: 480,
    y: 280,
    bounds: { left: 330, right: 650, top: 180, bottom: 400 },
  };
  const p = placeTooltip(kaliOrb, cardSize, faceData, vp);
  // Tooltip must NOT overlap the face bounds
  const overlapsFace = !(p.left + cardSize.width <= faceData.bounds.left || p.left >= faceData.bounds.right || p.top + cardSize.height <= faceData.bounds.top || p.top >= faceData.bounds.bottom);
  expect(overlapsFace).toBe(false);
  expect(p.left).toBeGreaterThanOrEqual(faceData.bounds.right);
  expect(p.left + cardSize.width).toBeLessThanOrEqual(vp.width);
});

test('with no room outward it finds empty space instead of covering the other orbs (960x640, Kali)', () => {
  // Measured from a 960x640 recording: Kali presented at the upper right, the other orbs at rest.
  const vp = { width: 960, height: 640 };
  const kali = { x: 752, y: 200, size: 92 };
  const others = [[235, 245], [205, 315], [240, 375], [322, 405], [250, 430], [320, 475], [420, 497], [545, 490], [490, 542], [660, 465], [652, 393], [718, 365], [770, 440], [770, 295]].map(([x, y]) => ({ x, y, size: 70 }));
  const faceBox = { x: 485, y: 370, bounds: { left: 352, right: 618, top: 313, bottom: 440 } };
  const size = { width: 280, height: 170 };
  const p = placeTooltip(kali, size, faceBox, vp, others);
  const covers = (o: { x: number; y: number; size: number }) => {
    const nx = Math.max(p.left, Math.min(o.x, p.left + size.width));
    const ny = Math.max(p.top, Math.min(o.y, p.top + size.height));
    return Math.hypot(nx - o.x, ny - o.y) < o.size / 2;
  };
  expect(others.filter(covers)).toEqual([]);
  expect(covers(kali)).toBe(false);
  const f = faceBox.bounds;
  expect(p.left + size.width <= f.left || p.left >= f.right || p.top + size.height <= f.top || p.top >= f.bottom).toBe(true);
  expect(p.left).toBeGreaterThanOrEqual(0);
  expect(p.top).toBeGreaterThanOrEqual(0);
  expect(p.left + size.width).toBeLessThanOrEqual(vp.width);
  expect(p.top + size.height).toBeLessThanOrEqual(vp.height);
});

test('on a phone held upright the tooltip is a sheet along the bottom, below the face', () => {
  const face = { x: 195, y: 420, bounds: { left: 115, right: 275, top: 385, bottom: 455 } };
  expect(sheetFits({ width: 390, height: 844 }, face, 170)).toBe(true);
});

test('where a sheet would reach the face the tooltip stays beside its orb', () => {
  // A small landscape window: Nox fills it, so a sheet along the bottom would cover the face.
  expect(sheetFits({ width: 506, height: 504 }, { x: 253, y: 280, bounds: { left: 150, right: 356, top: 236, bottom: 334 } }, 170)).toBe(false);
  // Upright but nearly square: the sheet would still come up over the mouth.
  expect(sheetFits({ width: 600, height: 640 }, { x: 300, y: 330, bounds: { left: 180, right: 420, top: 280, bottom: 400 } }, 260)).toBe(false);
  // Wide windows always set the card beside the orb.
  expect(sheetFits({ width: 1280, height: 720 }, { x: 640, y: 420 }, 120)).toBe(false);
});
