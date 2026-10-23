import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { cheekOffset, createHeadGeometry, silhouetteHalfWidth } from './headGeometry';

// Rim-line trace of panel 2 (world units): the dome is widest at y = -0.44, the outline
// dips into a notch at y = -0.71, then the cheeks stick out to their fullest at y = -0.81.
const DOME = { y: -0.44, half: 0.752 };
const NOTCH = { y: -0.71, half: 0.69 };
const CHEEK = { y: -0.81, half: 0.78 };
const head = NOX.head;

test('the dome is widest at the reference height and width', () => {
  expect(Math.abs(silhouetteHalfWidth(head, DOME.y) - DOME.half)).toBeLessThan(0.02);
});

test('the outline dips into a notch between the dome and the cheeks', () => {
  const notch = silhouetteHalfWidth(head, NOTCH.y);
  expect(Math.abs(notch - NOTCH.half)).toBeLessThan(0.02);
  expect(notch).toBeLessThan(silhouetteHalfWidth(head, -0.6));
  expect(notch).toBeLessThan(silhouetteHalfWidth(head, CHEEK.y));
});

test('cheeks stick out below the notch', () => {
  expect(Math.abs(silhouetteHalfWidth(head, CHEEK.y) - CHEEK.half)).toBeLessThan(0.02);
});

test('cheeks leave the middle of the face and the dome untouched', () => {
  for (const y of [-0.75, -0.81, -0.9]) {
    expect(cheekOffset(head.cheeks, y, 0)).toBe(0);
    expect(cheekOffset(head.cheeks, y, 1.2)).toBeCloseTo(cheekOffset(head.cheeks, y, -1.2), 9);
  }
  expect(cheekOffset(head.cheeks, -0.5, 1.2)).toBe(0);
});

test('the head mesh carries the cheeks', () => {
  const p = createHeadGeometry(head).attributes.position.array as Float32Array;
  const [ox, oy] = head.faceOrigin;
  let widest = 0;
  for (let i = 0; i < p.length; i += 3) {
    const y = p[i + 1] + oy;
    if (Math.abs(y - CHEEK.y) < 0.02) widest = Math.max(widest, Math.abs(p[i] + ox - head.centerX));
  }
  expect(Math.abs(widest - CHEEK.half)).toBeLessThan(0.02);
});
