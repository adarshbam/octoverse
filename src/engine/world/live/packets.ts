import type { QualityTier } from '../../stage/quality';
import type { PacketsConfig, Vec3 } from '../types';
import { MAX_PACKETS } from './index';

// The packets of light that run along a path (Packets.tsx draws them): where each one is along the
// path, how many run at a quality tier, and how a path is walked. Pure, so the tests can read all of it.

/**
 * How far along the path (0 up to, not including, 1) packet `i` of `count` is at time `t`, when the
 * packets cover `speed` paths a second. They start evenly spaced (`i / count` apart) and keep that
 * spacing as they run forward, wrapping from the end to the start. Speed 0 holds them where they
 * started, which is how a world's held or reduced motion draws them (the caller scales `speed` by
 * the motion amount).
 */
export function packetArc(i: number, t: number, count: number, speed: number): number {
  if (!(count > 0)) return 0;
  const lap = t * speed + i / count;
  if (!Number.isFinite(lap)) return 0;
  const arc = lap - Math.floor(lap);
  // A lap one float-ulp under a whole number can round up to 1 in the subtraction.
  return arc >= 1 ? 0 : arc;
}

/** How many packets run at `tier`: the config's count for it, at most the cap, and 0 for nonsense. */
export function packetCount(config: Pick<PacketsConfig, 'count'>, tier: QualityTier): number {
  const n = config.count[tier];
  return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 0), MAX_PACKETS) : 0;
}

const distance = (a: Vec3, b: Vec3) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

/** The length of a polyline, in stage units. */
export function pathLength(points: readonly Vec3[]): number {
  let length = 0;
  for (let k = 1; k < points.length; k++) length += distance(points[k - 1], points[k]);
  return length;
}

/**
 * The point `u` of the way (0 to 1 by length, clamped) along a polyline, and the unit direction of
 * the segment it is on. Segments of no length are passed over; a path of no length at all points along +x.
 */
export function pathPoint(points: readonly Vec3[], u: number): { position: Vec3; tangent: Vec3 } {
  const total = pathLength(points);
  let tangent: Vec3 = [1, 0, 0];
  if (points.length === 0) return { position: [0, 0, 0], tangent };
  if (total <= 0) return { position: points[0], tangent };
  let remaining = Math.min(Math.max(Number.isFinite(u) ? u : 0, 0), 1) * total;
  let position = points[0];
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1];
    const b = points[k];
    const length = distance(a, b);
    if (length <= 0) continue;
    tangent = [(b[0] - a[0]) / length, (b[1] - a[1]) / length, (b[2] - a[2]) / length];
    if (remaining <= length || k === points.length - 1) {
      const f = Math.min(remaining / length, 1);
      return { position: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f], tangent };
    }
    remaining -= length;
    position = b;
  }
  return { position, tangent };
}
