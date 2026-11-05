import { beforeAll, expect, test } from 'vitest';
import { NOX_BUNDLE } from '../../worlds/nox/bundle';
import type { WorldBundle } from '../types/bundle';
import { faceSpot } from './OrbButtons';

const SIZE = { width: 1536, height: 1024 };

// faceSpot reads the window's size (node has no window): a 1536 x 1024 one.
beforeAll(() => {
  (globalThis as { window?: unknown }).window = { innerWidth: SIZE.width, innerHeight: SIZE.height };
});

const faceSpotAt = (bundle: WorldBundle, stage: 'overview') => faceSpot(bundle, stage);

/** Nox's overview with its body scaled by `scale` about the same place. */
const scaled = (scale: number): WorldBundle => ({ ...NOX_BUNDLE, poses: { ...NOX_BUNDLE.poses, overview: { ...NOX_BUNDLE.poses.overview, body: { ...NOX_BUNDLE.poses.overview.body, scale } } } });

test("the face's keep-clear box at body scale 1 is the unscaled one (Nox's, bit for bit)", () => {
  const spot = faceSpotAt(NOX_BUNDLE, 'overview');
  expect(faceSpotAt(scaled(1), 'overview')).toEqual(spot);
  // Nox's box: 1.05 either side, 0.45 up and 0.55 down of the face origin (the stage's px per unit is 1024 / 5.04 here).
  const perUnit = SIZE.height / NOX_BUNDLE.stage.frames.overview.height;
  expect((spot.bounds.right - spot.bounds.left) / perUnit).toBeCloseTo(2.1, 2);
  expect((spot.bounds.bottom - spot.bounds.top) / perUnit).toBeCloseTo(1.0, 2);
});

test("the face's keep-clear box grows with the stage pose's body scale (Veyra's overview is 1.1)", () => {
  const one = faceSpotAt(scaled(1), 'overview').bounds;
  const big = faceSpotAt(scaled(1.5), 'overview').bounds;
  expect((big.right - big.left) / (one.right - one.left)).toBeCloseTo(1.5, 3);
  expect((big.bottom - big.top) / (one.bottom - one.top)).toBeCloseTo(1.5, 3);
});
