import * as THREE from 'three';

const projected = new THREE.Vector3();
const origin = new THREE.Vector3();
const through = new THREE.Vector3();

/**
 * Where a world point lands on the canvas, in CSS pixels from its top-left corner, for anchoring
 * page UI to the scene; `visible` is false behind the camera or beyond its far plane.
 */
export function projectToScreen(world: THREE.Vector3, camera: THREE.Camera, size: { width: number; height: number }) {
  projected.copy(world).project(camera);
  return {
    x: ((projected.x + 1) / 2) * size.width,
    y: ((1 - projected.y) / 2) * size.height,
    visible: projected.z > -1 && projected.z < 1,
  };
}

/**
 * The point on the stage plane (z = 0) that a canvas pixel (CSS pixels from the canvas's top-left
 * corner) looks at: the ray from the camera through the pixel, met with z = 0. It undoes
 * `projectToScreen` for a point on that plane. The camera's matrices must be current (the host's
 * frame loop keeps them so). A ray parallel to the plane meets it nowhere: the camera's own x and y.
 */
export function screenToStage(px: { x: number; y: number }, camera: THREE.Camera, size: { width: number; height: number }): { x: number; y: number } {
  const from = camera.getWorldPosition(origin);
  const ray = through.set((px.x / size.width) * 2 - 1, 1 - (px.y / size.height) * 2, 0.5).unproject(camera).sub(from).normalize();
  if (Math.abs(ray.z) < 1e-9) return { x: from.x, y: from.y };
  const along = -from.z / ray.z;
  return { x: from.x + ray.x * along, y: from.y + ray.y * along };
}
