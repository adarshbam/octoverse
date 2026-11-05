import type { Personality } from '../config/types';
import type { Sequences } from '../sequences/theatre';

/**
 * The shared micro-animations (design 9.7) that are new in Task 25: the small startle, the settle
 * overshoot, the arrival wiggle and idle glances. Each is a pure function of the seconds since it
 * began and the personality's timings and strengths; each is zero (or null) outside its window, so
 * a caller can keep a clock running and add the result every frame. There is no arm physics (ruling
 * R52): the follow-through is in the curves themselves, the arms lagging the body and every swing
 * easing out past rest and back.
 */

type Micro = Personality['micro'];

const smoothstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Where `t` falls in a window of `duration` seconds, 0 to 1, or null outside it. */
const within = (t: number, duration: number) => {
  const u = t / duration;
  return u >= 0 && u <= 1 ? u : null;
};

/**
 * A flinch's shape, 0 at both ends and 1 at `attack`: a quick ease up, then an ease back that dips
 * a little past rest (about 11%) before it settles, with no kink anywhere.
 */
function flinch(u: number, attack: number) {
  if (u < attack) return smoothstep(u / attack);
  const s = smoothstep((u - attack) / (1 - attack));
  return Math.cos(1.5 * Math.PI * s) * (1 - s) ** 2;
}

/** The body's share of the startle peaks this far in; the arms start this far behind it. */
const STARTLE_ATTACK = 0.18;
const ARMS_LAG = 0.08;
/** The brows jump faster than the body and hold, then come down without a dip. */
const EYES_ATTACK = 0.1;

/**
 * A small startle (the pointer darting to the face), `t` seconds in: the body lifts, the arms draw
 * in a beat behind it, and the brows jump. `lift` in world units, `armsIn` in radians at the arm
 * tips (drawn toward the body), `eyes` in brow lift; all 0 outside `p.startle.duration`.
 */
export function startle(t: number, p: Micro): { lift: number; armsIn: number; eyes: number } {
  const s = p.startle;
  const u = within(t, s.duration);
  if (u === null) return { lift: 0, armsIn: 0, eyes: 0 };
  const arms = u < ARMS_LAG ? 0 : flinch((u - ARMS_LAG) / (1 - ARMS_LAG), STARTLE_ATTACK);
  const eyes = u < EYES_ATTACK ? smoothstep(u / EYES_ATTACK) : 1 - smoothstep((u - EYES_ATTACK) / (1 - EYES_ATTACK));
  return { lift: s.lift * flinch(u, STARTLE_ATTACK), armsIn: s.armsIn * arms, eyes: s.eyes * eyes };
}

/** The settle's swing starts from rest this gently (the first fifth eases in), so the landing never kicks. */
const SETTLE_EASE_IN = 0.2;
const settleShape = (u: number, cycles: number) => smoothstep(u / SETTLE_EASE_IN) * Math.sin(2 * Math.PI * cycles * u) * (1 - u) ** 2;
/** Each `cycles`' largest swing, so `amount` is the overshoot itself. */
const settlePeaks = new Map<number, number>();
function settlePeak(cycles: number) {
  let peak = settlePeaks.get(cycles);
  if (peak === undefined) {
    peak = 0;
    for (let i = 1; i < 1000; i++) peak = Math.max(peak, Math.abs(settleShape(i / 1000, cycles)));
    settlePeaks.set(cycles, peak || 1);
  }
  return peak || 1;
}

/**
 * The overshoot as a move lands, `t` seconds after: past the pose along the move by up to
 * `p.settle.amount` (world units), back a little short of it, and still; 0 outside `p.settle.duration`.
 * `scale` is the personality's settle (behavior/ambient.ts settleScale, 0 to 1; 1 is Nox's): the
 * whole swing, so its peak, is that share of the amount.
 */
export function settleOvershoot(t: number, p: Micro, scale = 1): number {
  const { duration, amount, cycles } = p.settle;
  const u = within(t, duration);
  if (u === null) return 0;
  return (amount * scale * settleShape(u, cycles)) / settlePeak(cycles);
}

/**
 * The happy wiggle on arrival, `t` seconds in: the world's 'arrival' sheet (Nox's: sequences/defaults.ts, tuned
 * in the studio), its own length stretched to `p.arrival.duration`, its fractions scaled to the personality's strengths:
 * `roll` (radians, the body rocking) and `armWave` (radians at the arm tips, fanning out). Zero
 * outside the duration.
 */
export function arrivalWiggle(seq: Sequences, t: number, p: Micro): { roll: number; armWave: number } {
  const a = p.arrival;
  const u = within(t, a.duration);
  if (u === null) return { roll: 0, armWave: 0 };
  const v = seq.sample<{ roll: number; armWave: number }>('arrival', 'main', u * seq.length('arrival'));
  return { roll: a.roll * v.roll, armWave: a.armWave * v.armWave };
}

/**
 * Where an idle glance looks, `t` seconds into an idle spell (gaze units), or null before the first
 * is due. `rng` must be a fresh stream for the spell, started from the same seed on every call
 * (`seededRng(seed)`): the spell's glances are replayed from it, so the answer depends on `t` and
 * the seed alone. The first glance comes at `p.glance.first`, each next one a random wait in
 * `p.glance.wait` later, so they never fall into a beat. The draws come in the order the old
 * Attention made them: across, up, then the wait.
 */
export function idleGlance(t: number, rng: () => number, p: Micro): { x: number; y: number } | null {
  const { first, wait, x, y, lift } = p.glance;
  if (!(t >= first)) return null;
  const draw = () => ({ x: (rng() - 0.5) * x, y: lift + (rng() - 0.5) * y });
  let glance = draw();
  let start = first;
  for (;;) {
    const next = start + wait[0] + rng() * (wait[1] - wait[0]);
    // A wait never shorter than a frame keeps a broken personality from looping for ever.
    if (t < next || next <= start) return glance;
    start = next;
    glance = draw();
  }
}

/** A small seeded generator (mulberry32), 0 to 1: the same seed gives the same stream. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
