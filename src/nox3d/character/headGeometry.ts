import * as THREE from 'three';
import type { HeadShape } from '../config/types';

/**
 * Mantle as a lathe of two superellipses fitted to the reference rim line: a dome
 * above the widest point and fuller cheeks below. Coordinates are local to
 * `head.faceOrigin`, which is where the mesh is placed.
 */
export function createHeadGeometry(head: HeadShape) {
  const { centerX, halfWidth, waist, top, bottom, topPower, bottomPower, depth, faceOrigin } = head;
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= 120; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / 120;
    const upper = t > 0;
    const n = upper ? topPower : bottomPower;
    const x = halfWidth * Math.pow(Math.abs(Math.cos(t)), 2 / n);
    const y = waist + (upper ? top - waist : waist - bottom) * Math.sign(Math.sin(t)) * Math.pow(Math.abs(Math.sin(t)), 2 / n);
    points.push(new THREE.Vector2(i === 0 || i === 120 ? 0 : x, y - faceOrigin[1]));
  }
  // Seam at the back (phiStart = PI puts phi 0 at -z) so it never shows.
  const geometry = new THREE.LatheGeometry(points, 160, Math.PI, Math.PI * 2);
  geometry.scale(1, 1, depth);
  geometry.translate(centerX - faceOrigin[0], 0, 0);
  geometry.computeVertexNormals();
  return geometry;
}
