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

/**
 * The eyelid crease relative to the eye centre (+y up), from its inner end round to the
 * outer corner: the open eye's top edge pushed out by `fold.gap`. Each point carries the
 * crease's thickness and its shadow strength, both greatest over the eye and fading out
 * at the ends, so the crease reads as a soft fold rather than a drawn line.
 */
export function eyelidCrease(eye: EyeLayout, side: -1 | 1, samples = 24) {
  const { gap, width, from } = eye.fold;
  const rx = eye.rx + gap;
  const ry = eye.ry + gap;
  const end = 0.96;
  const out: { x: number; y: number; width: number; strength: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = from + (end - from) * t;
    const x = side * u * rx;
    const swell = Math.sin(Math.PI * t);
    out.push({ x, y: ry * Math.sqrt(Math.max(0, 1 - u * u)), width: width * (0.35 + 0.65 * swell), strength: swell ** 0.7 });
  }
  return out;
}
