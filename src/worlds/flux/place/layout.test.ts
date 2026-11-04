import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { applyPlacement } from '../../../engine/world/placement';
import type { Placement, Vec3 } from '../../../engine/world/types';
import { asWorldLayout, layoutProblems, validateWorld } from '../../../engine/world/validateWorld';
import { PIPELINE_STAGE } from './config';
import { BRIDGE_PIECES, CORRIDOR_WIDTH, PIPELINE_CORRIDOR, PIPELINE_KIT, PORTAL_PIECES, ledMaterials } from './kit';
import layoutData from './layout.json';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const layout = asWorldLayout(layoutData);
const placements = Object.entries(layout.groups).flatMap(([group, list]) => list.map((p, index) => ({ group, index, p })));
const ofPiece = (test: (piece: string) => boolean) => placements.filter(({ p }) => test(p.piece)).map(({ p }) => p);

/** The kit file's node table (the JSON chunk of the glb): name to extras. */
const kitNodes = (() => {
  const data = readFileSync(join(ROOT, 'public', PIPELINE_KIT.url));
  expect(data.subarray(0, 4).toString()).toBe('glTF');
  const doc = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString('utf8')) as { nodes: { name?: string; extras?: { radius?: number; ring_centre?: number[] } }[] };
  return new Map(doc.nodes.map(node => [node.name ?? '', node.extras ?? {}] as const));
})();

/** How far a placement reaches on the ground plane: the piece's bounding radius about its origin (from the kit file) times its largest horizontal scale. */
const reach = (p: Placement) => {
  const radius = kitNodes.get(p.piece)?.radius;
  expect(radius, `${p.piece} carries a radius in the kit file`).toBeGreaterThan(0);
  const s = p.scale ?? 1;
  const horizontal = typeof s === 'number' ? s : Math.max(s[0], s[2]);
  return radius! * horizontal;
};

/** A point of a piece's own frame (glTF, stage units) where a placement puts it. */
const placed = (p: Placement, local: Vec3) => {
  const object = new THREE.Object3D();
  applyPlacement(object, p);
  object.updateMatrix();
  return new THREE.Vector3(...local).applyMatrix4(object.matrix);
};

/** A placement's transform as one comparable key. */
const transformKey = (p: Placement) => JSON.stringify([p.position, p.rotY ?? 0, p.tilt ?? 0, p.scale ?? 1]);

function distanceToSegment([px, pz]: readonly [number, number], [ax, az]: readonly [number, number], [bx, bz]: readonly [number, number]) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function distanceToPolyline(point: readonly [number, number], line: readonly (readonly [number, number])[]) {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) best = Math.min(best, distanceToSegment(point, line[i], line[i + 1]));
  return best;
}

test('the layout is a valid layout and names only pieces in the kit', () => {
  expect(layoutProblems(layoutData)).toEqual([]);
  const pieces: readonly string[] = PIPELINE_KIT.pieces;
  for (const { group, index, p } of placements) expect(pieces, `${group}[${index}] ${p.piece}`).toContain(p.piece);
  // No glyph-lit placements, no chains (the kit carries no chain piece, R15) and no lava lights.
  expect(placements.filter(({ p }) => p.light)).toEqual([]);
  expect(layout.chains).toEqual([]);
  expect(layout.coralLights).toEqual([]);
  expect(layout.floorY).toBe(-2.45);
});

test('the portal is assembled: every portal piece once, all with one transform, right of the stage and behind it (x > 1.2, z < -2)', () => {
  const portal = ofPiece(piece => piece.startsWith('portal_'));
  expect(portal.map(p => p.piece).sort()).toEqual([...PORTAL_PIECES].sort());
  expect(new Set(portal.map(transformKey)).size).toBe(1);
  const [x, , z] = portal[0].position;
  expect(x).toBeGreaterThan(1.2);
  expect(z).toBeLessThan(-2);
});

