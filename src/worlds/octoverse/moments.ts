import type { ArmId, Personality } from '../../engine/config/types';
import type { Sequences } from '../../engine/sequences/theatre';
import { HOST_FACES } from './character';

// The host's character moments (platform spec 7.5, Task 11) that the landed engine has no hook for,
// as pure world-level logic read from the host's own arrival sheet (sequences/state.theatre.json),
// in the way Aether keeps its own moments (src/worlds/aether/moments.ts). Nothing in the engine
// imports this yet. What the engine plays today, and what waits on it (E02b, recorded in
// docs/superpowers/reviews/platform.md and MORNING-REVIEW-platform.md):
//   - The arrival sheet's `roll` and `armWave` are the engine's arrival wiggle (motion/micro.ts):
//     the body rocks and every arm fans, small, on the same two beats as the wave. The sheet's own
//     `t1Wave` (T1 lifting and waving twice) and `delighted` (the face) have no channel: the engine
//     drives no single arm from a sheet and takes no face from the arrival.
//   - The idle flourish runs on the engine's scheduler at the personality's rate, but it picks any
//     free arm and unrolls the tip curl; spec 7.5 asks for one upper arm (T1 or T8) giving a small
//     wave. `hostFlourishBusy` is the busy-arm hook that keeps it to the upper pair, ready for a
//     per-world hook.

type Micro = Personality['micro'];

/** The arrival starts at the settle: the arrival clock's 0 is the entrance handing over to the intro. */
export const ARRIVAL_SETTLE = 0;

/** The arms an idle flourish may play on: the upper pair, beside the head (spec 7.5). */
export const HOST_FLOURISH_ARMS: readonly ArmId[] = ['T1', 'T8'];

/** FlourishScheduler's busy-arm hook for the host: every arm but the upper pair is held busy. */
export function hostFlourishBusy(arm: ArmId): boolean {
  return !HOST_FLOURISH_ARMS.includes(arm);
}

/** The arrival sheet's `main` props at `t` seconds into the arrival (its length stretched to `micro.arrival.duration`, as the engine's wiggle is), or null outside it. */
function arrivalProps(seq: Sequences, t: number, micro: Micro): { t1Wave: number; delighted: number } | null {
  const u = t / micro.arrival.duration;
  if (!(u >= 0 && u <= 1)) return null;
  return seq.sample<{ t1Wave: number; delighted: number }>('arrival', 'main', u * seq.length('arrival'));
}

/** How far T1 is through its wave at `t` seconds into the arrival: 0 at rest, 1 at each wave's peak; 0 outside the arrival. */
export function arrivalT1Wave(seq: Sequences, t: number, micro: Micro): number {
  return arrivalProps(seq, t, micro)?.t1Wave ?? 0;
}

/** The face at `t` seconds into the arrival: `delighted` while the sheet holds it (at least half on), else `welcome`. */
export function arrivalFace(seq: Sequences, t: number, micro: Micro): (typeof HOST_FACES)['delighted' | 'welcome'] {
  const v = arrivalProps(seq, t, micro);
  return v && v.delighted >= 0.5 ? HOST_FACES.delighted : HOST_FACES.welcome;
}
