import type * as THREE from 'three';
import { mantleRadius } from '../character/headGeometry';
import type { FaceLayout, HeadShape, StageId } from '../config/types';
import type { Vec3 } from '../world/types';
import { BLOW_STAGGER, SEQUENCE_DEFAULTS } from './keys';
import type { Sequences } from './theatre';

// The bubble blow (design 9.8): once the entrance has settled, Nox blows the technology bubbles
// from his mouth, one after another. Before each, his cheeks puff and his mouth rounds; the bubble
// pops out and wobbles as it grows to full size, on its way from the mouth to its orbit. The keys
// live in the Theatre sheet `bubbleBlow` (defaults in keys.ts), one bubble's blow, played once per
// bubble BLOW_STAGGER s apart. The wobble is a squash and stretch from the sheet: no arm physics.

export interface BlowFrame {
  /** 0 to 1: how far the cheeks are puffed. */
  puff: number;
  /** 0 to 1: how round the mouth is. */
  mouthRound: number;
  /** 0 to 1: how far along the way from the mouth to its orbit (blowPosition). */
  emerged: number;
  /** The bubble's size, 1 full; 0 before it pops out. */
  scale: number;
  /** Squash and stretch: wider by this fraction and shorter by as much (negative, the other way). */
  wobble: number;
}

/** One bubble's blow in seconds: the sheet's length. */
const BLOW_SECONDS = SEQUENCE_DEFAULTS.bubbleBlow.length;

/** Seconds the whole blow of `count` bubbles lasts: the last one starts (count - 1) staggers in. */
export function blowLength(count: number) {
  return Math.max(0, count - 1) * BLOW_STAGGER + BLOW_SECONDS;
}

/** The sheet's props at one moment. */
const sampleSheet = (seq: Sequences, seconds: number): BlowFrame => {
  const k = seq.sample<BlowFrame>('bubbleBlow', 'main', seconds);
  return { puff: k.puff, mouthRound: k.mouthRound, emerged: k.emerged, scale: Math.max(0, k.scale), wobble: k.wobble };
};

/** Each loaded sheet's first and last frames: a bubble before or after its blow holds them, unsampled. */
const ends = new WeakMap<Sequences, { before: BlowFrame; after: BlowFrame }>();

/**
 * Bubble i of n, `seconds` after the blow began: puff 0-0.25 s, pop 0.25-0.33 s, wobble-grow
 * 0.33-0.9 s, bubbles 0.18 s apart. Before its turn it is the sheet's first frame (no bubble, no
 * puff), after it the last (full size on its orbit); only a bubble in its blow samples the sheet.
 */
export function blowFrame(seq: Sequences, i: number, seconds: number): BlowFrame {
  const local = (Number.isFinite(seconds) ? seconds : 0) - i * BLOW_STAGGER;
  let edge = ends.get(seq);
  if (!edge) {
    edge = { before: sampleSheet(seq, 0), after: sampleSheet(seq, BLOW_SECONDS) };
    ends.set(seq, edge);
  }
  if (local <= 0) return { ...edge.before };
  if (local >= BLOW_SECONDS) return { ...edge.after };
  return sampleSheet(seq, local);
}

/** Whether the bubbles exist in `stage`: the intro, the overview and a technology focus; never the entrance or beside the detail. */
export function bubblesExist(stage: StageId) {
  return stage === 'intro' || stage === 'overview' || stage === 'techFocus';
}

/**
 * Where the bubbles come out, in the bubbles' space (the body space, the head unturned): the
 * character's mouth, on the front of the face. The face is drawn about the head's faceOrigin, so
 * the mouth there is faceOrigin + mouth.center; the front of the mantle at that height is its
 * radius times its depth. Worked out once per instance, from its character's head and face.
 */
