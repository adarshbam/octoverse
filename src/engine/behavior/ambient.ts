import type { Personality } from '../config/types';

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
  /** One blink's length and the double blink's gap, from the personality (`micro.blink`). */
  private readonly timing: Personality['micro']['blink'];
  private readonly rng: () => number;
  private next = 1.6;
  private start = -1;
  private double = false;

  constructor(interval: [number, number], doubleChance: number, timing: Personality['micro']['blink'], rng: () => number = Math.random) {
    this.interval = interval;
    this.doubleChance = doubleChance;
    this.timing = timing;
    this.rng = rng;
  }

  /**
   * Lid closure at `t`. `slower` stretches the wait before the next blink (1 the personality's own
   * pace; see SWIM_BLINK in expressions.ts); it is read as each blink ends.
   */
  sample(t: number, slower = 1): number {
    if (this.start < 0 && t >= this.next) {
      // A blink starts now, not when it was due, so a long gap yields one blink, not a burst.
      this.start = t;
      this.double = this.rng() < this.doubleChance;
    }
    if (this.start < 0) return 0;
    const u = (t - this.start) / this.timing.seconds;
    if (u >= 1) {
      const [low, high] = this.interval;
      this.next = t + (this.double ? this.timing.doubleGap : (low + this.rng() * (high - low)) * slower);
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
