import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { catchlightSpots, irisCenter } from './eyeShape';

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
