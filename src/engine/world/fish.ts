import * as THREE from 'three';
import type { Point2 } from '../config/types';

// The far fish's shape (Water.tsx draws the school): Nox's and Veyra's body and tail, or a world's
// own silhouette (`live.fishSilhouette`), a flat card cut to an outline. Pure, so the tests read it.

/** The most points a silhouette may have. */
export const MAX_SILHOUETTE_POINTS = 24;

/**
 * The fish geometry, nose toward +x, in the frame of a body of radius 1 (the school scales each
 * fish). With no `silhouette` it is the body and tail every world had before silhouettes, exactly;
 * with one, a flat card of that outline in the xy plane, seen from both sides.
 */
export function fishGeometry(silhouette: readonly Point2[] | undefined) {
  return silhouette ? silhouetteCard(silhouette) : bodyAndTail();
}

/** The fish every world had before silhouettes: an ellipsoid body and a forked tail fin. */
function bodyAndTail() {
  const body = new THREE.SphereGeometry(1, 14, 8);
  body.scale(1, 0.34, 0.16);
  const tail = new THREE.BufferGeometry();
  tail.setAttribute('position', new THREE.Float32BufferAttribute([-0.85, 0, 0, -1.45, 0.38, 0, -1.45, -0.38, 0, -0.85, 0, 0, -1.45, -0.38, 0, -1.45, 0.38, 0], 3));
  tail.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1], 3));
  tail.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(12).fill(0), 2));
  return mergeTwo(body, tail);
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const ai = a.index ? a.toNonIndexed() : a;
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const x = ai.attributes[name] as THREE.BufferAttribute;
    const y = b.attributes[name] as THREE.BufferAttribute;
    const data = new Float32Array(x.array.length + y.array.length);
    data.set(x.array as Float32Array, 0);
    data.set(y.array as Float32Array, x.array.length);
    out.setAttribute(name, new THREE.BufferAttribute(data, x.itemSize));
  }
  return out;
}

/** A flat card cut to `outline` (a simple polygon, either winding): its triangles facing +z, then again facing -z. */
function silhouetteCard(outline: readonly Point2[]) {
  const contour = outline.map(([x, y]) => new THREE.Vector2(x, y));
  const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
  const positions: number[] = [];
  const normals: number[] = [];
  for (const side of [1, -1]) {
    for (const triangle of triangles) {
      const [a, b, c] = triangle.map(i => contour[i]);
      // Wind each triangle to face the side it is for.
      const ccw = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y) > 0;
      const ordered = ccw === (side > 0) ? [a, b, c] : [a, c, b];
      for (const p of ordered) {
        positions.push(p.x, p.y, 0);
        normals.push(0, 0, side);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((positions.length / 3) * 2).fill(0), 2));
  return geometry;
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Twice the signed area of the triangle (a, b, c): positive when it turns left. */
const turn = (a: Point2, b: Point2, c: Point2) => (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
/** Whether c lies on the segment a-b, given that the three are in line. */
const within = (a: Point2, b: Point2, c: Point2) => Math.min(a[0], b[0]) <= c[0] && c[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= c[1] && c[1] <= Math.max(a[1], b[1]);

/** Whether the segments p-q and r-s meet at all (crossing, touching or overlapping). */
function segmentsMeet(p: Point2, q: Point2, r: Point2, s: Point2) {
  const [d1, d2, d3, d4] = [turn(r, s, p), turn(r, s, q), turn(p, q, r), turn(p, q, s)];
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return (d1 === 0 && within(r, s, p)) || (d2 === 0 && within(r, s, q)) || (d3 === 0 && within(p, q, r)) || (d4 === 0 && within(p, q, s));
}

/**
 * What is wrong with a fish silhouette, in words naming `at`: it must be 3 to 24 points, each an
 * (x, y) in the unit box (-1 to 1 on both axes, the body's frame), and a simple polygon: no edge of
 * no length, and no two edges meeting except neighbours at their shared point.
 */
export function silhouetteProblems(outline: unknown, at: string): string[] {
  if (!Array.isArray(outline)) return [`${at} is not a list of (x, y) points`];
  if (outline.length < 3) return [`${at} needs at least 3 points (it has ${outline.length})`];
  if (outline.length > MAX_SILHOUETTE_POINTS) return [`${at} has ${outline.length} points; it may have at most ${MAX_SILHOUETTE_POINTS}`];
  const bad = outline.findIndex(p => !Array.isArray(p) || p.length !== 2 || !p.every(finite));
  if (bad >= 0) return [`${at}[${bad}] is not an (x, y) point`];
  const points = outline as Point2[];
  const outside = points.findIndex(([x, y]) => Math.abs(x) > 1 || Math.abs(y) > 1);
  if (outside >= 0) return [`${at}[${outside}] is outside the unit box (-1 to 1 on each axis)`];
  const n = points.length;
  const edge = (i: number) => [points[i], points[(i + 1) % n]] as const;
  for (let i = 0; i < n; i++) {
    const [a, b] = edge(i);
    if (a[0] === b[0] && a[1] === b[1]) return [`${at} repeats point ${i} (edge ${i} has no length)`];
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const neighbours = j === i + 1 || (i === 0 && j === n - 1);
      const [p, q] = edge(i);
      const [r, s] = edge(j);
      if (!neighbours && segmentsMeet(p, q, r, s)) return [`${at} crosses itself (edges ${i} and ${j} meet): it must be a simple outline`];
      // Neighbours share one point; folding back along each other is a crossing too.
      if (neighbours && turn(p, q, j === i + 1 ? s : r) === 0) {
        const [shared, x, y] = j === i + 1 ? [q, p, s] : [p, q, r];
        if ((x[0] - shared[0]) * (y[0] - shared[0]) + (x[1] - shared[1]) * (y[1] - shared[1]) > 0) return [`${at} crosses itself (edges ${i} and ${j} fold back)`];
      }
    }
  }
  const area = points.reduce((sum, [x, y], i) => sum + x * points[(i + 1) % n][1] - points[(i + 1) % n][0] * y, 0);
  if (area === 0) return [`${at} encloses no area`];
  return [];
}
