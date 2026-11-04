/**
 * Whether a pointer over an orb means to choose it: it has come to rest there. The pointer is at
 * rest once it has stayed within `stillPx` of one spot for `dwellMs`; passing across an orb, however
 * slowly a hand moves, keeps leaving the spot and never counts, so gliding toward one orb never
 * chooses the orbs on the way.
 *
 * A bubble drifts, so it can also come to the pointer: one that slides under a pointer that has not
 * moved (for `arriveMs`, or since) is not chosen, however long it stays there, until the hand moves.
 * The page tells the intent where the pointer is wherever it is (`track`); entering a bubble
 * (`enter`) says whether the pointer got there by moving, and `engaged` is that.
 */
export class HoverIntent {
  private anchor: { x: number; y: number; t: number } | null = null;
  private last: { x: number; y: number } | null = null;
  private movedAt = Number.NEGATIVE_INFINITY;
  /** Whether the pointer on the bubble has moved since it came there, or came there moving. */
  engaged = false;
  private readonly stillPx: number;
  private readonly dwellMs: number;
  private readonly arriveMs: number;

  constructor(stillPx = 6, dwellMs = 130, arriveMs = 250) {
    this.stillPx = stillPx;
    this.dwellMs = dwellMs;
    this.arriveMs = arriveMs;
  }

  /** The pointer is at (x, y) at time t, over a bubble or not. */
  track(x: number, y: number, t: number) {
    if (!this.last || this.last.x !== x || this.last.y !== y) this.movedAt = t;
    this.last = { x, y };
  }

  /** The pointer has come onto a bubble. */
  enter(x: number, y: number, t: number) {
    this.anchor = { x, y, t };
    // With no earlier word of the pointer, it is taken to have arrived moving.
    this.engaged = this.last === null || t - this.movedAt <= this.arriveMs;
    this.last = { x, y };
  }

  move(x: number, y: number, t: number) {
    if (this.last === null || this.last.x !== x || this.last.y !== y) {
      this.movedAt = t;
      this.engaged = true;
    }
    this.last = { x, y };
    if (!this.anchor || Math.hypot(x - this.anchor.x, y - this.anchor.y) > this.stillPx) this.anchor = { x, y, t };
  }

  due(t: number) {
    return this.engaged && this.anchor !== null && t - this.anchor.t >= this.dwellMs;
  }

  /** How long until the pointer, staying where it is, will have rested long enough. */
  wait(t: number) {
    return this.anchor ? Math.max(0, this.anchor.t + this.dwellMs - t) : this.dwellMs;
  }

  /** The pointer has left the bubble. */
  reset() {
    this.anchor = null;
    this.engaged = false;
  }
}
