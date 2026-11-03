import type { HeadShape, StageId } from '../config/types';

/** How near an arm's tip the pointer must come for that arm to reach for it. */
export const REACH_RANGE = 0.8;
/** Arms let go this far outside the head's outline, before a pointer heading inward folds them back. */
const HEAD_MARGIN = 0.45;

/**
 * Which arm reaches for the pointer (arm space): the one whose tip is nearest it, within
 * REACH_RANGE. None reaches while the pointer is over the head, so an arm never folds back into
 * the face; hovering the face only makes Nox smile. Returns -1 when no arm reaches.
 */
export function reachingArm(tips: readonly { x: number; y: number }[], target: { x: number; y: number }, head: HeadShape) {
  const rx = head.halfWidth + HEAD_MARGIN;
  const ry = (head.top - head.bottom) / 2 + HEAD_MARGIN;
  const cy = (head.top + head.bottom) / 2;
  if (((target.x - head.centerX) / rx) ** 2 + ((target.y - cy) / ry) ** 2 < 1) return -1;
  let active = -1;
  let best = REACH_RANGE;
  tips.forEach((tip, i) => {
    const d = Math.hypot(tip.x - target.x, tip.y - target.y);
    if (d < best) {
      best = d;
      active = i;
    }
  });
  return active;
}

/**
 * Whether an arm may reach for the pointer: only in the intro, while the orbs are still mostly
 * in and the eyes follow the pointer, and not while the pointer is on a bubble (hovered or held).
 * Out of the intro the arms keep to the stage's own motion; beside the detail panel Nox only idles
 * and glances.
 */
export function reachesForPointer(stage: StageId, orbsOut: number, tracking: boolean, bubbleHot: boolean) {
  return stage === 'intro' && orbsOut < 0.5 && tracking && !bubbleHot;
}
