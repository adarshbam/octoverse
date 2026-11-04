import * as THREE from 'three';
import { expect, test } from 'vitest';
import { cameraHover } from '../world/cameraHover';
import { projectToScreen } from './anchors';
import { LiveAnchors } from './liveAnchors';

const size = { width: 1000, height: 800 };
function camera(position: readonly number[], look?: readonly number[]) {
  const c = new THREE.PerspectiveCamera(24, size.width / size.height, 0.1, 60);
  c.position.set(position[0], position[1], position[2]);
  if (look) c.lookAt(look[0], look[1], look[2]);
  c.updateMatrixWorld();
  return c;
}

test('anchor shift is zero with no hover and equals the projected delta with it', () => {
  const base = camera([0, 0, 12]);
  const anchors = new LiveAnchors();
  anchors.set(camera([0, 0, 12]), base, size);
  expect(anchors.shift([0.4, -0.2, 0.7])).toEqual({ dx: 0, dy: 0 });

  const { offset, look } = cameraHover(20, 1);
  const live = camera([offset[0], offset[1], 12 + offset[2]], [offset[0] + look[0], offset[1] + look[1], 12 + look[2]]);
  anchors.set(live, base, size);
  const world = [0.4, -0.2, 0.7] as const;
  const a = projectToScreen(new THREE.Vector3(...world), live, size);
  const b = projectToScreen(new THREE.Vector3(...world), base, size);
  const shift = anchors.shift(world);
  expect(shift.dx).toBeCloseTo(a.x - b.x, 9);
  expect(shift.dy).toBeCloseTo(a.y - b.y, 9);
  expect(Math.hypot(shift.dx, shift.dy)).toBeGreaterThan(1);
});

test('subscribers are told on each set, and can leave', () => {
  const anchors = new LiveAnchors();
  const base = camera([0, 0, 12]);
  let calls = 0;
  const off = anchors.subscribe(() => calls++);
  anchors.set(base, base, size);
  off();
  anchors.set(base, base, size);
  expect(calls).toBe(1);
});
