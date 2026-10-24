import * as THREE from 'three';
import type { CheekShape, HeadShape } from '../config/types';

/** Lathe radius of the mantle at world height y: a superellipse dome above the waist, the neck below. */
export function mantleRadius(head: HeadShape, y: number) {
  const { halfWidth, waist, top, bottom, topPower, bottomPower } = head;
  const upper = y > waist;
  const n = upper ? topPower : bottomPower;
  const s = Math.abs((y - waist) / (upper ? top - waist : waist - bottom));
  return s >= 1 ? 0 : halfWidth * Math.pow(1 - Math.pow(s, n), 1 / n);
}

/**
 * Where a ray from the head's axis at world height y, heading `theta` from the front of
 * the face (radians), leaves a cheek sphere; 0 when it misses both. The two cheeks mirror
 * each other, so only |theta| matters.
 */
export function cheekReach(cheeks: CheekShape, y: number, theta: number) {
  const angle = THREE.MathUtils.degToRad(cheeks.angle);
  const along = cheeks.distance * Math.cos(Math.abs(theta) - angle);
  const rest = cheeks.distance ** 2 + (y - cheeks.y) ** 2 - cheeks.radius ** 2;
  const disc = along * along - rest;
  return disc <= 0 || along <= 0 ? 0 : along + Math.sqrt(disc);
}

/** Both cheek lobes' centres in world units, left then right. */
export function cheekCentres(head: HeadShape) {
  const { distance, angle, y } = head.cheeks;
  const a = THREE.MathUtils.degToRad(angle);
  const z = distance * Math.cos(a) * head.depth;
  return [-1, 1].map(side => ({ x: head.centerX + side * distance * Math.sin(a), y, z }));
}

/** Mantle radius along a ray with the cheeks merged in: a smooth maximum keeps the join soft. */
function withCheeks(head: HeadShape, r: number, y: number, theta: number) {
  const reach = cheekReach(head.cheeks, y, theta);
  if (reach === 0) return r;
  const k = head.cheeks.blend;
  const h = Math.max(k - Math.abs(r - reach), 0) / k;
  return Math.max(r, reach) + h * h * k * 0.25;
}

/** Half-width of the head's outline seen from the front, at world height y. */
export function silhouetteHalfWidth(head: HeadShape, y: number) {
  const r = mantleRadius(head, y);
  if (r === 0) return 0;
  let widest = r;
  for (let i = 0; i <= 360; i++) {
    const theta = (i / 360) * Math.PI;
    widest = Math.max(widest, withCheeks(head, r, y, theta) * Math.sin(theta));
  }
  return widest;
}

/**
 * Mantle as a lathe of two superellipses fitted to the reference rim line, a dome
 * above the widest point and the neck below, with round cheeks merged into its
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
    const grow = withCheeks(head, r, y + faceOrigin[1], Math.atan2(x, z)) / r;
    position.setXYZ(i, x * grow, y, z * grow);
  }
  geometry.scale(1, 1, depth);
  geometry.translate(centerX - faceOrigin[0], 0, 0);
  geometry.computeVertexNormals();
  return geometry;
}
