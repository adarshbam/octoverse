import type { StageId } from '../config/types';
import type { Vec3 } from './types';

/** Seconds a hover takes to ease to a new target amount (from full to still, or back). */
export const HOVER_EASE_S = 0.6;

/**
 * The test scene's drift: the camera's position offset (0.9 sin 0.23t, 0.3 sin(0.17t + 1), 1.2 sin 0.11t)
 * and, from the unmoved camera, the point it looks at (0.3 sin 0.23t, -0.05, -24), the offsets times
 * `amount`. The look distance (-24) is the way the camera faces, so it does not shrink with `amount`.
 */
export function cameraHover(t: number, amount: number): { offset: Vec3; look: Vec3 } {
  return {
    offset: [0.9 * Math.sin(0.23 * t) * amount + 0, 0.3 * Math.sin(0.17 * t + 1) * amount + 0, 1.2 * Math.sin(0.11 * t) * amount + 0],
    look: [0.3 * Math.sin(0.23 * t) * amount + 0, -0.05 * amount + 0, -24],
  };
}

/** The hover a pinned offset (`?hover=x,y,z`) stands for: the position offset, with the look following as the drift's does. */
export function pinnedHover(offset: Vec3): { offset: Vec3; look: Vec3 } {
  const moved = offset[0] !== 0 || offset[1] !== 0 || offset[2] !== 0;
  return { offset, look: [offset[0] / 3, moved ? -0.05 : 0, -24] };
}

/**
 * Target hover amount: intro and entering 1, overview 0.5, techFocus and detail 0; 0 with reduced motion.
 * Nothing a technology bubble does (hover, choice, the suction hold) enters it: the camera goes on drifting.
 */
export function hoverTarget(stage: StageId, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  switch (stage) {
    case 'entering':
    case 'intro':
      return 1;
    case 'overview':
      return 0.5;
    default:
      return 0;
  }
}

/** Moves `amount` toward `target` at a pace that takes HOVER_EASE_S to cross the whole range 0 to 1. */
export function easeHover(amount: number, target: number, delta: number): number {
  const step = delta / HOVER_EASE_S;
  return amount < target ? Math.min(target, amount + step) : Math.max(target, amount - step);
}

/** Whether the pointer is on a technology bubble: the orbits ease to still and no arm reaches for the pointer while it is (the camera takes no notice). */
export const bubblePointer = { hovered: false };
