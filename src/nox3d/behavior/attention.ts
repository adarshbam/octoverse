import type { Personality } from '../config/types';
import { spring } from './ambient';

const TRACKING_SECONDS = 3.5;
/** Pointer y (NDC) of the face in the intro framing; gaze is measured from there. */
const FACE_NDC_Y = -0.17;
const clamp1 = (v: number) => Math.min(1, Math.max(-1, v));

/**
 * Where Nox looks. Eyes follow a moving pointer quickly and the head follows
 * slowly; once the pointer has been still for a while, Nox makes idle glances.
 */
export class Attention {
  private readonly personality: Personality;
  private readonly rng: () => number;
  private readonly gazeX = { x: 0, v: 0 };
  private readonly gazeY = { x: 0, v: 0 };
  private readonly headX = { x: 0, v: 0 };
  private readonly headY = { x: 0, v: 0 };
  private last: { x: number; y: number } | null = null;
  private lastMove = -Infinity;
  private glance = { x: 0, y: 0 };
  private nextGlance = 2;
  /** Tiny eye movements between glances (normalised gaze units), so the eyes never look frozen. */
  private micro = { x: 0, y: 0 };
  private nextMicro = 0.4;

  constructor(personality: Personality, rng: () => number = Math.random) {
    this.personality = personality;
    this.rng = rng;
  }

  /**
   * `pointer` is in normalised device coordinates, or null when it left the page. `fixed`, also in
   * normalised device coordinates, is something Nox keeps looking at (a focused orb) regardless.
   * `faceCenter` is the NDC coordinate of Nox's face, so gaze measures from the face in any framing.
   * `rest`, also in NDC, is where the eyes settle when there is nothing to follow (the detail panel)
   * instead of glancing about. Resting is the eyes' alone: the stage pose already turns the head
   * toward it, so the head holds still, and nothing counts as followed (`tracking`).
   */
  update(pointer: { x: number; y: number } | null, t: number, dt: number, fixed?: { x: number; y: number }, faceCenter?: { x: number; y: number }, rest?: { x: number; y: number }) {
    if (pointer && (!this.last || Math.abs(pointer.x - this.last.x) + Math.abs(pointer.y - this.last.y) > 1e-6)) {
      this.last = { ...pointer };
      this.lastMove = t;
    }
    if (!pointer) this.last = null;
    const followed = fixed ?? (pointer && t - this.lastMove < TRACKING_SECONDS ? pointer : null);
    const look = followed ?? rest ?? null;
    const resting = !followed && look !== null;
    if (!look && t > this.nextGlance) {
      this.glance = { x: (this.rng() - 0.5) * 0.45, y: 0.05 + (this.rng() - 0.5) * 0.3 };
      this.nextGlance = t + 2.0 + this.rng() * 2.5;
    }
    const originX = faceCenter ? faceCenter.x : 0;
    const originY = faceCenter ? faceCenter.y : FACE_NDC_Y;
    const tx = look ? clamp1((look.x - originX) * 1.6) : this.glance.x;
    const ty = look ? clamp1((look.y - originY) * 1.6) : this.glance.y;
    if (t > this.nextMicro) {
      this.micro = { x: (this.rng() - 0.5) * 0.07, y: (this.rng() - 0.5) * 0.05 };
      this.nextMicro = t + 0.35 + this.rng() * 0.9;
    }
    spring(this.gazeX, tx, this.personality.gazeOmega, dt);
    spring(this.gazeY, ty, this.personality.gazeOmega, dt);
    spring(this.headX, resting ? 0 : tx, this.personality.headOmega, dt);
    spring(this.headY, resting ? 0 : ty, this.personality.headOmega, dt);
    // The tiny movements are the eyes' alone, and instant, as real micro-saccades are: the face
    // is redrawn once for each, not for every frame of a glide. The head only follows the look.
    const gazeX = Math.min(1, Math.max(-1, this.gazeX.x + this.micro.x));
    const gazeY = Math.min(1, Math.max(-1, this.gazeY.x + this.micro.y));
    return { gazeX, gazeY, headX: this.headX.x, headY: this.headY.x, tracking: followed !== null };
  }
}

/** How near the pointer is to Nox's face, both in NDC: 1 on the face, 0 from about 0.7 away. */
export function nearFace(pointer: { x: number; y: number }, face: { x: number; y: number }) {
  return Math.max(0, 1 - Math.hypot(pointer.x - face.x, pointer.y - face.y) * 1.4);
}