test('the bridge is whole segments: deck, pier and arch together at one transform each', () => {
  const bridge = ofPiece(piece => piece.startsWith('bridge_'));
  const segments = new Map<string, string[]>();
  for (const p of bridge) segments.set(transformKey(p), [...(segments.get(transformKey(p)) ?? []), p.piece]);
  expect(segments.size).toBeGreaterThanOrEqual(3);
  for (const [key, pieces] of segments) expect(pieces.sort(), key).toEqual([...BRIDGE_PIECES].sort());
});

test('towers frame both sides (one at x < -2.2, one at x > 2.2)', () => {
  const towers = ofPiece(piece => piece.startsWith('tower_'));
  expect(towers.some(p => p.position[0] < -2.2)).toBe(true);
  expect(towers.some(p => p.position[0] > 2.2)).toBe(true);
});

test('dark rocks stand in the foreground on both sides', () => {
  const rocks = layout.groups.rocks ?? [];
  expect(rocks.some(p => p.position[2] > 0 && p.position[0] < 0)).toBe(true);
  expect(rocks.some(p => p.position[2] > 0 && p.position[0] > 0)).toBe(true);
  // Coral clumps are in the `corals` group the engine sways, and nowhere else.
  expect(placements.filter(({ group, p }) => p.piece.startsWith('coral_') !== (group === 'corals'))).toEqual([]);
});

test('paths.bridge runs from the left distance along the decks and ends within 0.5 of the portal centre', () => {
  const path = layout.paths?.bridge;
  expect(path).toBeDefined();
  expect(path!.length).toBeGreaterThanOrEqual(3);
  expect(path![0][0]).toBeLessThan(-8);
  expect(path![0][2]).toBeLessThan(-2);
  const portal = ofPiece(piece => piece === 'portal_disc')[0];
  const ringCentre = kitNodes.get('portal_disc')?.ring_centre;
  expect(ringCentre, 'portal_disc carries ring_centre in the kit file').toHaveLength(3);
  const centre = placed(portal, ringCentre as unknown as Vec3);
  const end = new THREE.Vector3(...path![path!.length - 1]);
  expect(end.distanceTo(centre)).toBeLessThan(0.5);
  // Every point before the climb into the disc is over a deck, near its axis on the ground plane.
  const decks = ofPiece(piece => piece === 'bridge_deck').map(p => [placed(p, [-3, 0, 0]), placed(p, [3, 0, 0])] as const);
  for (const [i, point] of path!.slice(0, -1).entries()) {
    const near = Math.min(...decks.map(([a, b]) => distanceToSegment([point[0], point[2]], [a.x, a.z], [b.x, b.z])));
    expect(near, `bridge[${i}] is over a deck`).toBeLessThan(0.3);
  }
});

test('a clear corridor 2.4 wide runs from the far left to the stage spot', () => {
  expect(CORRIDOR_WIDTH).toBe(2.4);
  const line = PIPELINE_CORRIDOR;
  expect(line[0][0]).toBeLessThan(-8);
  expect(line[line.length - 1]).toEqual([0, 0]);
  for (const { group, index, p } of placements) {
    const gap = distanceToPolyline([p.position[0], p.position[2]], line) - reach(p) - CORRIDOR_WIDTH / 2;
    expect(gap, `${group}[${index}] ${p.piece} at (${p.position[0]}, ${p.position[2]}) is on the corridor`).toBeGreaterThanOrEqual(0);
  }
});

test('the engine accepts the kit and layout: a world with the LED materials and the ring arcs as props validates', () => {
  const world = {
    ...PIPELINE_STAGE,
    kit: { url: PIPELINE_KIT.url, pieces: PIPELINE_KIT.pieces, nodes: PIPELINE_KIT.nodes, attached: PIPELINE_KIT.attached },
    layout,
    materials: ledMaterials({ intensity: 1, rate: [0.4, 2.5], duty: 0.6 }),
    props: [1, 2, 3, 4].map(k => ({ id: `arc${k}`, node: `portal_arc_${k}`, drive: 'emissive' as const })),
  };
  expect(validateWorld(world)).toEqual([]);
  // Every LED node is drawn: its piece is laid out.
  const laidOut = new Set(placements.map(({ p }) => p.piece));
  for (const { piece } of PIPELINE_KIT.attached) expect(laidOut.has(piece), piece).toBe(true);
});
