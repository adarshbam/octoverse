import * as THREE from 'three';
import { CAMERA_Z } from '../config/stage';
import { type StageFrame, fovFor } from '../stage/framing';
import { pinnedHover } from './cameraHover';
import type { Placement, Vec3, WorldLayout } from './types';

// The far plate: the ruin beyond the near world as three transparent cards, rendered in Blender
// from the panel 2 camera (blender/security/render_far.py). Its layers and their sizes are the
// world's data (Nox's far.json, which the render script reads too); the world's place config hands
// the cut and the layers to the engine as `WorldConfig.farPlate`. The tests pin the sizes to the
// functions here, so an edit on either side fails by name until the layers are rendered again.

/** The deepest the camera hovers (cameraHover.ts): x, y, z offsets at full amount. */
export const FAR_HOVER: Vec3 = [0.9, 0.3, 1.2];
/** The widest and tallest views the intro framing is shown in: a wide desktop window and a phone. */
export const FAR_VIEWPORTS = [{ width: 2560, height: 1080 }, { width: 390, height: 844 }] as const;
/** World units each card grows past the frustum on every side, so a hover never reaches its edge. */
export const FAR_OVERSCAN = 0.6;

export interface FarLayer {
  /** Depth of the card. */
  z: number;
  /** The nearest and the farthest z of the pieces the card carries (the far end is open on the last). */
  near: number;
  far: number | null;
}

/**
 * The layer a piece at depth `z` is drawn in, among a world's `layers` (farthest first, as the
 * world's far.json has them); null for a piece the near world keeps: live pieces at or beyond
 * `cutZ` are in the plate instead.
 */
export function farLayerOf(z: number, cutZ: number, layers: readonly FarLayer[]): FarLayer | null {
  if (z >= cutZ) return null;
  return layers.find(layer => layer.near > z && (layer.far === null || z >= layer.far)) ?? null;
}

/** Whether the near world leaves this placement to the plate (the world's `farPlate.cutZ`). */
export const isFarPlacement = (p: Pick<Placement, 'position'>, cutZ: number) => p.position[2] < cutZ;
/** A chain is the plate's only when both of its ends are beyond (or on) the cut. */
export const isFarChain = (chain: WorldLayout['chains'][number], cutZ: number) => chain.from[2] <= cutZ && chain.to[2] <= cutZ;

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

/**
 * The card for the layer at depth z: large enough for every viewport in FAR_VIEWPORTS at full
 * hover, framed as the intro frames the stage (`introFrame`, the world's `stage.frames.intro`).
 */
export function farCardSize(z: number, introFrame: StageFrame) {
  const sizes = FAR_VIEWPORTS.map(viewport =>
    plateCardSize(z, { z: CAMERA_Z, fovDeg: fovFor(introFrame, viewport), aspect: viewport.width / viewport.height }, FAR_HOVER),
  );
  return { width: Math.max(...sizes.map(s => s.width)), height: Math.max(...sizes.map(s => s.height)) };
}

/**
 * Leaves out up to `levels` of a compressed texture's largest mip levels, so it draws (and uploads)
 * smaller. Block-compressed storage needs a base level whose sides are multiples of 4, so it stops
 * at the last drop that leaves one (a layer 1024 x 900 keeps its full size: 450 is not).
 */
export function dropMips(texture: THREE.Texture, levels: number) {
  const mipmaps = (texture as THREE.CompressedTexture).mipmaps;
  if (!mipmaps) return;
  let drop = Math.min(levels, mipmaps.length - 1);
  while (drop > 0 && (mipmaps[drop].width % 4 !== 0 || mipmaps[drop].height % 4 !== 0)) drop--;
  if (drop <= 0) return;
  const kept = mipmaps.slice(drop);
  (texture as THREE.CompressedTexture).mipmaps = kept;
  texture.image = { width: kept[0].width, height: kept[0].height };
}
