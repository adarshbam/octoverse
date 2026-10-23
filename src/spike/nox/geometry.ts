import * as THREE from 'three';
import { HEAD_CENTER, HEAD_DEPTH, HEAD_SHAPE } from './armPoses';

/**
 * Mantle silhouette as two superellipses fitted to panel 2: a round dome above
 * the widest point and fuller cheeks below it. Head-local units (origin = HEAD_CENTER).
 */
export function createHeadGeometry() {
  const { centerX, halfWidth, waist, top, bottom, topPower, bottomPower } = HEAD_SHAPE;
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= 120; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / 120;
    const upper = t > 0;
    const n = upper ? topPower : bottomPower;
    const x = halfWidth * Math.pow(Math.abs(Math.cos(t)), 2 / n);
    const y = waist + (upper ? top - waist : waist - bottom) * Math.sign(Math.sin(t)) * Math.pow(Math.abs(Math.sin(t)), 2 / n);
    points.push(new THREE.Vector2(i === 0 || i === 120 ? 0 : x, y - HEAD_CENTER.y));
  }
  // Seam at the back (phiStart = PI puts phi 0 at -z) so it never shows.
  const geometry = new THREE.LatheGeometry(points, 160, Math.PI, Math.PI * 2);
  geometry.scale(1, 1, HEAD_DEPTH);
  geometry.translate(centerX - HEAD_CENTER.x, 0, 0);
  geometry.computeVertexNormals();
  return geometry;
}

/** A sucker: raised glowing rim around a recessed centre, facing +z. */
export function createSuckerGeometry() {
  const profile: [number, number][] = [
    [0, 0.14], [0.28, 0.12], [0.48, 0.22], [0.66, 0.46], [0.82, 0.56], [0.95, 0.45], [1.0, 0.25], [0.97, 0.0], [0.82, -0.3],
  ];
  const geometry = new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), 20);
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}
