import type { Personality } from '../config/types';

const BLINK_SECONDS = 0.17;
const DOUBLE_BLINK_GAP = 0.12;
const MAX_STEP = 1 / 20;

const smoothstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const smootherstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/**
 * Critically damped spring toward a target; `omega` sets the response speed.
 * Long frame gaps (a hidden tab) are clamped so nothing overshoots on return.
 */
export function spring(state: { x: number; v: number }, target: number, omega: number, dt: number) {
  const h = Math.min(dt, MAX_STEP);
  const f = 1 + 2 * h * omega;
  const hoo = h * omega * omega;
  const det = 1 / (f + h * hoo);
  const x = (f * state.x + h * state.v + h * hoo * target) * det;
  state.v = (state.v + hoo * (target - state.x)) * det;
  state.x = x;
}

/** Irregular blinking with an occasional quick double blink. Returns lid closure 0..1. */
export class BlinkScheduler {
  private readonly interval: [number, number];
  private readonly doubleChance: number;
  private readonly rng: () => number;
  private next = 1.6;
  private start = -1;
  private double = false;

  constructor(interval: [number, number], doubleChance: number, rng: () => number = Math.random) {
    this.interval = interval;
    this.doubleChance = doubleChance;
    this.rng = rng;
  }

  sample(t: number): number {
    if (this.start < 0 && t >= this.next) {
      // A blink starts now, not when it was due, so a long gap yields one blink, not a burst.
      this.start = t;
      this.double = this.rng() < this.doubleChance;
    }
    if (this.start < 0) return 0;
    const u = (t - this.start) / BLINK_SECONDS;
    if (u >= 1) {
      const [low, high] = this.interval;
      this.next = t + (this.double ? DOUBLE_BLINK_GAP : low + this.rng() * (high - low));
      this.start = -1;
      this.double = false;
      return 0;
    }
    return u < 0.4 ? smootherstep(u / 0.4) : 1 - smoothstep((u - 0.4) / 0.6);
  }
}

/** Buoyant float: two incommensurate waves so the loop never visibly repeats. */
export function floatOffset(t: number, personality: Personality) {
  const { amplitude, period } = personality.float;
  const w1 = (Math.PI * 2) / period;
  const w2 = (Math.PI * 2) / (period * 0.53);
  return {
    x: amplitude * 0.27 * Math.sin(t * 0.37),
    y: amplitude * Math.sin(t * w1) + (amplitude / 3) * Math.sin(t * w2 + 1.3),
    vy: amplitude * w1 * Math.cos(t * w1) + (amplitude / 3) * w2 * Math.cos(t * w2 + 1.3),
    roll: 0.012 * Math.sin(t * 0.81),
  };
}

/** Breathing phase, -1..1. */
export function breath(t: number, period: number) {
  return Math.sin((t * Math.PI * 2) / period);
}
