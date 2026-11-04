import * as THREE from 'three';
import type { CheekShape, DomeShape, HeadShape } from '../config/types';

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

/** The middle of Nox's face (eyes to mouth), in the space the head is authored in. */
export function faceCentre(head: HeadShape) {
  return { x: head.faceOrigin[0], y: head.faceOrigin[1] - 0.25 };
}

/** Both cheek lobes' centres in world units, left then right. */
export function cheekCentres(head: HeadShape) {
  const { distance, angle, y } = head.cheeks;
  const a = THREE.MathUtils.degToRad(angle);
  const z = distance * Math.cos(a) * head.depth;
  return [-1, 1].map(side => ({ x: head.centerX + side * distance * Math.sin(a), y, z }));
}

/**
 * How much shorter the upper half of each lobe behind the side is than the cheek's (1.1: its top
 * sits about 0.01 lower). The camera looks down a little, so a full-height lobe behind would show
 * a few pixels above the cheek, in the notch, over the halo; this keeps it hidden from the front.
 */
const BACK_LOBE_SQUASH = 1.1;

/**
 * Mantle radius along a ray with the cheeks merged in: a smooth maximum keeps the join soft. With
 * `back`, each cheek lobe is mirrored behind the side as well (at 180 degrees less its angle), so the
 * mantle seen from behind fills the same round outline as from the front: the lobes behind sit
 * level with the cheeks and further from the camera, hidden behind them from the front.
 */
function withCheeks(head: HeadShape, r: number, y: number, theta: number, back = true) {
  const front = cheekReach(head.cheeks, y, theta);
  const cy = head.cheeks.y;
  const yBack = y > cy ? cy + (y - cy) * BACK_LOBE_SQUASH : y;
  const reach = back ? Math.max(front, cheekReach(head.cheeks, yBack, Math.PI - Math.abs(theta))) : front;
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
    widest = Math.max(widest, withCheeks(head, r, y, theta, false) * Math.sin(theta));
  }
  return widest;
}

/**
 * Mantle as a lathe of two superellipses fitted to the reference rim line, a dome
 * above the widest point and the neck below, with round cheeks merged into its
 * sides. Coordinates are local to `head.faceOrigin`, which is where the mesh is placed.
 */
/** Below this height (world units) the mantle keeps its shape as the dome opens: the face. */
const MORPH_KEEP = -0.55;
/** Height of the rounded rim the sunk mantle closes with, under the dome. */
const MORPH_RIM = 0.06;
/** How far up the mantle's round top sits half-way through the change (0 = the sunk top, 1 = the head's). */
const MORPH_MID_TOP = 0.42;

/**
 * The mantle, with `mantleTop` given, also carries the shapes it morphs through as the dome opens
 * (see headMorph): half-way, a lower round dome (aMorphMid, aMorphMidNormal), the head squashed
 * down so it never looks like a flat-topped bucket; then, under the glass, the overview shape
 * (aMorph, aMorphNormal), pressed down beneath `mantleTop`, its sides rising straight into the
 * dome and closing in a rounded rim, so the face rises into the dome with no gap or lid.
 * Below MORPH_KEEP nothing moves.
 *
 * `back` (the default) mirrors the cheek lobes behind the sides, so the back is as full as the
 * front (see withCheeks). The head's halo shell is built without them: it draws its far side, so
 * from the front it keeps the approved glow, and from behind it rings the cheeks.
 */
