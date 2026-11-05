import type * as THREE from 'three';
import type { ArtifactConfig, PendantReveal } from '../config/types';
import type { BlowFrame } from '../sequences/bubbleBlow';
import type { Sequences } from '../sequences/theatre';
import type { Vec3 } from '../world/types';

// The bloom (spec 7.5, "Appearing"; contract 9.2 `APPEARS.bloom`): once the entrance has settled,
// each pendant grows out of a cup on its arm. The cup at its slot brightens; a small cream-gold
// pearl grows out of it; the thread draws down from the cup, carrying the pearl to where the cap
// sits; and the pearl swells into the glass orb with a soft wobble. The pendants bloom in a ripple
// from slot `order` 0 (the top arms) down, about 1.2 s in all. Pure: the channels at a moment are a
// function of the clock and the pendant's rank, so a frozen still shows any moment of it.

/** The ripple's length when the world gives no reveal (spec 7.5: about 1.2 s in all). */
export const BLOOM_SECONDS = 1.2;
/** One pendant's own bloom, as a share of the whole ripple's length (the rest is the stagger). */
const SPAN_SHARE = 0.5;
/** The orb's wobble as it swells: its largest squash (a fraction of the radius) and its half-cycles. */
const WOBBLE = 0.14;
const WOBBLE_TURNS = 1.5;

/** What a pendant shows `t` into the bloom, each 0 to 1 but `wobble` (a squash and stretch, 0 at rest). */
export interface BloomState {
  /** How bright the cup at the slot is. */
  cupGlow: number;
  /** How grown the pearl is (it becomes the thread's cap). */
  pearl: number;
  /** How far the thread has drawn down from the cup (1: its full length). */
  thread: number;
  /** How far the orb has swelled from the pearl (1: its full size). */
  orb: number;
  /** Squash and stretch as it swells: wider by this fraction and shorter by as much. */
  wobble: number;
}

/** When the pendants bloom: the first's start, one pendant's own span and the delay between ranks, in seconds. */
export type BloomTiming = PendantReveal;

/**
 * The timing for `count` pendants: the placement's `reveal` when the world sets one (A2 X3);
 * otherwise the bloom's own ripple, `duration` long in all (1.2 s), each pendant taking half of it
 * and the rest spread as the stagger between ranks.
 */
export function bloomTiming(count: number, reveal?: PendantReveal, duration = BLOOM_SECONDS): BloomTiming {
  if (reveal) return reveal;
  const n = Math.max(1, Math.floor(Number.isFinite(count) ? count : 1));
  if (n === 1) return { start: 0, span: duration, step: 0 };
  const span = duration * SPAN_SHARE;
  return { start: 0, span, step: (duration - span) / (n - 1) };
}

/** Seconds the whole bloom of `count` pendants lasts: until the last rank has bloomed. */
export function bloomLength(count: number, reveal?: PendantReveal, duration = BLOOM_SECONDS): number {
  const { start, span, step } = bloomTiming(count, reveal, duration);
  return start + Math.max(0, Math.floor(count) - 1) * step + span;
}

const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const smoother = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** Each channel's window in a pendant's own span (0 to 1): they overlap, each beginning after the one before. */
const BEATS = { cupGlow: [0, 0.3], pearl: [0.15, 0.45], thread: [0.3, 0.65], orb: [0.5, 1] } as const;

export interface BloomOptions {
  /** Motion off: every pendant is there at once, with no wobble. */
  reducedMotion?: boolean;
  /** The placement's reveal (A2 X3), which sets the timing when present. */
  reveal?: PendantReveal;
  /** The appear's own length (`appear.duration`), used when there is no reveal. */
  duration?: number;
}

/**
 * Pendant `index` (its rank in slot order: 0 blooms first) of `count`, `t` seconds into the bloom.
 * Each channel rises once, 0 to 1, and stays (monotonic); the wobble is 0 before the orb swells and
 * once it is full. Complete by `bloomLength(count)`, 1.2 s by default. With `reducedMotion` it is
 * complete at once.
 */
export function bloomState(t: number, index: number, count: number, options: BloomOptions = {}): BloomState {
  if (options.reducedMotion) return { cupGlow: 1, pearl: 1, thread: 1, orb: 1, wobble: 0 };
  const { start, span, step } = bloomTiming(count, options.reveal, options.duration);
  const clock = Number.isFinite(t) ? t : 0;
  const raw = (clock - (start + Math.max(0, index) * step)) / span;
  // A hair short of the end is the end (the sum of start, steps and span is not exact in floating point).
  const u = raw >= 1 - 1e-9 ? 1 : clamp01(raw);
  const orb = smoother(BEATS.orb[0], BEATS.orb[1], u);
  const v = (u - BEATS.orb[0]) / (BEATS.orb[1] - BEATS.orb[0]);
  const wobble = v > 0 && v < 1 ? WOBBLE * Math.sin(Math.PI * 2 * WOBBLE_TURNS * v) * (1 - v) : 0;
  return {
    cupGlow: smooth(BEATS.cupGlow[0], BEATS.cupGlow[1], u),
    pearl: smooth(BEATS.pearl[0], BEATS.pearl[1], u),
    thread: smooth(BEATS.thread[0], BEATS.thread[1], u),
    orb,
    wobble,
  };
}

/** One pendant's frame as the appear table gives it: the blow's frame (no puff, no flight: it is at its place) and the bloom's own channels. */
export type BloomFrame = BlowFrame & { bloom: Pick<BloomState, 'cupGlow' | 'pearl' | 'thread'> };

/**
 * The bloom as the appear module plays it (strategies.ts): the world's `bloom` sheet eases the
 * ripple's clock (its `main.ripple` runs 0 to 1 over the sheet; keyed straight, the clock is the
 * run's own), and `bloomState` gives each pendant's channels at that moment.
 */
export function bloomFrame(seq: Sequences, i: number, seconds: number, count: number, config: Pick<ArtifactConfig, 'appear' | 'placement'>): BloomFrame {
  const reveal = config.placement.kind === 'pendant' ? config.placement.reveal : undefined;
  const duration = config.appear.kind === 'bloom' ? config.appear.duration : BLOOM_SECONDS;
  const total = bloomLength(count, reveal, duration);
  const sheet = seq.length('bloom');
  const at = total > 0 ? clamp01((Number.isFinite(seconds) ? seconds : 0) / total) * sheet : 0;
  const ripple = clamp01(seq.sample<{ ripple: number }>('bloom', 'main', at).ripple);
  const s = bloomState(ripple * total, i, count, { reveal, duration });
  return { puff: 0, mouthRound: 0, emerged: 1, scale: s.orb, wobble: s.wobble, bloom: { cupGlow: s.cupGlow, pearl: s.pearl, thread: s.thread } };
}

/** A bloomed pendant comes from its own place: there is no way to travel. */
export const bloomOrigin = (): Vec3 => [0, 0, 0];

/** The pendant is at its place throughout (the orb grows there). */
export const bloomPosition = (_origin: Vec3, target: THREE.Vector3, _emerged: number, out: THREE.Vector3): THREE.Vector3 => out.copy(target);
