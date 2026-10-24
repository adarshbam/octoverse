import type { EyeLayout } from '../config/types';

/** How far the iris travels with the gaze, as fractions of the eye radii. */
const GAZE_X = 0.14;
const GAZE_Y = 0.1;
/** Catchlights are reflections: they follow the gaze only part of the way. */
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
  const irx = eye.rx * eye.iris.rx;
  const iry = eye.ry * eye.iris.ry;
  const x = -side * eye.rx * eye.iris.inset + gazeX * eye.rx * GAZE_X * CATCHLIGHT_FOLLOW;
  const y = gazeY * eye.ry * GAZE_Y * CATCHLIGHT_FOLLOW;
  return eye.catchlights.map(c => ({ x: x + c.x * irx, y: y + c.y * iry, r: c.r * irx }));
}

/**
 * The pupil relative to the eye centre, world units (+y up): its outer ellipse, which is
 * the dark ring, and the lighter inside offset toward the light.
 */
export function pupilShape(eye: EyeLayout, side: -1 | 1, gazeX: number, gazeY: number) {
  const iris = irisCenter(eye, side, gazeX, gazeY);
  const { rx, ry, drop, inner } = eye.pupil;
  const outer = {
    x: iris.x,
    y: iris.y - drop * eye.ry * eye.iris.ry,
    rx: rx * eye.rx * eye.iris.rx,
    ry: ry * eye.ry * eye.iris.ry,
  };
  return {
    outer,
    inner: { x: outer.x + inner.dx * outer.rx, y: outer.y + inner.dy * outer.ry, rx: inner.rx * outer.rx, ry: inner.ry * outer.ry },
  };
}

/**
 * Width of the border outside the opening at screen angle `theta` (radians; 0 = right,
 * pi/2 = up) for the left (`side` -1) or right (1) eye. Eased between the eight traced
 * directions, so the line swells and thins smoothly round the eye.
 */
export function borderWidth(eye: EyeLayout, theta: number, side: -1 | 1) {
  const b = eye.border;
  const ring = [b.outer, b.upperOuter, b.top, b.upperInner, b.inner, b.lowerInner, b.bottom, b.lowerOuter];
  const local = side === 1 ? theta : Math.PI - theta;
  const turns = (((local / (Math.PI / 4)) % 8) + 8) % 8;
  const k = Math.floor(turns);
  const t = turns - k;
  const ease = (1 - Math.cos(Math.PI * t)) / 2;
  return ring[k] + (ring[(k + 1) % 8] - ring[k]) * ease;
}

/**
 * The opening's outline relative to the eye centre (+y up), once round: along the lid from
 * the left corner to the right, then back along the lower edge. The lid comes down as
 * `blink` goes to 1; `lidBottom` raises the lower edge. Each point carries the screen
 * angle of the open eye at that point, for the border width.
 */
export function eyeOutline(eye: EyeLayout, blink: number, lidBottom: number, samples = 48) {
  const out: { x: number; y: number; theta: number }[] = [];
  const top = 1 - 2 * blink;
  const low = 1 - 0.6 * lidBottom;
  for (let i = 0; i <= samples; i++) {
    const theta = Math.PI - (Math.PI * i) / samples;
    out.push({ x: eye.rx * Math.cos(theta), y: top * eye.ry * Math.sin(theta), theta });
  }
  for (let i = 1; i < samples; i++) {
    const theta = -(Math.PI * i) / samples;
    out.push({ x: eye.rx * Math.cos(theta), y: low * eye.ry * Math.sin(theta), theta });
  }
  return out;
}

/**
 * The eyelid relative to the eye centre (+y up), from its nose end over the top to its
 * outer end. Each point gives the crease (above the lid band, which sits on the border)
 * and the middle of the lid band, with the crease's width and shadow strength, both
 * greatest over the eye and fading out at the ends, so it reads as a soft fold.
 */
export function eyelidCrease(eye: EyeLayout, side: -1 | 1, samples = 24) {
  const { width, band, from, to } = eye.fold;
  const out: { x: number; y: number; bx: number; by: number; width: number; strength: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = from + (to - from) * t;
    const theta = Math.acos(side * u);
    const ex = eye.rx * Math.cos(theta);
    const ey = eye.ry * Math.sin(theta);
    // Outward normal of the opening at this point.
    const nx = Math.cos(theta) / eye.rx;
    const ny = Math.sin(theta) / eye.ry;
    const nl = Math.hypot(nx, ny);
    const border = borderWidth(eye, theta, side);
    const crease = border + band + width / 2;
    const lid = border + band / 2;
    const swell = Math.sin(Math.PI * t);
    out.push({
      x: ex + (nx / nl) * crease,
      y: ey + (ny / nl) * crease,
      bx: ex + (nx / nl) * lid,
      by: ey + (ny / nl) * lid,
      width: width * (0.35 + 0.65 * swell),
      strength: swell ** 0.7,
    });
  }
  return out;
}
