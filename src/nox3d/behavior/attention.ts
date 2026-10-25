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

  constructor(personality: Personality, rng: () => number = Math.random) {
    this.personality = personality;
    this.rng = rng;
  }

  /**
   * `pointer` is in normalised device coordinates, or null when it left the page. `fixed`, also in
   * normalised device coordinates, is something Nox keeps looking at (a focused orb) regardless.
   * `faceCenter` is the NDC coordinate of Nox's face, so gaze measures from the face in any framing.
   */
  update(pointer: { x: number; y: number } | null, t: number, dt: number, fixed?: { x: number; y: number }, faceCenter?: { x: number; y: number }) {
    if (pointer && (!this.last || Math.abs(pointer.x - this.last.x) + Math.abs(pointer.y - this.last.y) > 1e-6)) {
      this.last = { ...pointer };
      this.lastMove = t;
    }
    if (!pointer) this.last = null;
    const look = fixed ?? (pointer && t - this.lastMove < TRACKING_SECONDS ? pointer : null);
    const tracking = look !== null;
    if (!look && t > this.nextGlance) {
      this.glance = { x: (this.rng() - 0.5) * 0.45, y: 0.05 + (this.rng() - 0.5) * 0.3 };
      this.nextGlance = t + 2.0 + this.rng() * 2.5;
    }
    const originX = faceCenter ? faceCenter.x : 0;
    const originY = faceCenter ? faceCenter.y : FACE_NDC_Y;
    const tx = look ? clamp1((look.x - originX) * 1.6) : this.glance.x;
    const ty = look ? clamp1((look.y - originY) * 1.6) : this.glance.y;
    spring(this.gazeX, tx, this.personality.gazeOmega, dt);
    spring(this.gazeY, ty, this.personality.gazeOmega, dt);
    spring(this.headX, tx, this.personality.headOmega, dt);
    spring(this.headY, ty, this.personality.headOmega, dt);
    return { gazeX: this.gazeX.x, gazeY: this.gazeY.x, headX: this.headX.x, headY: this.headY.x, tracking };
  }
}
