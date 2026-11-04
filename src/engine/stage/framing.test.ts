import * as THREE from 'three';
import { expect, test } from 'vitest';
import { CAMERA_Z } from '../config/stage';
import { projectToScreen } from './anchors';
import { NOX_STAGE_FRAMES as STAGE_FRAMES } from '../../worlds/nox/bundle';
import { fovFor, layoutFor } from './framing';

const halfHeightSeen = (fov: number) => CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(fov) / 2);

test('fov fits intro on a square viewport', () => {
  expect(Math.abs(fovFor(STAGE_FRAMES.intro, { width: 506, height: 504 }) - 23.7)).toBeLessThan(0.2);
});

test('tall viewports widen instead of cropping', () => {
  for (const frame of Object.values(STAGE_FRAMES)) {
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
      const half = halfHeightSeen(fovFor(frame, viewport));
      expect(half * 2 + 1e-9).toBeGreaterThanOrEqual(frame.height);
      expect(half * 2 * (viewport.width / viewport.height) + 1e-9).toBeGreaterThanOrEqual(frame.width);
    }
  }
  expect(fovFor(STAGE_FRAMES.intro, { width: 390, height: 844 })).toBeGreaterThan(fovFor(STAGE_FRAMES.intro, { width: 506, height: 504 }));
});

test('layout breakpoints at 768 and 1100', () => {
  expect(layoutFor({ width: 767, height: 900 })).toBe('phone');
  expect(layoutFor({ width: 768, height: 900 })).toBe('tablet');
  expect(layoutFor({ width: 1099, height: 900 })).toBe('tablet');
  expect(layoutFor({ width: 1100, height: 900 })).toBe('desktop');
});

test('projectToScreen puts the stage centre in the middle and hides points behind the camera', () => {
  const camera = new THREE.PerspectiveCamera(fovFor(STAGE_FRAMES.intro, { width: 800, height: 600 }), 800 / 600, 0.1, 60);
  camera.position.set(0, 0, CAMERA_Z);
  camera.updateMatrixWorld();
  const centre = projectToScreen(new THREE.Vector3(0, 0, 0), camera, { width: 800, height: 600 });
  expect(centre.x).toBeCloseTo(400, 6);
  expect(centre.y).toBeCloseTo(300, 6);
  expect(centre.visible).toBe(true);
  const up = projectToScreen(new THREE.Vector3(0, 1, 0), camera, { width: 800, height: 600 });
  expect(up.y).toBeLessThan(300);
  expect(projectToScreen(new THREE.Vector3(0, 0, 20), camera, { width: 800, height: 600 }).visible).toBe(false);
});

test('focusing a technology keeps the overview framing, so the orbs stay where they were', () => {
  expect(STAGE_FRAMES.techFocus).toEqual(STAGE_FRAMES.overview);
});
