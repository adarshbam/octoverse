import type { Personality } from '../config/types';
import { idleGlance, seededRng } from '../motion/micro';
import { spring } from './ambient';

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
  /**
   * The idle spell the glances come from (motion/micro.ts idleGlance): when it began, how far into
   * its schedule it began (a spell after following something starts on a glance at once, as the old
   * overdue glance did), and its seed. The first spell starts with the page.
   */
  private idle = true;
  private spellStart = 0;
  private spellLead = 0;
  private spellSeed: number;
  /** Tiny eye movements between glances (normalised gaze units), so the eyes never look frozen. */
  private micro = { x: 0, y: 0 };
  private nextMicro: number;

  constructor(personality: Personality, rng: () => number = Math.random) {
    this.personality = personality;
    this.rng = rng;
    this.spellSeed = this.seed();
    this.nextMicro = personality.micro.saccade.first;
  }

  private seed() {
    return Math.floor(this.rng() * 4294967296);
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
    const { tracking, saccade } = this.personality.micro;
    const followed = fixed ?? (pointer && t - this.lastMove < tracking ? pointer : null);
    const look = followed ?? rest ?? null;
    const resting = !followed && look !== null;
    if (!look) {
      if (!this.idle) {
        this.idle = true;
        this.spellStart = t;
        this.spellLead = this.personality.micro.glance.first;
        this.spellSeed = this.seed();
      }
      const glance = idleGlance(t - this.spellStart + this.spellLead, seededRng(this.spellSeed), this.personality.micro);
      if (glance) this.glance = glance;
    } else {
      this.idle = false;
    }
    const originX = faceCenter ? faceCenter.x : 0;
    const originY = faceCenter ? faceCenter.y : FACE_NDC_Y;
    const tx = look ? clamp1((look.x - originX) * 1.6) : this.glance.x;
    const ty = look ? clamp1((look.y - originY) * 1.6) : this.glance.y;
    if (t > this.nextMicro) {
      this.micro = { x: (this.rng() - 0.5) * saccade.x, y: (this.rng() - 0.5) * saccade.y };
      this.nextMicro = t + saccade.wait[0] + this.rng() * (saccade.wait[1] - saccade.wait[0]);
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
