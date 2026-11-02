import * as THREE from 'three';
import { CAMERA_Z } from '../config/stage';
import { STAGE_FRAMES, fovFor } from '../stage/framing';
import { pinnedHover } from './cameraHover';
import farData from './security/far.json';
import type { Placement, Vec3, WorldLayout } from './types';

// The far plate: the ruin beyond the near world as three transparent cards, rendered in Blender
// from the panel 2 camera (blender/security/render_far.py). Its layers and their sizes are data
// (security/far.json), which the render script reads too; the tests pin the sizes to the
// functions here, so an edit on either side fails by name until the layers are rendered again.

/** The deepest the camera hovers (cameraHover.ts): x, y, z offsets at full amount. */
export const FAR_HOVER: Vec3 = [0.9, 0.3, 1.2];
/** The widest and tallest views the intro framing is shown in: a wide desktop window and a phone. */
export const FAR_VIEWPORTS = [{ width: 2560, height: 1080 }, { width: 390, height: 844 }] as const;
/** Live pieces beyond this z are in the plate instead. */
export const FAR_CUT_Z = farData.cutZ;
/** World units each card grows past the frustum on every side, so a hover never reaches its edge. */
export const FAR_OVERSCAN = 0.25;

export interface FarLayer {
  /** Depth of the card. */
  z: number;
  /** The nearest and the farthest z of the pieces the card carries (the far end is open on the last). */
  near: number;
  far: number | null;
}
/** The plate's layers as far.json has them, farthest first (the order they are drawn in). */
export const FAR_LAYERS: readonly FarLayer[] = farData.layers;

/** The layer a piece at depth `z` is drawn in; null for a piece the near world keeps. */
export function farLayerOf(z: number): FarLayer | null {
  if (z >= FAR_CUT_Z) return null;
  return FAR_LAYERS.find(layer => layer.near > z && (layer.far === null || z >= layer.far)) ?? null;
}

/** Whether the near world leaves this placement to the plate. */
export const isFarPlacement = (p: Pick<Placement, 'position'>) => p.position[2] < FAR_CUT_Z;
/** A chain is the plate's only when both of its ends are beyond (or on) the cut. */
export const isFarChain = (chain: WorldLayout['chains'][number]) => chain.from[2] <= FAR_CUT_Z && chain.to[2] <= FAR_CUT_Z;

/**
 * Card width and height at depth z so it covers the frustum with the camera displaced by up to
 * `hover` (world units), plus `overscan`. The worst case is the camera `hover[2]` farther back,
 * its view turned as the hover turns it (pinnedHover), and displaced by the sideways offsets.
 */
export function plateCardSize(z: number, camera: { z: number; fovDeg: number; aspect: number }, hover: Vec3, overscan = FAR_OVERSCAN): { width: number; height: number } {
  const [hx, hy, hz] = hover.map(Math.abs);
  const { look } = pinnedHover([hx, hy, hz]);
  // How far the view is turned from straight down -z.
  const yaw = Math.atan(Math.abs(look[0]) / Math.abs(look[2]));
  const pitch = Math.atan(Math.abs(look[1]) / Math.abs(look[2]));
  const depth = camera.z + hz - z;
  const halfV = THREE.MathUtils.degToRad(camera.fovDeg) / 2;
  const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
  return {
    width: 2 * (hx + depth * Math.tan(halfH + yaw) + overscan),
    height: 2 * (hy + depth * Math.tan(halfV + pitch) + overscan),
  };
}

/** The card for the layer at depth z: large enough for every viewport in FAR_VIEWPORTS at full hover. */
export function farCardSize(z: number) {
  const sizes = FAR_VIEWPORTS.map(viewport =>
    plateCardSize(z, { z: CAMERA_Z, fovDeg: fovFor(STAGE_FRAMES.intro, viewport), aspect: viewport.width / viewport.height }, FAR_HOVER),
  );
  return { width: Math.max(...sizes.map(s => s.width)), height: Math.max(...sizes.map(s => s.height)) };
}
