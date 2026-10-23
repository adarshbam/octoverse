import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { cheekReach, createHeadGeometry, silhouetteHalfWidth } from './headGeometry';

// Rim-line trace of panel 2 (world units): the dome is widest at y = -0.44, the outline
// dips into a notch at y = -0.725, then each cheek bulges out as a round lobe, fullest
// at y = -0.835, and curves back toward the neck.
const DOME = { y: -0.44, half: 0.752 };
const NOTCH = { y: -0.725, half: 0.685 };
const CHEEK = { y: -0.835, half: 0.76, radius: 0.115 };
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

test('cheeks are round lobes: the outline follows a circle around the cheek', () => {
  const centre = CHEEK.half - CHEEK.radius;
  for (let y = CHEEK.y - 0.07; y <= CHEEK.y + 0.07; y += 0.02) {
    const circle = centre + Math.sqrt(CHEEK.radius ** 2 - (y - CHEEK.y) ** 2);
    expect(Math.abs(silhouetteHalfWidth(head, y) - circle), `y ${y.toFixed(2)}`).toBeLessThan(0.012);
  }
});

test('cheeks leave the middle of the face and the dome untouched', () => {
  for (const y of [-0.78, -0.835, -0.9]) {
    expect(cheekReach(head.cheeks, y, 0)).toBe(0);
    expect(cheekReach(head.cheeks, y, 1.2)).toBeCloseTo(cheekReach(head.cheeks, y, -1.2), 9);
  }
  expect(cheekReach(head.cheeks, -0.5, 1.2)).toBe(0);
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
