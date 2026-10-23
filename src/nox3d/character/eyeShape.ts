import type { EyeLayout } from '../config/types';

/** How far the iris travels with the gaze, as fractions of the eye radii. */
const GAZE_X = 0.14;
const GAZE_Y = 0.1;
/** Catchlights are reflections: they follow the iris only part of the way. */
const CATCHLIGHT_FOLLOW = 0.6;

/**
 * Iris centre relative to the eye centre, world units (+y up). `side` is -1 for the
 * left eye and 1 for the right; the iris sits toward the nose and follows the gaze.
 */
export function irisCenter(eye: EyeLayout, side: -1 | 1, gazeX: number, gazeY: number) {
  return {
    x: -side * eye.rx * eye.iris.inset + gazeX * eye.rx * GAZE_X,
    y: gazeY * eye.ry * GAZE_Y,
  };
}

/** Catchlight discs relative to the eye centre, world units (+y up), larger first. */
export function catchlightSpots(eye: EyeLayout, side: -1 | 1, gazeX: number, gazeY: number) {
  const iris = irisCenter(eye, side, gazeX, gazeY);
  const irx = eye.rx * eye.iris.rx;
  const iry = eye.ry * eye.iris.ry;
  const x = iris.x * CATCHLIGHT_FOLLOW;
  const y = iris.y * CATCHLIGHT_FOLLOW;
  return eye.catchlights.map(c => ({ x: x + c.x * irx, y: y + c.y * iry, r: c.r * irx }));
}
