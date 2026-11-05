import type { Personality } from '../config/types';
import { seededRng } from '../motion/micro';

// The curious head tilt (Aether spec 7.8, amendment A1 18.2): every so often, with nothing else to
// do, the head leans a few degrees to one side, holds a moment and levels again. A shared ambient
// layer driven by `Personality.idleTilt` (absent, or an amplitude of 0, is none: Nox, Veyra). It is
// a function of the clock and a seed alone, so the same seed replays the same tilts.

/** The ease each way: the head takes this long (seconds) to lean over, and as long to come back. */
const RAMP = 2.2;
/** The head holds the lean this long (seconds) between the two. */
const HOLD = 0.2;

/**
 * One tilt lasts this long (seconds): lean over, hold, level. No wait between starts is shorter
 * (below), so two tilts never overlap and the head is level between them.
 */
export const IDLE_TILT_SECONDS = 2 * RAMP + HOLD;

/**
 * The fastest the roll moves, per radian of amplitude per second: the smoothstep ramp's peak rate is
 * 1.5 of the lean per RAMP. The slowest head in the shipped personalities (a critically damped
 * spring at omega 2.4, spring() in ambient.ts) peaks at 0.88 per unit, so a tilt is never faster.
 */
export const IDLE_TILT_MAX_RATE = 1.5 / RAMP;

const smoothstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Past this clock (a day, seconds) the schedule is not replayed: the answer is level. */
const MAX_CLOCK = 86400;

/** A tilt as a share of the amplitude (-1 to 1; the side and 0.6 to 1 of the full lean), at its start. */
interface Event {
  start: number;
  lean: number;
}

export interface Schedule {
  rng: () => number;
  events: Event[];
  /** The period the waits are drawn from. */
  lo: number;
  hi: number;
}

/** A few seeds and periods are ever in use; past this the table is cleared and rebuilt as asked. */
const MAX_SCHEDULES = 32;
const schedules = new Map<string, Schedule>();

/** The schedule asked for last: a frame asks for the same one as the frame before, so it costs no key and no allocation. */
let lastSeed = 0;
let lastLo = 0;
let lastHi = 0;
let last: Schedule | null = null;

/**
 * The schedule of `seed` and `period` (made on first ask, then kept). The same arguments as the
 * last call return the same object with no allocation; the string key is built only when they change.
 */
export function idleTiltSchedule(period: readonly [number, number], seed: number): Schedule {
  const s32 = seed >>> 0;
  if (last && s32 === lastSeed && period[0] === lastLo && period[1] === lastHi) return last;
  const key = `${s32}|${period[0]}|${period[1]}`;
  let s = schedules.get(key);
  if (!s) {
    if (schedules.size >= MAX_SCHEDULES) schedules.clear();
    schedules.set(key, (s = { rng: seededRng(seed), events: [], lo: period[0], hi: period[1] }));
  }
  last = s;
  lastSeed = s32;
  lastLo = period[0];
  lastHi = period[1];
  return s;
}

/** How many schedules are kept (for the tests: repeated frames must not grow it). */
export function idleTiltScheduleCount(): number {
  return schedules.size;
}

/** The wait to the next start: drawn from the schedule's period, never shorter than one tilt. */
function nextWait(s: Schedule): number {
  return Math.max(IDLE_TILT_SECONDS, s.lo + s.rng() * (s.hi - s.lo));
}

/**
 * The schedule replayed as far as `t`: each wait between starts is drawn from the period, then the
 * side, then the size. It keeps what it has drawn, so a frame costs a lookup, not a replay.
 */
function scheduleTo(t: number, s: Schedule): readonly Event[] {
  const { events } = s;
  while (events.length === 0 || events[events.length - 1].start <= t) {
    const start = (events.length === 0 ? 0 : events[events.length - 1].start) + nextWait(s);
    const side = s.rng() < 0.5 ? -1 : 1;
    events.push({ start, lean: side * (0.6 + 0.4 * s.rng()) });
  }
  return events;
}

/**
 * How fast the gate (`idleGateStep`) opens and closes, per second: a full close or open takes 6 s.
 * With the tilt's own peak rate (IDLE_TILT_MAX_RATE) it stays under the slowest shipped head's
 * (0.88 per unit at omega 2.4): 0.68 + 0.17.
 */
export const IDLE_GATE_RATE = 1 / 6;

/**
 * Moves the gate toward 1 (`open`) or 0 at IDLE_GATE_RATE and returns it. The caller multiplies the
 * tilt by it, so a tilt already under way when the character stops idling (the swim-in ends, a
 * still, the entrance) is faded in or out instead of cut, and never moves faster than the head turns.
 */
export function idleGateStep(gate: number, open: boolean, dt: number): number {
  const step = IDLE_GATE_RATE * dt;
  return open ? Math.min(1, gate + step) : Math.max(0, gate - step);
}

/**
 * The head's roll (radians, positive leans the top toward screen left as `StagePose.tilt` does) at
 * `t` seconds, for a personality's idle tilt: 0 between tilts; a tilt leans to one side by 0.6 to 1
 * of `amplitude`, so the roll is always within plus or minus `amplitude`; it eases over, holds
 * briefly and eases back (IDLE_TILT_SECONDS), and never moves faster than the head turns. A tilt
 * starts every `period` seconds (a range), the first one wait in. With `reducedMotion` it is 0.
 */
export function idleTiltAt(t: number, tilt: NonNullable<Personality['idleTilt']>, seed: number, reducedMotion = false): number {
  if (reducedMotion) return 0;
  const { amplitude, period } = tilt;
  if (!(Number.isFinite(amplitude) && amplitude > 0)) return 0;
  if (!(Array.isArray(period) && Number.isFinite(period[0]) && Number.isFinite(period[1]) && period[0] > 0 && period[0] <= period[1])) return 0;
  if (!(t >= 0 && t < MAX_CLOCK)) return 0;
  const events = scheduleTo(t, idleTiltSchedule(period, seed));
  // The tilt running now is the last one that has started: the first event past `t` is the next one.
  let lo = 0;
  let hi = events.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].start <= t) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return 0;
  const { start, lean } = events[lo - 1];
  const u = t - start;
  if (u >= IDLE_TILT_SECONDS) return 0;
  const shape = u < RAMP ? smoothstep(u / RAMP) : u < RAMP + HOLD ? 1 : smoothstep((IDLE_TILT_SECONDS - u) / RAMP);
  return amplitude * lean * shape;
}
