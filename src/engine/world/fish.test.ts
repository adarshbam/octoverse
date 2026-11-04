import { expect, test } from 'vitest';
import type { Point2 } from '../config/types';
import { SECURITY_WORLD } from '../../worlds/nox/place/config';
import { MAX_SILHOUETTE_POINTS, fishGeometry, silhouetteProblems } from './fish';
import golden from './fixtures/fish.geometry.golden.json';
import type { WorldConfig } from './types';
import { validateWorld } from './validateWorld';

/** A manta seen from above: broad wings, a narrow tail (nose toward +x). */
const MANTA: Point2[] = [[1, 0], [0.55, 0.25], [0.1, 0.95], [-0.25, 0.85], [-0.35, 0.15], [-1, 0.03], [-1, -0.03], [-0.35, -0.15], [-0.25, -0.85], [0.1, -0.95], [0.55, -0.25]];
const withSilhouette = (fishSilhouette: readonly Point2[] | undefined): WorldConfig => ({ ...SECURITY_WORLD, live: { ...SECURITY_WORLD.live, fishSilhouette } });
const problems = (fishSilhouette: readonly Point2[]) => validateWorld(withSilhouette(fishSilhouette)).join('\n');
/** A regular polygon of `n` points, inside the unit box. */
const ring = (n: number): Point2[] => Array.from({ length: n }, (_, i) => [0.9 * Math.cos((i / n) * 2 * Math.PI), 0.9 * Math.sin((i / n) * 2 * Math.PI)] as const);

test('without a silhouette the fish is the pre-change fish, vertex for vertex (Nox and Veyra unchanged)', () => {
  const geometry = fishGeometry(undefined);
  expect(Object.keys(geometry.attributes).sort()).toEqual(['normal', 'position', 'uv']);
  expect(geometry.index).toBeNull();
  for (const name of ['position', 'normal', 'uv'] as const) {
    const attribute = geometry.attributes[name];
    expect(attribute.itemSize, name).toBe(golden[name].itemSize);
    // Float32 for float32 (the fixture keeps nine digits, which round-trip), with -0 read as 0 (JSON has no -0).
    expect(Array.from(attribute.array, v => v + 0), name).toEqual(Array.from(Float32Array.from(golden[name].array)));
  }
  // Nox's and Veyra's worlds name no silhouette.
  expect(SECURITY_WORLD.live.fishSilhouette).toBeUndefined();
});

test('a silhouette of 25 points fails validation, and one of 24 passes', () => {
  expect(MAX_SILHOUETTE_POINTS).toBe(24);
  expect(problems(ring(25))).toContain('live.fishSilhouette');
  expect(problems(ring(25))).toContain('at most 24');
  expect(problems(ring(24))).toBe('');
  expect(problems(MANTA)).toBe('');
});

test('a self-crossing silhouette fails validation, as do too few points, a point outside the unit box and a repeated point', () => {
  const bowTie: Point2[] = [[-0.8, -0.5], [0.8, 0.5], [0.8, -0.5], [-0.8, 0.5]];
  expect(problems(bowTie)).toContain('live.fishSilhouette crosses itself');
  // An edge that only touches another (a vertex on a far edge) is a crossing too.
  expect(problems([[-0.8, 0], [0.8, 0], [0.8, 0.6], [0, 0], [-0.8, 0.6]])).toContain('live.fishSilhouette crosses itself');
  expect(problems([[0, 0], [0.5, 0.5]])).toContain('at least 3');
  expect(problems([[0, 0], [1.5, 0], [0, 0.5]])).toContain('unit box');
  expect(problems([[0, 0], [0.5, 0], [0.5, 0], [0, 0.5]])).toContain('live.fishSilhouette');
  expect(problems([[0, 0], [0.5, 0], [1, 0]])).toContain('live.fishSilhouette');
  expect(silhouetteProblems(MANTA, 'x')).toEqual([]);
});

test('a silhouette is a flat card of its outline, seen from both sides, in the place of the body and tail', () => {
  const geometry = fishGeometry(MANTA);
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  expect(geometry.attributes.uv.count).toBe(position.count);
  // Triangles cover the outline once a side: their area is the polygon's, twice over.
  const polygonArea = Math.abs(MANTA.reduce((sum, [x, y], i) => { const [nx, ny] = MANTA[(i + 1) % MANTA.length]; return sum + x * ny - nx * y; }, 0) / 2);
  let front = 0;
  let back = 0;
  for (let i = 0; i < position.count; i += 3) {
    const [ax, ay, bx, by, cx, cy] = [position.getX(i), position.getY(i), position.getX(i + 1), position.getY(i + 1), position.getX(i + 2), position.getY(i + 2)];
    const signed = ((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
    // Each triangle winds to face the way its normal points.
    expect(Math.sign(signed)).toBe(Math.sign(normal.getZ(i)));
    if (signed > 0) front += signed;
    else back -= signed;
    for (const k of [i, i + 1, i + 2]) expect(position.getZ(k)).toBe(0);
  }
  expect(front).toBeCloseTo(polygonArea, 5);
  expect(back).toBeCloseTo(polygonArea, 5);
});
