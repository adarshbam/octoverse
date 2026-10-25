import * as THREE from 'three';
import { CAMERA_Z } from '../config/stage';
import type { StageId } from '../config/types';

export interface StageFrame {
  /** World units the stage must show, across and up, on the z = 0 plane. */
  width: number;
  height: number;
}

/**
 * What each stage frames, from its storyboard panel. Focusing a technology keeps the overview's
 * framing: re-framing would move every orb under the visitor's pointer as focus begins.
 */
export const STAGE_FRAMES: Record<StageId, StageFrame> = {
  entering: { width: 5.1, height: 5.04 },
  intro: { width: 5.06, height: 5.04 },
  overview: { width: 5.15, height: 5.04 },
  techFocus: { width: 5.15, height: 5.04 },
  detail: { width: 8.51, height: 5.18 },
};

export type Layout = 'desktop' | 'tablet' | 'phone';

/** The vertical field of view, in degrees, that shows the whole frame: tall viewports widen, nothing is cropped. */
export function fovFor(frame: StageFrame, viewport: { width: number; height: number }) {
  const aspect = viewport.width / viewport.height;
  const halfHeight = Math.max(frame.height, frame.width / aspect) / 2;
  return THREE.MathUtils.radToDeg(2 * Math.atan(halfHeight / CAMERA_Z));
}

export function layoutFor({ width }: { width: number; height: number }): Layout {
  if (width < 768) return 'phone';
  if (width < 1100) return 'tablet';
  return 'desktop';
}
