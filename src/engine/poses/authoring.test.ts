import { expect, test } from 'vitest';
import type { ArmSpec, Point2 } from '../config/types';
import { CAMERA_Z } from '../config/stage';
import { armLength, flattenForDepth, toContent, withLength, withRoot } from './authoring';

const arm = (depth: ArmSpec['depth'], z: [number, number]) => ({ depth, z }) as unknown as ArmSpec;
const place = { bodyX: 0.1, rootY: -1 };

test('withRoot gathers the hidden root toward the body line, lower for a front arm', () => {
  const visible: Point2[] = [[1.1, -0.5], [2, -0.4]];
  expect(withRoot(arm('middle', [0, 0]), visible, place)).toEqual([[0.1 + 1 * 0.2, -1], ...visible]);
  expect(withRoot(arm('front', [0, 0]), visible, place, 0)[0]).toEqual([0.1, -1.1]);
});

test('withRoot keeps an explicit root', () => {
  expect(withRoot(arm('rear', [0, 0]), [[1, 1]], place, 0.2, [5, 6])).toEqual([[5, 6], [1, 1]]);
});

test('flattenForDepth leaves a flat arm alone and pulls a forward arm toward the view axis', () => {
  const curve: Point2[] = [[0, 0], [1, 1], [2, 2]];
  expect(flattenForDepth(curve, arm('middle', [0, 0]))).toEqual(curve);
  const [, , tip] = flattenForDepth(curve, arm('front', [0.5, 0.5]));
  expect(tip[0]).toBeCloseTo(2 * ((CAMERA_Z - 0.5) / CAMERA_Z), 9);
});

test('toContent undoes the body placement', () => {
  expect(toContent([[2, 3]], { x: 1, y: 1, scale: 2, yaw: 0 })).toEqual([[0.5, 1]]);
});

test('withLength scales a curve about its root to the asked length', () => {
  const curve: Point2[] = [[0, 0], [1, 0], [2, 0], [3, 0]];
  const longer = withLength(curve, armLength(curve) * 1.5);
  expect(longer[0]).toEqual([0, 0]);
  expect(armLength(longer) / armLength(curve)).toBeCloseTo(1.5, 3);
});
