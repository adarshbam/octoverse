import type { TetherStyle } from '../config/types';
import type { Vec3 } from '../world/types';

// A pendant's tether: the thin glowing thread from an arm to the orb's cap (spec 7.5). Pure maths,
// with no React, no instance state and no globals, so any placement can hang a thread the same way
// (Veyra's `pendant`, Aether's `satellite`). The colours are the world's (`TetherStyle`); nothing
// here knows a colour.

/** How many points the thread's curve has, ends included: enough to read as a smooth bow. */
export const TETHER_POINTS = 6;

/** The cap's radius, in thread widths: a little wider than the thread it ends. */
const CAP_PER_WIDTH = 1.8;

/** The cap where the thread meets the orb: a small bead, its radius from the thread's width. */
export const capRadius = (style: Pick<TetherStyle, 'width'>): number => style.width * CAP_PER_WIDTH;

/**
 * The thread of a pendant hanging from `attach`, swung `angle` radians from straight down (positive
 * toward +x), and where its orb is. The thread runs `style.length` from the attach point to the cap,
 * bowing sideways by `style.sag` of its length at its middle; the orb of radius `radius` (default 0:
 * its centre is the cap) hangs on, centred a radius past the cap along the line the thread ends on,
 * so its top is the cap. A tether of length 0 is the cap alone, the orb hanging straight from it.
 * The curve is in the attach point's own space and its z is the attach point's.
 */
export function tetherCurve(attach: Vec3, angle: number, style: TetherStyle, radius = 0): { points: Vec3[]; orbCentre: Vec3 } {
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  // The bow's side, across the thread.
  const px = Math.cos(angle);
  const py = Math.sin(angle);
  const bow = style.sag * style.length;
  const points: Vec3[] = [];
  for (let k = 0; k < TETHER_POINTS; k++) {
    const s = k / (TETHER_POINTS - 1);
    const along = style.length * s;
    const side = bow * 4 * s * (1 - s);
    points.push([attach[0] + dx * along + px * side, attach[1] + dy * along + py * side, attach[2]]);
  }
  const end = points[TETHER_POINTS - 1];
  return { points, orbCentre: [end[0] + dx * radius, end[1] + dy * radius, attach[2]] };
}
