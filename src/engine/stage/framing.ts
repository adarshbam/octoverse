import * as THREE from 'three';
import { CAMERA_Z } from '../config/stage';

/**
 * What one stage frames: world units it must show, across and up, on the z = 0 plane. A world's
 * frames are its bundle's (`WorldBundle.stage.frames`; Nox's are bundle.nox.ts NOX_STAGE_FRAMES).
 */
export interface StageFrame {
  width: number;
  height: number;
}

/** A rectangle on the z = 0 plane in world units: [left, top, right, bottom] (top above bottom). */
export type WorldBox = readonly [number, number, number, number];

/**
 * The HTML panels the stage lays over the 3D scene, traced in world units from the world's own
 * storyboard: the project panel inside the overview's dome, and the full project view's panel.
 */
export interface StagePanels {
  overview: WorldBox;
  detail: WorldBox;
}

/** The intro's title lines, in world units: the widest line's half width, and the top of the kicker (the stage % of intro.css). */
export interface IntroTitleBox {
  halfWidth: number;
  top: number;
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
