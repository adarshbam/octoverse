import { expect, test } from 'vitest';
import type { ArmSpec, Point2 } from '../config/types';
import { CAMERA_Z } from '../config/stage';
import { armLength, flattenForDepth, toContent, toStage, withLength, withRoot } from './authoring';

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

test('toStage places a content point under the body, scaled, and toContent undoes it', () => {
  const body = { x: -0.34, y: 0.225, scale: 1.1, yaw: 0 };
  // Veyra's overview: the face origin is drawn at the body plus 1.1 times it, not the body plus it.
  const [x, y] = toStage([0.3, -0.4], body);
  expect(x).toBeCloseTo(-0.34 + 1.1 * 0.3, 12);
  expect(y).toBeCloseTo(0.225 + 1.1 * -0.4, 12);
  const [[cx, cy]] = toContent([[x, y]], body);
  expect(cx).toBeCloseTo(0.3, 12);
  expect(cy).toBeCloseTo(-0.4, 12);
  // At scale 1 (every Nox stage) the sums are exactly the unscaled ones, bit for bit.
  const [bx, by] = [0.1 + 0.2, -0.7 + 0.35];
  expect(toStage([0.123456789, -0.987654321], { x: bx, y: by, scale: 1 })).toEqual([0.123456789 + bx, -0.987654321 + by]);
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
