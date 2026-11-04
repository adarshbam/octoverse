import type * as THREE from 'three';
import type { Vec3 } from './types';

/**
 * Camera pitch up by `tilt` and the vertical view offset (fraction of frame height) that keeps the point `keep` at the same screen place.
 *
 * A low camera looking up makes the pillars converge toward the top, as in panel 2. Pitching the
 * camera lifts the view and moves everything down the screen; shifting the frame down by `offsetY`
 * (three's `setViewOffset`, a lens shift: the frame moves, the camera does not) moves it back, so
 * `keep` (Nox's face) lands where it did, and the rest of the world leans around it. `camera` is
 * the unpitched camera, facing -z, with its vertical field of view in degrees.
 */
export function lensShift(tilt: number, keep: Vec3, camera: { position: Vec3; fovDeg: number }): { pitch: number; offsetY: number } {
  if (tilt === 0) return { pitch: 0, offsetY: 0 };
  const half = Math.tan((camera.fovDeg * Math.PI) / 360);
  const y = keep[1] - camera.position[1];
  const z = keep[2] - camera.position[2];
  const level = y / -z / half;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const pitched = (y * cos + z * sin) / -(-y * sin + z * cos) / half;
  // Screen height is two units of normalised y, so a frame shifted by f of its height moves the picture by 2 f.
  return { pitch: tilt, offsetY: (level - pitched) / 2 };
}

/** The part of the full frame a camera shows (as three's `setViewOffset` takes it): the whole canvas, or a zoom's window. */
export interface LeanFrame {
  fullWidth: number;
  fullHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Leans a camera that is placed and aimed: pitches it up by `tilt` and shifts its frame down to
 * match (lensShift), so `keep` stays where it was. `rest` is where the unleaned camera stands.
 */
export function leanCamera(camera: THREE.PerspectiveCamera, tilt: number, keep: Vec3, rest: Vec3, frame: LeanFrame) {
  if (tilt === 0) return;
  const { pitch, offsetY } = lensShift(tilt, keep, { position: rest, fovDeg: camera.fov });
  camera.rotateX(pitch);
  camera.setViewOffset(frame.fullWidth, frame.fullHeight, frame.x, frame.y + offsetY * frame.fullHeight, frame.width, frame.height);
}
