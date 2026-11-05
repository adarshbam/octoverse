import { type ArmId, type PendantPlacement, type PendantReveal, type PendantSlot, ARM_IDS } from '../config/types';
import type { AppearFrame } from './strategies';
import { bloomState } from './bloom';
import { layoutPendants } from './pendant';

// The pulse appear (Flux spec 7.5, "Appearing"; contract F2, `APPEARS.pulse`): once the entrance has
// settled the arms fire their cup pulses in pipeline order, two at a time in four steps: T1 and T8,
// then T2 and T7, T3 and T6, T4 and T5, `step` seconds apart. Each pulse runs root to tip, and where
// it arrives the orb grows at its slot (the bloom's own grow, its orb channel and wobble). In the
// intro the orbs' size is nothing, so the visitor sees the waves and no orbs; the head's swell then
// grows each orb from nothing to its overview size (`revealSize`), staggered by swell progress.
// Pure: what an orb shows at a moment is a function of the run's clock and the swell, so a frozen
// still shows any moment of it. It plays no Theatre sheet (A1 G5).

/** The pairs, in the order they fire: each arm with the one that mirrors it (T<n> and T<9 - n>). */
const PAIRS: readonly (readonly [ArmId, ArmId])[] = [['T1', 'T8'], ['T2', 'T7'], ['T3', 'T6'], ['T4', 'T5']];

/** One arm's pulse: the arm and the moment of the run it is fired. */
export interface PulseFire {
  arm: ArmId;
  fireAt: number;
}

/** The arms' firing times for pairs `step` seconds apart: (T1, T8) at 0, (T2, T7) at `step`, (T3, T6) at 2 x `step`, (T4, T5) at 3 x `step`. */
export function pulseSchedule(step: number): PulseFire[] {
  return PAIRS.flatMap(([left, right], pair) => [{ arm: left, fireAt: pair * step }, { arm: right, fireAt: pair * step }]);
}

/**
 * When the orb at `slot` starts to grow: its arm's pulse has run out to the slot's place on the arm.
 * `speed` is the pulse's, in arc fractions a second (the cups' `pulse.speed`, so the orb meets the
 * band's head).
 */
export function orbGrowStart(slot: Pick<PendantSlot, 'arm' | 'at'>, schedule: readonly PulseFire[], speed: number): number {
  const fire = schedule.find(f => f.arm === slot.arm);
  return (fire?.fireAt ?? 0) + slot.at / speed;
}

/** Seconds one orb takes to grow once its pulse reaches it (the bloom's orb beat is half of its own span). */
export const PULSE_GROW = 0.5;

/** The arms the appear lights at once with motion off, for 0.3 s (the cup shader's reduced path): all eight. */
export const PULSE_LIGHT = { reduced: ARM_IDS } as const;

/**
 * The arms whose pulse is fired in the frame that takes the run from `from` to `to` seconds: those
 * with `from < fireAt <= to`. The first frame passes `-Infinity`, so a pair at 0 fires in it, and
 * each arm fires once however the frames fall.
 */
export function pulseDue(from: number, to: number, step: number): readonly ArmId[] {
  let due: ArmId[] | null = null;
  PAIRS.forEach(([left, right], pair) => {
    const at = pair * step;
    if (from < at && at <= to) (due ??= []).push(left, right);
  });
  return due ?? NONE;
}
const NONE: readonly ArmId[] = Object.freeze([]);

/** What the appear reads of a world's artifacts and of the cups' pulse. */
export interface PulseContext {
  appear: { kind: string; step?: number };
  placement: { kind: string };
  /** The character's cup pulse (`suckers.pulse`): the speed the band runs at. */
  pulse?: { speed: number };
}

/** The pulse's speed when a context gives none (a world without cups cannot use this appear; validateBundle refuses it). */
const FALLBACK_SPEED = 1;

const stepOf = (config: PulseContext) => (config.appear.kind === 'pulse' && typeof config.appear.step === 'number' ? config.appear.step : 0);
const speedOf = (config: PulseContext) => (config.pulse && config.pulse.speed > 0 ? config.pulse.speed : FALLBACK_SPEED);

/** When each orb starts to grow, and the timing the bloom's grow is asked for, worked out once per placement and count. */
interface Growth {
  starts: (number | null)[];
  reveals: (PendantReveal | null)[];
}

