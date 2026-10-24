import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { catchlightSpots, eyelidCrease, irisCenter } from './eyeShape';

const eye = NOX.face.eye;

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

test('catchlights drift less than the iris when the gaze moves', () => {
  const still = irisCenter(eye, 1, 0, 0);
  const looking = irisCenter(eye, 1, 1, 0);
  const [before] = catchlightSpots(eye, 1, 0, 0);
  const [after] = catchlightSpots(eye, 1, 1, 0);
  expect(looking.x - still.x).toBeGreaterThan(0);
  expect(after.x - before.x).toBeLessThan(looking.x - still.x);
  expect(after.x - before.x).toBeGreaterThan(0);
});

test('the eyelid crease arcs above the lash line, from the inner side round to the outer corner', () => {
  for (const side of [-1, 1] as const) {
    const crease = eyelidCrease(eye, side);
    for (const p of crease) {
      const top = eye.ry * Math.sqrt(Math.max(0, 1 - (p.x / eye.rx) ** 2));
      expect(p.y, `side ${side}`).toBeGreaterThan(top + eye.fold.gap * 0.5);
    }
    // Starts on the nose side of the top, ends at the outer corner.
    expect(Math.sign(crease[0].x)).toBe(-side);
    expect(Math.sign(crease.at(-1)!.x)).toBe(side);
    expect(Math.abs(crease.at(-1)!.x)).toBeGreaterThan(eye.rx * 0.85);
  }
});

test('the crease is a soft shadow: strongest over the eye, fading out at both ends', () => {
  const crease = eyelidCrease(eye, 1);
  const middle = crease[Math.floor(crease.length / 2)];
  expect(middle.strength).toBeGreaterThan(0.9);
  expect(crease[0].strength).toBeLessThan(0.15);
  expect(crease.at(-1)!.strength).toBeLessThan(0.15);
});
