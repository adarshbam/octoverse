import * as THREE from 'three';
import { expect, test } from 'vitest';
import { CAMERA_Z } from '../config/stage';
import { fovFor, STAGE_FRAMES } from '../stage/framing';
import { noxFaceAnchor } from '../stage/liveAnchors';
import { lensShift } from './lensShift';
import type { Vec3 } from './types';

const SIZE = { width: 1536, height: 1024 };

/** Where `point` lands in pixels for a camera at `position` looking down -z, pitched up by `pitch`, its frame shifted down by `offsetY` of its height. */
function screenOf(point: Vec3, fovDeg: number, pitch: number, offsetY: number) {
  const camera = new THREE.PerspectiveCamera(fovDeg, SIZE.width / SIZE.height, 0.1, 140);
  camera.position.set(0, 0, CAMERA_Z);
  camera.rotateX(pitch);
  if (offsetY !== 0) camera.setViewOffset(SIZE.width, SIZE.height, 0, offsetY * SIZE.height, SIZE.width, SIZE.height);
  camera.updateMatrixWorld();
  const p = new THREE.Vector3(...point).project(camera);
  return { x: ((p.x + 1) / 2) * SIZE.width, y: ((1 - p.y) / 2) * SIZE.height };
}

const fov = fovFor(STAGE_FRAMES.intro, SIZE);

test("lens shift keeps Nox's face at the same screen place", () => {
  const face = noxFaceAnchor('intro');
  const before = screenOf(face, fov, 0, 0);
  for (const tilt of [0.03, 0.07, 0.12, 0.2]) {
    const { pitch, offsetY } = lensShift(tilt, face, { position: [0, 0, CAMERA_Z], fovDeg: fov });
    expect(pitch).toBe(tilt);
    // Pitching up lifts the view, so the frame shifts down: a positive offset.
    expect(offsetY).toBeGreaterThan(0);
    const after = screenOf(face, fov, pitch, offsetY);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(0.5);
  }
  // Without the shift the pitch alone moves the face by far more than that.
  expect(screenOf(face, fov, 0.07, 0).y - before.y).toBeGreaterThan(30);
});

test("lens shift holds the overview's face, and any point's height, whatever its distance", () => {
  const overview = noxFaceAnchor('overview');
  const before = screenOf(overview, fov, 0, 0);
  const shift = lensShift(0.07, overview, { position: [0, 0, CAMERA_Z], fovDeg: fov });
  const after = screenOf(overview, fov, shift.pitch, shift.offsetY);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(0.5);
  // A point that is not kept (here far down and behind) leans with the world: only the kept point's height is held.
  const far: Vec3 = [1.4, -1.1, -6];
  const kept = lensShift(0.07, far, { position: [0, 0, CAMERA_Z], fovDeg: fov });
  expect(Math.abs(screenOf(far, fov, kept.pitch, kept.offsetY).y - screenOf(far, fov, 0, 0).y)).toBeLessThan(0.5);
});

test('zero tilt gives zero offset', () => {
  const { pitch, offsetY } = lensShift(0, noxFaceAnchor('intro'), { position: [0, 0, CAMERA_Z], fovDeg: fov });
  expect(pitch).toBe(0);
  expect(offsetY).toBe(0);
});
