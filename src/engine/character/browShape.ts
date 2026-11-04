import type { FaceLayout } from '../config/types';

export interface BrowSample {
  x: number;
  y: number;
  width: number;
}

/** Thickness at the blunt inner end and the tapered outer end, as fractions of the widest point. */
const INNER_WIDTH = 0.6;
const OUTER_WIDTH = 0.25;
/** Full movement: lift in world units, tilt in radians. */
const LIFT = 0.04;
const TILT = (12 * Math.PI) / 180;

/**
 * One eyebrow in head-local units (+y up), sampled from the inner end to the outer
 * end along the traced quadratic curve. The left brow (`side` -1) mirrors the right
 * (`side` 1). It is widest a little inside the middle, blunt at the inner end and
 * tapered at the outer end. `lift` and `tilt` run from -1 to 1; positive tilt raises
 * the inner end, turning about the middle of the brow.
 */
export function browStroke(brow: FaceLayout['brow'], side: -1 | 1, lift: number, tilt: number, samples = 32): BrowSample[] {
  const { inner, control, outer, thickness } = brow;
  const mx = (inner[0] + outer[0]) / 2;
  const my = (inner[1] + outer[1]) / 2;
  const angle = tilt * TILT;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const out: BrowSample[] = [];
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const a = (1 - u) * (1 - u);
    const b = 2 * u * (1 - u);
    const c = u * u;
    // Right brow: the inner end is on its -x side, so a clockwise turn (negative angle) raises it.
    const x = a * inner[0] + b * control[0] + c * outer[0] - mx;
    const y = a * inner[1] + b * control[1] + c * outer[1] - my;
    const rx = mx + x * cos + y * sin;
    const ry = my - x * sin + y * cos;
    const end = INNER_WIDTH + (OUTER_WIDTH - INNER_WIDTH) * u;
    out.push({ x: side * rx, y: ry + lift * LIFT, width: thickness * (end + (1 - end) * Math.sin(Math.PI * u ** 0.75)) });
  }
  return out;
}