// An accepted exception to "no module-level state" (the same as strategies.ts focusPoses): a cache of
// derived data only, keyed by the world's placement object, held weakly, so it never outlives a bundle
// and never carries one instance's state into another (the same placement and count give the same starts).
const growths = new WeakMap<object, Map<string, Growth>>();

/**
 * Where the technologies sit for the appear: technology i takes the i-th slot by order of the
 * overview (the stage the orbs show in; the intro shows them at no size). Null for one with no slot.
 */
function growthFor(config: PulseContext & { placement: PendantPlacement }, count: number): Growth {
  const { placement } = config;
  const speed = speedOf(config);
  const step = stepOf(config);
  let byKey = growths.get(placement);
  if (!byKey) growths.set(placement, (byKey = new Map()));
  const key = `${count}/${step}/${speed}`;
  let growth = byKey.get(key);
  if (!growth) {
    const schedule = pulseSchedule(step);
    const places = layoutPendants(count, placement, 'overview');
    const starts = places.map(place => (place ? orbGrowStart(place.slot, schedule, speed) : null));
    // The bloom's grow, asked for so that its orb channel begins exactly when the pulse reaches the slot (the orb beat is the second half of the span).
    const reveals = starts.map(start => (start === null ? null : { start: start - PULSE_GROW, span: 2 * PULSE_GROW, step: 0 }));
    growth = { starts, reveals };
    byKey.set(key, growth);
  }
  return growth;
}

/** Seconds the whole appear of `count` orbs lasts: until the last orb has grown. */
export function pulseLength(count: number, placement: PendantPlacement, step: number, speed: number): number {
  const growth = growthFor({ appear: { kind: 'pulse', step }, placement, pulse: { speed } }, Math.max(0, Math.floor(count)));
  return growth.starts.reduce<number>((last, start) => (start === null ? last : Math.max(last, start + PULSE_GROW)), 0);
}

/**
 * Orb `i` of `count`, `seconds` into the appear: nothing until its arm's pulse reaches its slot,
 * then the bloom's own grow with its soft wobble (scale 0 to 1, monotonic). It grows where it hangs
 * (it travels nowhere) and the face does nothing. Complete by `pulseLength`. The sequences are not
 * read: this appear plays no sheet.
 */
export function pulseFrame(_sequences: unknown, i: number, seconds: number, count: number, config: PulseContext): AppearFrame {
  if (config.placement.kind !== 'pendant') return { puff: 0, mouthRound: 0, emerged: 1, scale: 1, wobble: 0 };
  const { starts, reveals } = growthFor(config as PulseContext & { placement: PendantPlacement }, Math.max(0, Math.floor(count)));
  const start = starts[i];
  const reveal = reveals[i];
  // An orb with no slot is not drawn by the placement; it is simply full here.
  if (start === null || start === undefined || !reveal) return { puff: 0, mouthRound: 0, emerged: 1, scale: 1, wobble: 0 };
  const clock = Number.isFinite(seconds) ? seconds : 0;
  if (clock <= start) return { puff: 0, mouthRound: 0, emerged: 1, scale: 0, wobble: 0 };
  const grown = bloomState(clock, 0, 1, { reveal });
  return { puff: 0, mouthRound: 0, emerged: 1, scale: grown.orb, wobble: grown.wobble };
}

/** The pulse appear travels nowhere: the orb is where it hangs. */
export const pulseOrigin = (): [number, number, number] => [0, 0, 0];

const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);

/**
 * How far orb `index` (the technology's index: tips first, in slot order) has revealed at head-swell
 * progress `swell` (0 closed, 1 open; past 1 is the overshoot), 0 to 1: it grows over swell
 * `start + step x index` to that plus `span`, clamped to 1 (a window that would run past full ends
 * at full), eased. A reveal that begins at full holds back until full. Monotonic in swell.
 */
export function revealFraction(swell: number, index: number, reveal: PendantReveal): number {
  if (!Number.isFinite(swell)) return 0;
  const from = reveal.start + reveal.step * Math.max(0, index);
  const to = Math.min(1, from + reveal.span);
  if (to <= from) return swell >= 1 ? 1 : 0;
  if (swell <= from) return 0;
  const x = clamp01((swell - from) / (to - from));
  return x * x * (3 - 2 * x);
}

/** Orb `index`'s radius at swell progress `swell`: its overview size `size` times how far it has revealed. */
export const revealSize = (swell: number, index: number, reveal: PendantReveal, size: number): number => size * revealFraction(swell, index, reveal);
