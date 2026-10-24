import * as THREE from 'three';

const projected = new THREE.Vector3();

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
