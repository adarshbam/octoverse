import * as THREE from 'three';
import type { CheekShape, HeadShape } from '../config/types';

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Lathe radius of the mantle at world height y: a superellipse dome above the waist, the neck below. */
export function mantleRadius(head: HeadShape, y: number) {
  const { halfWidth, waist, top, bottom, topPower, bottomPower } = head;
  const upper = y > waist;
  const n = upper ? topPower : bottomPower;
  const s = Math.abs((y - waist) / (upper ? top - waist : waist - bottom));
  return s >= 1 ? 0 : halfWidth * Math.pow(1 - Math.pow(s, n), 1 / n);
}

/**
 * How far the cheeks push the mantle out at world height y and angle `theta`
 * from the front of the face (radians). Nothing in the middle of the face or on
 * the dome; fullest toward the sides at the cheek height.
 */
export function cheekOffset(cheeks: CheekShape, y: number, theta: number) {
  const { top, y: fullest, bottom, bulge, angle, spread } = cheeks;
  const vertical = y > fullest ? smoothstep(top, fullest, y) : smoothstep(bottom, fullest, y);
  const a = (Math.abs(theta) - THREE.MathUtils.degToRad(angle)) / THREE.MathUtils.degToRad(spread);
  if (vertical === 0 || Math.abs(a) >= 1) return 0;
  return bulge * vertical * Math.cos((a * Math.PI) / 2) ** 2;
}

/** Half-width of the head's outline seen from the front, at world height y. */
export function silhouetteHalfWidth(head: HeadShape, y: number) {
  const r = mantleRadius(head, y);
  if (r === 0) return 0;
  let widest = r;
  for (let i = 0; i <= 180; i++) {
    const theta = (i / 180) * Math.PI;
    widest = Math.max(widest, (r + cheekOffset(head.cheeks, y, theta)) * Math.sin(theta));
  }
  return widest;
}

/**
 * Mantle as a lathe of two superellipses fitted to the reference rim line, a dome
 * above the widest point and the neck below, with the cheeks pushed out of its
 * sides. Coordinates are local to `head.faceOrigin`, which is where the mesh is placed.
 */
export function createHeadGeometry(head: HeadShape) {
  const { centerX, halfWidth, waist, top, bottom, topPower, bottomPower, depth, faceOrigin } = head;
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= 160; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / 160;
    const upper = t > 0;
    const n = upper ? topPower : bottomPower;
    const x = halfWidth * Math.pow(Math.abs(Math.cos(t)), 2 / n);
    const y = waist + (upper ? top - waist : waist - bottom) * Math.sign(Math.sin(t)) * Math.pow(Math.abs(Math.sin(t)), 2 / n);
    points.push(new THREE.Vector2(i === 0 || i === 160 ? 0 : x, y - faceOrigin[1]));
  }
  // Seam at the back (phiStart = PI puts phi 0 at -z) so it never shows.
  const geometry = new THREE.LatheGeometry(points, 160, Math.PI, Math.PI * 2);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-6) continue;
    const grow = 1 + cheekOffset(head.cheeks, y + faceOrigin[1], Math.atan2(x, z)) / r;
    position.setXYZ(i, x * grow, y, z * grow);
  }
  geometry.scale(1, 1, depth);
  geometry.translate(centerX - faceOrigin[0], 0, 0);
  geometry.computeVertexNormals();
  return geometry;
}
