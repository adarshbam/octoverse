import * as THREE from 'three';
import { expect, test } from 'vitest';
import { CAMERA_Z } from '../../engine/config/stage';
import { projectToScreen, screenToStage } from './anchors';

const size = { width: 800, height: 600 };

function stageCamera(extra?: (camera: THREE.PerspectiveCamera) => void) {
  const camera = new THREE.PerspectiveCamera(24, size.width / size.height, 0.1, 60);
  camera.position.set(0, 0, CAMERA_Z);
  extra?.(camera);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

test('screenToStage undoes projectToScreen for a point on the stage plane (z = 0)', () => {
  const camera = stageCamera();
  for (const [x, y] of [[0, 0], [1.2, -0.7], [-2.5, 1.1], [3, 2]]) {
    const px = projectToScreen(new THREE.Vector3(x, y, 0), camera, size);
    const back = screenToStage(px, camera, size);
    expect(back.x).toBeCloseTo(x, 6);
    expect(back.y).toBeCloseTo(y, 6);
  }
});

test('it holds for a leaned camera with a lens shift, as the stage camera has', () => {
  const camera = stageCamera(c => {
    c.rotateX(0.2);
    c.setViewOffset(size.width, size.height, 0, 40, size.width, size.height);
  });
  const px = projectToScreen(new THREE.Vector3(-1.4, 0.6, 0), camera, size);
  const back = screenToStage(px, camera, size);
  expect(back.x).toBeCloseTo(-1.4, 6);
  expect(back.y).toBeCloseTo(0.6, 6);
});

test('the middle of the canvas looks at the middle of the stage, and the sides at their own sides', () => {
  const middle = screenToStage({ x: 400, y: 300 }, stageCamera(), size);
  expect(middle.x).toBeCloseTo(0, 9);
  expect(middle.y).toBeCloseTo(0, 9);
  const lowerRight = screenToStage({ x: 600, y: 450 }, stageCamera(), size);
  expect(lowerRight.x).toBeGreaterThan(0);
  expect(lowerRight.y).toBeLessThan(0);
});
