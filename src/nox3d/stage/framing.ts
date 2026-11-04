import * as THREE from 'three';
import { CAMERA_Z } from '../../engine/config/stage';

/**
 * What one stage frames: world units it must show, across and up, on the z = 0 plane. A world's
 * frames are its bundle's (`WorldBundle.stage.frames`; Nox's are bundle.nox.ts NOX_STAGE_FRAMES).
 */
export interface StageFrame {
  width: number;
  height: number;
}

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
