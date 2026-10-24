import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { borderWidth, catchlightSpots, eyeOutline, eyelidCrease, irisCenter, pupilShape } from './eyeShape';

const eye = NOX.face.eye;
const deg = (d: number) => (d * Math.PI) / 180;

test('the iris sits toward the nose in both eyes', () => {
  expect(irisCenter(eye, -1, 0, 0).x).toBeGreaterThan(0);
  expect(irisCenter(eye, 1, 0, 0).x).toBeLessThan(0);
});

test('light comes from the upper left: the larger catchlight is upper left of the pupil in both eyes', () => {
  for (const side of [-1, 1] as const) {
    const iris = irisCenter(eye, side, 0, 0);
    const [big, small] = catchlightSpots(eye, side, 0, 0);
    expect(big.r, `side ${side}`).toBeGreaterThan(small.r);
    expect(big.x, `side ${side}`).toBeLessThan(iris.x);
    expect(small.x, `side ${side}`).toBeGreaterThan(iris.x);
    expect(Math.min(big.y, small.y), `side ${side}`).toBeGreaterThan(iris.y);
  }
});

test('the catchlights sit evenly across the iris, as in the reference', () => {
  for (const side of [-1, 1] as const) {
    const iris = irisCenter(eye, side, 0, 0);
    const [big, small] = catchlightSpots(eye, side, 0, 0);
    expect(Math.abs((big.x + small.x) / 2 - iris.x), `side ${side}`).toBeLessThan(eye.rx * eye.iris.rx * 0.1);
  }
});

test('catchlights drift less than the iris when the gaze moves', () => {
  const still = irisCenter(eye, 1, 0, 0);
  const looking = irisCenter(eye, 1, 1, 0);
  const [before] = catchlightSpots(eye, 1, 0, 0);
  const [after] = catchlightSpots(eye, 1, 1, 0);
  expect(looking.x - still.x).toBeGreaterThan(0);
  expect(after.x - before.x).toBeLessThan(looking.x - still.x);
  expect(after.x - before.x).toBeGreaterThan(0);
});

test('the eye border is heaviest along the top, thick on the outer side, thin beside the nose and along the bottom', () => {
  for (const side of [-1, 1] as const) {
    const at = (d: number) => borderWidth(eye, deg(d), side);
    const all = Array.from({ length: 72 }, (_, i) => at(i * 5));
    const outer = side === 1 ? at(0) : at(180);
    const inner = side === 1 ? at(180) : at(0);
    expect(Math.max(...all), `side ${side}`).toBeCloseTo(Math.max(at(60), at(75), at(90), at(105), at(120)), 6);
    expect(outer, `side ${side}`).toBeGreaterThan(inner * 2);
    expect(at(270), `side ${side}`).toBeLessThan(outer / 2);
    expect(Math.min(...all), `side ${side}`).toBeGreaterThan(0);
  }
});

test('the two eyes mirror each other', () => {
  for (let d = 0; d < 360; d += 15) {
    expect(borderWidth(eye, deg(d), 1)).toBeCloseTo(borderWidth(eye, deg(180 - d), -1), 9);
  }
});

test('the border thickness changes smoothly around the eye', () => {
  for (let d = 0; d < 360; d += 1) {
    expect(Math.abs(borderWidth(eye, deg(d + 1), 1) - borderWidth(eye, deg(d), 1)), `${d} deg`).toBeLessThan(0.0015);
  }
});

test('the outline follows the closing lid: its top comes down as the eye blinks', () => {
  const top = (blink: number) => Math.max(...eyeOutline(eye, blink, 0).map(p => p.y));
  expect(top(0)).toBeCloseTo(eye.ry, 3);
  expect(top(0.5)).toBeLessThan(top(0) - eye.ry * 0.8);
});

test('the eyelid crease arcs above the border, from the inner side round toward the outer corner', () => {
  for (const side of [-1, 1] as const) {
    const crease = eyelidCrease(eye, side);
    for (const p of crease) {
      const theta = Math.acos(Math.max(-1, Math.min(1, p.x / eye.rx)));
      const top = eye.ry * Math.sqrt(Math.max(0, 1 - (p.x / eye.rx) ** 2));
      expect(p.y, `side ${side}`).toBeGreaterThan(top + borderWidth(eye, theta, side));
    }
    // Starts on the nose side of the top, ends on the outer side.
    expect(Math.sign(crease[0].x)).toBe(-side);
    expect(Math.sign(crease.at(-1)!.x)).toBe(side);
  }
});

test('the crease is a soft shadow: strongest over the eye, fading out at both ends', () => {
  const crease = eyelidCrease(eye, 1);
  const middle = crease[Math.floor(crease.length / 2)];
  expect(middle.strength).toBeGreaterThan(0.9);
  expect(crease[0].strength).toBeLessThan(0.15);
  expect(crease.at(-1)!.strength).toBeLessThan(0.15);
});

test('the pupil sits just below the iris centre, inside the iris', () => {
  for (const side of [-1, 1] as const) {
    const iris = irisCenter(eye, side, 0, 0);
    const { outer } = pupilShape(eye, side, 0, 0);
    expect(outer.y, `side ${side}`).toBeLessThan(iris.y);
    expect(outer.ry, `side ${side}`).toBeLessThan(eye.ry * eye.iris.ry * 0.65);
  }
});

test('the pupil has a lighter inside within a dark ring, heavier on the right in both eyes', () => {
  for (const side of [-1, 1] as const) {
    const { outer, inner } = pupilShape(eye, side, 0, 0);
    const left = inner.x - inner.rx - (outer.x - outer.rx);
    const right = outer.x + outer.rx - (inner.x + inner.rx);
    expect(left, `side ${side}`).toBeGreaterThan(0);
    expect(right, `side ${side}`).toBeGreaterThan(left * 2);
    expect(outer.y + outer.ry - (inner.y + inner.ry), `side ${side}`).toBeGreaterThan(0);
    expect(inner.y - inner.ry - (outer.y - outer.ry), `side ${side}`).toBeGreaterThan(0);
  }
});
