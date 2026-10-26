/**
 * Whether a pointer over an orb means to choose it: it has come to rest there. The pointer is at
 * rest once it has stayed within `stillPx` of one spot for `dwellMs`; passing across an orb, however
 * slowly a hand moves, keeps leaving the spot and never counts, so gliding toward one orb never
 * chooses the orbs on the way.
 */
export class HoverIntent {
  private anchor: { x: number; y: number; t: number } | null = null;
  private readonly stillPx: number;
  private readonly dwellMs: number;

  constructor(stillPx = 6, dwellMs = 130) {
    this.stillPx = stillPx;
    this.dwellMs = dwellMs;
  }

  move(x: number, y: number, t: number) {
    if (!this.anchor || Math.hypot(x - this.anchor.x, y - this.anchor.y) > this.stillPx) this.anchor = { x, y, t };
  }

  due(t: number) {
    return this.anchor !== null && t - this.anchor.t >= this.dwellMs;
  }

  /** How long until the pointer, staying where it is, will have rested long enough. */
  wait(t: number) {
    return this.anchor ? Math.max(0, this.anchor.t + this.dwellMs - t) : this.dwellMs;
  }

  reset() {
    this.anchor = null;
  }
}
