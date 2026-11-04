import { createContext, useContext } from 'react';
import type { StageId } from '../config/types';
import type { Vec3 } from '../world/types';

/**
 * What a page that embeds the host reads and drives (spec 19, P1 and P8): the instance's stage, where
 * its face is, and the same moves the engine's own UI makes. A headless host (`ui: 'none'`) is run
 * entirely through this.
 */
export interface InstanceApi {
  /** The stage the instance is in now. */
  stage: StageId;
  /** The character's face for the stage on show, on the stage plane (the point overlays stay attached to). */
  faceAnchor: Vec3;
  /** How far the live camera has moved a world point on screen, against the stage camera at rest, in CSS pixels (the object is reused by the next call). */
  liveShift(world: Vec3): { dx: number; dy: number };
  /** Opens the overview (the intro's Explore). */
  explore(): void;
  /** Steps back: a focused technology lets go, the detail goes to the overview, the overview to the intro (Escape). */
  back(): void;
  /** Skips the entrance (and does nothing after it). */
  skip(): void;
  /**
   * Makes the character look at `target` (canvas CSS pixels from the canvas's top-left corner), and
   * with `reach: true` reach toward it with the nearest arm; `null` lets both go. A focused
   * technology still holds the eyes.
   */
  attend(target: { x: number; y: number } | null, opts?: { reach?: boolean }): void;
}

export const InstanceApiContext = createContext<InstanceApi | null>(null);

/** The instance's API; throws outside a `WorldHost`, so a missing host is named, not a read of undefined. */
export function useInstanceApi(): InstanceApi {
  const api = useContext(InstanceApiContext);
  if (!api) throw new Error('useInstanceApi: no <WorldHost> above this component');
  return api;
}
