import type { Sequences } from '../sequences/theatre';

// The twinkle (spec 7.5, "The ring forming"; contract 9.2 `APPEARS.twinkle`): once the entrance has
// settled, the satellite's ring forms. The gold line draws round the head in about 0.6 s, then the
// beads light one after another over about 0.8 s. Pure: the channels at a moment are a function of
// the clock, so a frozen still shows any moment of it.

/** The line draws over this long from the start. */
export const TWINKLE_LINE_SECONDS = 0.6;
/** The beads begin to light when the line is whole. */
export const TWINKLE_BEADS_START = TWINKLE_LINE_SECONDS;
/** The whole twinkle: the last bead is full at this moment (the appear's default duration). */
export const TWINKLE_SECONDS = 1.4;
/** One bead's own light-up, as a share of the beads' window (the rest is the stagger between beads). */
const BEAD_SHARE = 0.4;

const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
/** A hair short of the end is the end (the sum of start, steps and span is not exact in floating point). */
const progress = (raw: number) => (raw >= 1 - 1e-9 ? 1 : clamp01(raw));

/** What the ring shows `t` into the twinkle: how much of the line is drawn (0 to 1) and how lit each bead is (0 to 1, in bead order). */
export interface TwinkleState {
  line: number;
  beads: number[];
}

/**
 * The ring `t` seconds into the twinkle, for `beadCount` beads. The line draws 0 to 1 over the first
 * 0.6 s; then the beads light in index order, each over its own share of the window to 1.4 s, so bead
 * i is never behind bead i + 1. Every channel rises once and stays (monotonic) and the whole is
 * complete by 1.4 s. With `reducedMotion` it is complete at once.
 */
export function twinkleState(t: number, beadCount: number, reducedMotion: boolean): TwinkleState {
  const n = Math.max(0, Math.floor(Number.isFinite(beadCount) ? beadCount : 0));
  if (reducedMotion) return { line: 1, beads: Array.from({ length: n }, () => 1) };
  const clock = Number.isFinite(t) ? t : 0;
  const window = TWINKLE_SECONDS - TWINKLE_BEADS_START;
  const span = n > 1 ? window * BEAD_SHARE : window;
  const step = n > 1 ? (window - span) / (n - 1) : 0;
  return {
    line: smooth(progress(clock / TWINKLE_LINE_SECONDS)),
    beads: Array.from({ length: n }, (_, i) => smooth(progress((clock - (TWINKLE_BEADS_START + i * step)) / span))),
  };
}

/** Seconds the whole twinkle runs: the appear's `duration` (1.4 by default). */
export function twinkleLength(duration?: number): number {
  return duration !== undefined && Number.isFinite(duration) && duration > 0 ? duration : TWINKLE_SECONDS;
}

/**
 * The twinkle as the appear module plays it (strategies.ts): the world's `twinkle` sheet eases the
 * clock (its `main.clock` runs 0 to 1 over the sheet; keyed straight, the clock is the run's own),
 * `seconds` into a run of `duration`, and `twinkleState` gives the ring at that moment. With no sheet
 * in yet (`sequences` null) the ring is as at the start: nothing drawn.
 */
export function twinkleFrame(sequences: Sequences | null, seconds: number, beadCount: number, duration?: number): TwinkleState {
  if (!sequences) return twinkleState(0, beadCount, false);
  const total = twinkleLength(duration);
  const sheet = sequences.length('twinkle');
  const at = clamp01((Number.isFinite(seconds) ? seconds : 0) / total) * sheet;
  const clock = clamp01(sequences.sample<{ clock: number }>('twinkle', 'main', at).clock);
  return twinkleState(clock * TWINKLE_SECONDS, beadCount, false);
}

/** How much a bead overshoots its size as it lights (a fraction of it): the twinkle. */
const POP = 0.35;

/**
 * A bead's size, as a share of its own, as it lights (`light` 0 to 1, a TwinkleState bead): 0 unlit,
 * swelling past full as it catches the light and settling at exactly 1.
 */
export function twinklePop(light: number): number {
  const l = clamp01(light);
  return l * (1 + POP * Math.sin(Math.PI * l));
}