export function blowMouth(head: HeadShape, face: FaceLayout): Vec3 {
  const y = head.faceOrigin[1] + face.mouth.center[1];
  return [head.faceOrigin[0] + face.mouth.center[0], y, mantleRadius(head, y) * head.depth + 0.04];
}

/** How far in front of the mouth (and of the orbit, if that is nearer) the way bows out, in world units. */
const BOW = 0.8;

/**
 * The bubble's place `emerged` (0 to 1, eased in the sheet) along its way from the `mouth`
 * (`blowMouth`) to its orbit point `orbit`: a curve that bows out toward the visitor, so even a
 * place behind the head is reached round the front of it, never through it. Written into `out`.
 */
export function blowPosition(mouth: Vec3, orbit: THREE.Vector3, emerged: number, out: THREE.Vector3): THREE.Vector3 {
  const s = Math.min(1, Math.max(0, emerged));
  const [mx, my, mz] = mouth;
  if (s === 0) return out.set(mx, my, mz);
  if (s === 1) return out.copy(orbit);
  // A quadratic Bezier through a control point half way across and BOW in front.
  const cx = (mx + orbit.x) / 2;
  const cy = (my + orbit.y) / 2;
  const cz = Math.max(mz, orbit.z) + BOW;
  const a = (1 - s) * (1 - s);
  const b = 2 * s * (1 - s);
  const c = s * s;
  return out.set(a * mx + b * cx + c * orbit.x, a * my + b * cy + c * orbit.y, a * mz + b * cz + c * orbit.z);
}

/** Seconds of frames the blow waits for its sheet before the bubbles simply fade in instead. */
export const BLOW_SHEET_WAIT = 4;

/** The blow's sheet as the page loads it (App.tsx): the sequences once they are in, or that they failed. */
export interface BlowSheet {
  sequences: Sequences | null;
  failed: boolean;
  /** With motion off (`?freeze&blow=<s>`): the moment of the blow a still shows, in seconds. */
  at?: number;
}

export interface BlowStep {
  /** The bubbles exist in this stage (bubblesExist). */
  exist: boolean;
  /** Motion is off (reduced motion, `?freeze`): no blow, the bubbles are simply there. */
  still: boolean;
  /** The sheet has loaded. */
  ready: boolean;
  /** The sheet will not load: the bubbles fade in as before, at once. */
  failed?: boolean;
  /** Seconds since the last frame. */
  dt: number;
  /** How many bubbles are blown. */
  count: number;
  /** With `still`: the moment of the blow a still shows, in seconds (for review stills). */
  at?: number;
}

/**
 * The blow's clock. It starts the first time the bubbles exist (the entrance has settled, or the
 * page opened past it) and runs on frame time until the last bubble is full size; it plays once.
 * With motion off there is no blow (unless a still asks for a moment of it); if the sheet has not
 * come within BLOW_SHEET_WAIT s the blow is given up and the bubbles fade in as before.
 */
export class BlowRun {
  /** Seconds into the blow; null until it starts. */
  seconds: number | null = null;
  /** Over (or given up, or not wanted): the bubbles are on their orbits. */
  done = false;
  private waited = 0;

  /** Whether the blow is playing (or held by a still): the bubbles and the face follow it. */
  get blowing() {
    return this.seconds !== null && !this.done;
  }

  step({ exist, still, ready, failed = false, dt, count, at }: BlowStep) {
    if (this.done) return;
    if (still && at !== undefined) {
      if (ready) this.seconds = at;
      return;
    }
    if (this.seconds === null) {
      if (!exist) return;
      if (still || failed) this.done = true;
      else if (ready) this.seconds = 0;
      else if ((this.waited += dt) >= BLOW_SHEET_WAIT - 1e-9) this.done = true;
      return;
    }
    // Motion turned off, or the bubbles gone (the detail) mid-blow: it ends at once.
    if (still || !exist) {
      this.done = true;
      return;
    }
    this.seconds += dt;
    if (this.seconds >= blowLength(count)) this.done = true;
  }
}