export function createHeadGeometry(head: HeadShape, mantleTop?: number, back = true) {
  const profile = mantleProfile(head);
  const buildMantle = (points: readonly (readonly [number, number])[]) => buildLathe(head, points, back);
  const geometry = buildMantle(profile);
  if (mantleTop !== undefined) {
    const sunk = profile.map(([r, y]) => {
      if (y <= MORPH_KEEP) return [r, y] as const;
      const t = (y - MORPH_KEEP) / (head.top - MORPH_KEEP);
      const y2 = MORPH_KEEP + t * (mantleTop - MORPH_KEEP);
      if (r === 0) return [0, y2] as const;
      const side = mantleRadius(head, Math.min(y2, head.waist));
      const over = Math.max(0, (y2 - (mantleTop - MORPH_RIM)) / MORPH_RIM);
      return [side * Math.sqrt(Math.max(0, 1 - over * over)), y2] as const;
    });
    const morphed = buildMantle(sunk);
    geometry.setAttribute('aMorph', morphed.attributes.position);
    geometry.setAttribute('aMorphNormal', morphed.attributes.normal);
    const midTop = mantleTop + MORPH_MID_TOP * (head.top - mantleTop);
    const squashed = profile.map(([r, y]) => (y <= MORPH_KEEP ? ([r, y] as const) : ([r, MORPH_KEEP + ((y - MORPH_KEEP) * (midTop - MORPH_KEEP)) / (head.top - MORPH_KEEP)] as const)));
    const mid = buildMantle(squashed);
    geometry.setAttribute('aMorphMid', mid.attributes.position);
    geometry.setAttribute('aMorphMidNormal', mid.attributes.normal);
  }
  return geometry;
}

/** The overview dome, built round its own centre: a capsule with rounded-square corners. */
export function createDomeGeometry(dome: DomeShape) {
  const geometry = new THREE.SphereGeometry(1, 96, 64);
  const position = geometry.attributes.position;
  const bend = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 2 / dome.power);
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(i, bend(position.getX(i)) * dome.halfWidth, bend(position.getY(i)) * dome.halfHeight, position.getZ(i) * dome.depth);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** The mantle's lathe profile as (radius, world height) pairs, bottom pole to top pole. */
function mantleProfile(head: HeadShape) {
  const { halfWidth, waist, top, bottom, topPower, bottomPower } = head;
  const points: (readonly [number, number])[] = [];
  for (let i = 0; i <= 160; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / 160;
    const upper = t > 0;
    const n = upper ? topPower : bottomPower;
    const x = halfWidth * Math.pow(Math.abs(Math.cos(t)), 2 / n);
    const y = waist + (upper ? top - waist : waist - bottom) * Math.sign(Math.sin(t)) * Math.pow(Math.abs(Math.sin(t)), 2 / n);
    points.push([i === 0 || i === 160 ? 0 : x, y]);
  }
  return points;
}

const SEGMENTS = 160;

function buildLathe(head: HeadShape, profile: readonly (readonly [number, number])[], back: boolean) {
  const { centerX, depth, faceOrigin } = head;
  const points = profile.map(([r, y]) => new THREE.Vector2(r, y - faceOrigin[1]));
  // Seam at the back (phiStart = PI puts phi 0 at -z), out of sight from the front.
  const geometry = new THREE.LatheGeometry(points, SEGMENTS, Math.PI, Math.PI * 2);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-6) continue;
    const grow = withCheeks(head, r, y + faceOrigin[1], Math.atan2(x, z), back) / r;
    position.setXYZ(i, x * grow, y, z * grow);
  }
  geometry.scale(1, 1, depth);
  geometry.translate(centerX - faceOrigin[0], 0, 0);
  geometry.computeVertexNormals();
  // The seam's two columns share positions but not faces: give both the same normal, so the
  // back shades smoothly across it.
  const normal = geometry.attributes.normal;
  const last = SEGMENTS * points.length;
  const n = new THREE.Vector3();
  for (let j = 0; j < points.length; j++) {
    n.fromBufferAttribute(normal, j).add(new THREE.Vector3().fromBufferAttribute(normal, last + j));
    if (n.lengthSq() < 1e-12) continue;
    n.normalize();
    normal.setXYZ(j, n.x, n.y, n.z);
    normal.setXYZ(last + j, n.x, n.y, n.z);
  }
  return geometry;
}
