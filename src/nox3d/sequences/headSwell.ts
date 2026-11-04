import { domeState } from '../../engine/character/domeMaterial';
import { SWELL_PUSH_SETTLED } from './keys';
import type { Sequences } from './theatre';

// The head swell (design 9.9): clicking the head, or the nameplate's Explore button, swells it like
// a thought into the overview's glass dome. A small squeeze first (the anticipation), then the
// swell, running past full and settling back; the bubbles are pushed out with it and the head's
// effect (Nox's glowing red glyphs) fades in as it settles. Closing (Escape, or clicking the head
// again) plays it backwards. The keys live in the Theatre sheet `headSwell` (Nox's defaults in sequences/defaults.ts).
// No physics (ledger R52, R56): the overshoot is in the timeline.

export interface SwellFrame {
  /** The head's change into the dome: 0 closed, 1 open, above 1 swollen past full (the overshoot). */
  morph: number;
  /** The anticipation: 0 to 1, how far the head is squeezed before it swells. */
  squeeze: number;
  /** How far the bubbles' orbits are pushed out: orbitPoint's `swell`. */
  push: number;
  /** 0 to 1: how far the head's effect has come in. */
  effect: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * The swell `seconds` into an opening (`opening`), or into a closing, which is the opening played
 * backwards. Written into `out` if given.
 */
export function swellFrame(seq: Sequences, seconds: number, opening: boolean, out: SwellFrame = { morph: 0, squeeze: 0, push: 0, effect: 0 }): SwellFrame {
  const length = seq.length('headSwell');
  const s = Math.min(length, Math.max(0, Number.isFinite(seconds) ? seconds : 0));
  const k = seq.sample<SwellFrame>('headSwell', 'main', opening ? s : length - s);
  out.morph = k.morph;
  out.squeeze = Math.max(0, k.squeeze);
  out.push = Math.max(0, k.push);
  out.effect = clamp01(k.effect);
  return out;
}

/** The head at rest, open (swollen, settled) or closed: what the sheet ends on, with no sheet needed. */
export function restingSwell(open: boolean, out: SwellFrame = { morph: 0, squeeze: 0, push: 0, effect: 0 }): SwellFrame {
  out.morph = open ? 1 : 0;
  out.squeeze = 0;
  out.push = open ? SWELL_PUSH_SETTLED : 0;
  out.effect = open ? 1 : 0;
  return out;
}

/**
 * How a full squeeze shapes the head: narrower by `across` (x and z) and shorter by `up`, as
 * fractions; the head's scale is 1 - squeeze * each.
 */
export const SQUEEZE = { across: 0.03, up: 0.07 } as const;

/** How much bigger the dome's glass is than its settled size: the swell's overshoot past 1. */
export function domeBulge(morph: number) {
  return Math.max(1, morph);
}

/** What the head and its dome draw for one swell frame (Octopus writes these to its meshes and materials). */
export interface HeadDraw {
  /** The head's morph into the dome (the skin's and halo's `uMorph`), 0 to 1. */
  morph: number;
  /** The dome's glass, as domeState gives it for that morph. */
  visible: boolean;
  reveal: number;
  opacity: number;
  /** The glass's size (1 settled) and how far its centre rises, in half-heights, so its seat stays put. */
  scale: number;
  lift: number;
  /** The head mesh's scale across (x, z) and up (y): the squeeze. */
  across: number;
  up: number;
}

/** The head and dome for swell frame `f`, written into `out`: settled open, exactly the approved dome (domeState(1)). */
export function headDraw(f: SwellFrame, out: HeadDraw): HeadDraw {
  const morph = clamp01(f.morph);
  const glass = domeState(morph);
  const bulge = domeBulge(f.morph);
  out.morph = morph;
  out.visible = glass.visible;
  out.reveal = glass.reveal;
  out.opacity = glass.opacity;
  out.scale = glass.scale * bulge;
  out.lift = bulge - 1;
  out.across = 1 - SQUEEZE.across * f.squeeze;
  out.up = 1 - SQUEEZE.up * f.squeeze;
  return out;
}

/** The swell's sheet as the page loads it (host/WorldHost.tsx): the sequences once they are in, or that they failed. */
export interface SwellSheet {
  sequences: Sequences | null;
  failed: boolean;
  /**
   * Seconds one opening (or closing) lasts: the world's sheet length, known before the sheet loads
   * (its defaults, which the loaded sheet's `length('headSwell')` also reads), so the swell's clock
   * runs on it while the sheet is still on its way.
   */
  seconds: number;
  /** With motion off (`?freeze&swell=<s>`): the moment of the opening a still shows, in seconds. */
  at?: number;
}

export interface SwellStep {
  /** Where the head is going: open (the overview, and a focus from it) or closed. */
  open: boolean;
  /** Motion is off (reduced motion, `?freeze`): the head is simply open or closed. */
  still: boolean;
  /** Seconds since the last frame. */
  dt: number;
  /** With `still`: the moment of the opening a still shows, in seconds (for review stills). */
  at?: number;
}

/**
 * The swell's clock. The head starts where the page opens it (no swell on load); each change of
 * where it is going plays the sheet that way, on frame time. Turned round part-way, it carries on
 * from the same moment of the sheet the other way, so it never jumps. With motion off it is at its
 * end at once. `length` is one opening's seconds (`SwellSheet.seconds`: the world's sheet).
 */
export class SwellRun {
  /** Where the head is going. */
  open = false;
  /** Seconds into the current opening or closing; `length` once it is over. */
  seconds: number;
  private started = false;
  /** Motion is off (and no still asks for a moment): the head is at its end, whatever drives it. */
  private still = false;

  /** One opening's seconds. */
  readonly length: number;

  constructor(length: number) {
    this.length = length;
    this.seconds = length;
  }

  /** Whether an opening or a closing is playing. */
  get moving() {
    return this.seconds < this.length;
  }

  step({ open, still, dt, at }: SwellStep) {
    this.still = still && at === undefined;
    if (still && at !== undefined) {
      this.started = true;
      this.open = open;
      this.seconds = Math.min(this.length, Math.max(0, at));
      return;
    }
    if (!this.started) {
      this.started = true;
      this.open = open;
      this.seconds = this.length;
      return;
    }
    if (open !== this.open) {
      this.open = open;
      this.seconds = Math.max(0, this.length - this.seconds);
    }
    this.seconds = still ? this.length : Math.min(this.length, this.seconds + Math.max(0, dt));
  }

  /**
   * The head now. With the sheet in, the swell samples it while it plays and holds its end
   * otherwise; without the sheet (it has not loaded, or failed) the stage blend's own eased
   * `fallback` openness drives the head, with no squeeze or overshoot. With motion off it is at its
   * end, sheet or not.
   */
  frame(seq: Sequences | null, fallback: number, out: SwellFrame): SwellFrame {
    if (this.still) return restingSwell(this.open, out);
    if (!seq) {
      const f = clamp01(fallback);
      out.morph = f;
      out.squeeze = 0;
      out.push = f * SWELL_PUSH_SETTLED;
      const e = clamp01((f - 0.6) / 0.4);
      out.effect = e * e * (3 - 2 * e);
      return out;
    }
    if (!this.moving) return restingSwell(this.open, out);
    return swellFrame(seq, this.seconds, this.open, out);
  }
}
