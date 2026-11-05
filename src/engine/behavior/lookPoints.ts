import type { Point2 } from '../config/types';
import { seededRng } from '../motion/micro';

// The gaze wander (Aether spec 7.8, amendment A1 18.2): a pose may list several world points
// (`StagePose.lookPoints`) and the eyes go from one to the next, a new one every few seconds. Like
// the idle tilt it is a function of the clock and a seed alone. The stage's single `look` stays.

/** Seconds between one pick and the next: a new look point every 4 to 8 s (spec 7.8). */
export const LOOK_INTERVAL: readonly [number, number] = [4, 8];

/** Past this clock (a day, seconds) the schedule is not replayed. */
const MAX_CLOCK = 86400;

interface Picks {
  rng: () => number;
  /** Each pick: when it began (the first at 0), when it ends, and its index into the points. */
  starts: number[];
  ends: number[];
  index: number[];
}

const schedules = new Map<string, Picks>();

/**
 * The look point at `t` seconds: the first pick holds until the first wait is over, and each next
 * pick (always another point than the one before) a wait later, each wait drawn from `interval`.
 * The same seed replays the same sequence. Null with no points, an `interval` that is not a range
 * above 0, a `t` that is not a time, or `reducedMotion`.
 */
export function pickLookPoint(t: number, points: readonly Point2[], interval: readonly [number, number], seed: number, reducedMotion = false): Point2 | null {
  if (reducedMotion || points.length === 0) return null;
  const [low, high] = interval;
  if (!(Number.isFinite(low) && Number.isFinite(high) && low > 0 && low <= high)) return null;
  if (!(t >= 0 && t < MAX_CLOCK)) return null;
  const n = points.length;
  if (n === 1) return points[0];
  const key = `${seed >>> 0}|${low}|${high}|${n}`;
  let s = schedules.get(key);
  if (!s) {
    // A small cache: a few seeds and intervals are ever in use.
    if (schedules.size >= 32) schedules.clear();
    const rng = seededRng(seed);
    const first = Math.min(n - 1, Math.floor(rng() * n));
    s = { rng, starts: [0], ends: [low + rng() * (high - low)], index: [first] };
    schedules.set(key, s);
  }
  const { starts, ends, index, rng } = s;
  while (ends[ends.length - 1] <= t) {
    const start = ends[ends.length - 1];
    // Another point than the one before: draw among the other n - 1 and step over it.
    const draw = Math.min(n - 2, Math.floor(rng() * (n - 1)));
    const before = index[index.length - 1];
    starts.push(start);
    index.push(draw >= before ? draw + 1 : draw);
    ends.push(start + low + rng() * (high - low));
  }
  // The pick running now is the last one that has begun.
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return points[index[lo]];
}
