import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import * as THREE from 'three';
import { cheekCentres, cheekReach, createDomeGeometry, createHeadGeometry, silhouetteHalfWidth } from './headGeometry';

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

test('each cheek lobe centre sits inside the outline, one lobe radius in from its fullest point', () => {
  const [left, right] = cheekCentres(head);
  expect(right.y).toBeCloseTo(head.cheeks.y, 9);
  expect(left.x).toBeCloseTo(2 * head.centerX - right.x, 9);
  expect(Math.abs(right.x - head.centerX + head.cheeks.radius - silhouetteHalfWidth(head, head.cheeks.y))).toBeLessThan(0.02);
  expect(right.z).toBeGreaterThan(0);
});

test('the overview dome: a wide glass capsule at the traced size, centred over the face', () => {
  const dome = NOX.dome;
  const box = new THREE.Box3().setFromBufferAttribute(createDomeGeometry(dome).attributes.position as THREE.BufferAttribute);
  expect(box.min.x).toBeCloseTo(-dome.halfWidth, 3);
  expect(box.max.x).toBeCloseTo(dome.halfWidth, 3);
  expect(box.max.y - box.min.y).toBeCloseTo(2 * dome.halfHeight, 3);
  expect(box.max.z).toBeCloseTo(dome.depth, 3);
  // Built round its own centre; the stage places it.
  expect((box.min.y + box.max.y) / 2).toBeCloseTo(0, 6);
});

test('as the dome opens, the mantle top sinks beneath it, its sides rising straight into it, and the face below stays put', () => {
  const g = createHeadGeometry(head, NOX.dome.mantleTop);
  const p = g.attributes.position;
  const m = g.attributes.aMorph;
  const oy = head.faceOrigin[1];
  let top = -Infinity;
  let widestNearTop = 0;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + oy;
    const my = m.getY(i) + oy;
    top = Math.max(top, my);
    if (my > NOX.dome.mantleTop - 0.03) widestNearTop = Math.max(widestNearTop, Math.abs(m.getX(i) - (head.centerX - head.faceOrigin[0])));
    if (y < -0.56) {
      expect(m.getX(i)).toBeCloseTo(p.getX(i), 6);
      expect(m.getY(i)).toBeCloseTo(p.getY(i), 6);
      expect(m.getZ(i)).toBeCloseTo(p.getZ(i), 6);
    }
  }
  expect(top).toBeCloseTo(NOX.dome.mantleTop, 2);
  // Under the dome the sides stay nearly full width: no rounded lid.
  expect(widestNearTop).toBeGreaterThan(0.85 * head.halfWidth);
  expect(g.attributes.aMorphNormal.count).toBe(p.count);
});

test('half-way through the change the mantle is a lower round dome, never a flat-topped bucket', () => {
  const g = createHeadGeometry(head, NOX.dome.mantleTop);
  const p = g.attributes.position;
  const mid = g.attributes.aMorphMid;
  expect(g.attributes.aMorphMidNormal.count).toBe(p.count);
  const oy = head.faceOrigin[1];
  const cx = head.centerX - head.faceOrigin[0];
  let top = -Infinity;
  for (let i = 0; i < mid.count; i++) top = Math.max(top, mid.getY(i) + oy);
  // Lower than the head, higher than the sunk top under the glass.
  expect(top).toBeLessThan(head.top - 0.2);
  expect(top).toBeGreaterThan(NOX.dome.mantleTop + 0.1);
  // Rounded: just under its top it is narrow, unlike the sunk shape, which is nearly full width there.
  let nearTop = 0;
  for (let i = 0; i < mid.count; i++) if (mid.getY(i) + oy > top - 0.02) nearTop = Math.max(nearTop, Math.abs(mid.getX(i) - cx));
  expect(nearTop).toBeLessThan(0.45 * head.halfWidth);
  // The face below it stays put.
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) + oy < -0.56) expect(mid.getY(i)).toBeCloseTo(p.getY(i), 6);
  }
});
