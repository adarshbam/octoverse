import type { ExpressionId } from './expressions';

/**
 * The beats of a technology focus, in ms from the moment it is chosen. The eyes turn at once
 * (they follow the choice directly); the face reacts a beat later; the dome folds away as the
 * eyes settle; the arm then lifts the orb to present it; the tooltip comes once that reads.
 * Letting go runs the other way: the tooltip goes, the arm and emphasis settle, then the dome
 * reopens. Tuned by eye against recordings, following the owner's motion brief.
 */
export const FOCUS_BEATS = {
  face: { delay: 120, ms: 500 },
  arm: { delay: 280, ms: 650 },
  release: { ms: 480 },
  faceRelease: { ms: 450 },
  /** The dome folding away as a technology comes into focus from the overview. */
  dome: { delay: 150, ms: 650 },
  /** The dome reopening as Nox lets go and returns to the overview. */
  domeBack: { delay: 250, ms: 1000 },
  tooltip: 600,
} as const;

/** How Nox reacts to a technology: its project's own reaction, else a subtle curiosity. */
export function focusReaction(usage?: { reaction?: 'focused' | 'curious' }): ExpressionId {
  return usage?.reaction ?? 'curious';
}

const smoothstep = (x: number) => x * x * (3 - 2 * x);
const smootherstep = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

/**
 * One timeline for every orb, driven by a single choice (an orb index, or -1 for none), so the
 * presentation, the face and the release can never disagree or run against each other. Each
 * orb's progress moves toward its target at a fixed rate and eases on the way, so a new choice,
 * however quick, retargets from wherever things are: nothing jumps or restarts.
 */
export class FocusChoreography {
  private selected = -1;
  private since = 0;
  private readonly armProgress: Float32Array;
  private readonly faceProgress: Float32Array;

  constructor(count: number) {
    this.armProgress = new Float32Array(count);
    this.faceProgress = new Float32Array(count);
  }

  /** Advances to `nowMs` with `selected` chosen. With `instant` (reduced motion) nothing travels. */
  update(selected: number, nowMs: number, dtMs: number, instant = false) {
    if (selected !== this.selected) {
      this.selected = selected;
      this.since = nowMs;
    }
    const elapsed = nowMs - this.since;
    for (let i = 0; i < this.armProgress.length; i++) {
      const on = i === selected;
      this.armProgress[i] = advance(this.armProgress[i], on && (instant || elapsed >= FOCUS_BEATS.arm.delay), on ? FOCUS_BEATS.arm.ms : FOCUS_BEATS.release.ms, dtMs, instant);
      this.faceProgress[i] = advance(this.faceProgress[i], on && (instant || elapsed >= FOCUS_BEATS.face.delay), on ? FOCUS_BEATS.face.ms : FOCUS_BEATS.faceRelease.ms, dtMs, instant);
    }
  }

  /** How far orb i is presented (0..1, eased): its arm's lift and its own emphasis. */
  arm(i: number) {
    return smootherstep(this.armProgress[i]);
  }

  /** How far Nox's face has turned to orb i's reaction (0..1, eased). */
  face(i: number) {
    return smoothstep(this.faceProgress[i]);
  }
}

function advance(progress: number, rising: boolean, ms: number, dtMs: number, instant: boolean) {
  if (instant) return rising ? 1 : 0;
  const step = dtMs / ms;
  return rising ? Math.min(1, progress + step) : Math.max(0, progress - step);
}
