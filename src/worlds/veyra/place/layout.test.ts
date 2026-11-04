import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { asWorldLayout, layoutProblems, validateWorld } from '../../../engine/world/validateWorld';
import type { Placement } from '../../../engine/world/types';
import { VAULT_WORLD } from './config';
import layoutData from './layout.json';
import { CORRIDOR_WIDTH, VAULT_CORRIDOR, VAULT_KIT } from './kit';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const layout = asWorldLayout(layoutData);
const placements = Object.entries(layout.groups).flatMap(([group, list]) => list.map((p, index) => ({ group, index, p })));

/** The kit file's node table (the JSON chunk of the glb): name to extras. */
const kitNodes = (() => {
  const data = readFileSync(join(ROOT, 'public', VAULT_KIT.url));
  expect(data.subarray(0, 4).toString()).toBe('glTF');
  const doc = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString('utf8')) as { nodes: { name?: string; extras?: { radius?: number } }[] };
  return new Map(doc.nodes.map(node => [node.name ?? '', node.extras ?? {}] as const));
})();

/** How far a placement reaches on the ground plane: the piece's own bounding radius (about its origin, from the kit file) times its largest horizontal scale. */
const reach = (p: Placement) => {
  const radius = kitNodes.get(p.piece)?.radius;
  expect(radius, `${p.piece} carries a radius in the kit file`).toBeGreaterThan(0);
  const s = p.scale ?? 1;
  const horizontal = typeof s === 'number' ? s : Math.max(s[0], s[2]);
  return radius! * horizontal;
};

/** Distance from a point to a segment, on the ground plane. */
function distanceToSegment([px, pz]: readonly [number, number], [ax, az]: readonly [number, number], [bx, bz]: readonly [number, number]) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

/** Distance from a point to a polyline: the nearest of its segments. */
function distanceToPolyline(point: readonly [number, number], line: readonly (readonly [number, number])[]) {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) best = Math.min(best, distanceToSegment(point, line[i], line[i + 1]));
  return best;
}

test('the layout is a valid layout and names only pieces in the kit\'s piece list', () => {
  expect(layoutProblems(layoutData)).toEqual([]);
  const pieces: readonly string[] = VAULT_KIT.pieces;
  for (const { group, index, p } of placements) expect(pieces, `${group}[${index}] ${p.piece}`).toContain(p.piece);
  // No lit placements (only pillars carry glyph lights), no chains (the kit has no chain piece), no lava lights.
  expect(placements.filter(({ p }) => p.light)).toEqual([]);
  expect(layout.chains).toEqual([]);
  expect(layout.coralLights).toEqual([]);
});

test('the kit file holds every piece and its lod1, and the portal\'s nodes', () => {
  for (const piece of VAULT_KIT.pieces) {
    expect(kitNodes.has(piece), piece).toBe(true);
    expect(kitNodes.has(`${piece}_lod1`), `${piece}_lod1`).toBe(true);
    expect(kitNodes.get(piece)!.radius, `${piece} radius`).toBeGreaterThan(0);
  }
  for (const node of VAULT_KIT.nodes) expect(kitNodes.has(node), node).toBe(true);
});

test('the portal stands to the right of the stage and behind it (x > 1.2, z < -2)', () => {
  const portals = placements.filter(({ p }) => p.piece === 'arch');
  expect(portals).toHaveLength(1);
  const [x, , z] = portals[0].p.position;
  expect(x).toBeGreaterThan(1.2);
  expect(z).toBeLessThan(-2);
});

test('a clear corridor 2.4 wide runs from the far left to the stage spot (and on to the portal)', () => {
  expect(CORRIDOR_WIDTH).toBe(2.4);
  const [start] = VAULT_CORRIDOR.path;
  const end = VAULT_CORRIDOR.path[VAULT_CORRIDOR.path.length - 1];
  expect(start[0]).toBeLessThan(-6); // the far left
  expect(end).toEqual([0, 0]); // the stage spot
  for (const [name, line] of Object.entries(VAULT_CORRIDOR)) {
    for (const { group, index, p } of placements) {
      const gap = distanceToPolyline([p.position[0], p.position[2]], line) - reach(p) - CORRIDOR_WIDTH / 2;
      expect(gap, `${group}[${index}] ${p.piece} at (${p.position[0]}, ${p.position[2]}) is on the ${name}`).toBeGreaterThanOrEqual(0);
    }
  }
});

test('the corridor is smooth enough to swim: no segment turns more than 60 degrees', () => {
  for (const line of Object.values(VAULT_CORRIDOR)) {
    for (let i = 1; i + 1 < line.length; i++) {
      const a = [line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]];
      const b = [line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]];
      const angle = Math.acos((a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b)));
      expect(angle).toBeLessThan(Math.PI / 3);
    }
  }
});

test('the scene reads as the painting: walls and blocks on both sides, dark rocks in front, two orange corals low right, glowing plants', () => {
  const count = (group: string) => (layout.groups[group] ?? []).length;
  const stone = placements.filter(({ p }) => /^(block_|wall_|steps)/.test(p.piece));
  expect(stone.filter(({ p }) => p.position[0] < -2).length).toBeGreaterThanOrEqual(3);
  expect(stone.filter(({ p }) => p.position[0] > 2).length).toBeGreaterThanOrEqual(3);
  expect(stone.some(({ p }) => p.piece === 'wall_broken' && p.position[0] < 0)).toBe(true);
  expect(stone.some(({ p }) => p.piece === 'wall_broken' && p.position[0] > 0)).toBe(true);
  expect(stone.some(({ p }) => p.piece === 'steps')).toBe(true);
  // Foreground rocks: in front of the stage plane (z > 0), on both sides, and dark rocks nowhere else needed.
  const rocks = layout.groups.rocks ?? [];
  expect(rocks.filter(p => p.position[2] > 0 && p.position[0] < 0).length).toBeGreaterThanOrEqual(2);
  expect(rocks.filter(p => p.position[2] > 0 && p.position[0] > 0).length).toBeGreaterThanOrEqual(2);
  // Two orange corals, low right (x > 0, in front of or near the stage plane), in the `corals` group the engine sways.
  const corals = layout.groups.corals ?? [];
  expect(count('corals')).toBe(2);
  expect(corals.every(p => p.piece === 'coral_orange' && p.position[0] > 0 && p.position[2] > -1)).toBe(true);
  expect(placements.filter(({ p }) => p.piece === 'coral_orange')).toHaveLength(2);
  expect(placements.filter(({ p }) => p.piece.startsWith('glowplant')).length).toBeGreaterThanOrEqual(6);
});

test('the layout stands on the floor the stage backdrop uses (floorY -2.45)', () => {
  expect(layout.floorY).toBe(-2.45);
});

test('the engine accepts this kit and layout: the vault world, with props naming the portal nodes, validates', () => {
  expect(VAULT_WORLD.kit).toMatchObject({ url: VAULT_KIT.url, pieces: VAULT_KIT.pieces, nodes: VAULT_KIT.nodes });
  expect(VAULT_WORLD.layout).toEqual(layout);
  const world = {
    ...VAULT_WORLD,
    props: [
      { id: 'lockRing', node: 'padlock_ring', drive: 'rotateZ' as const },
      { id: 'membraneFlash', node: 'membrane', drive: 'emissive' as const },
    ],
  };
  expect(validateWorld(world)).toEqual([]);
  // A group name the engine dresses must hold what it dresses: only the `corals` group sways, and a placement beside them in another group would be stone.
  expect(Object.keys(layout.groups).sort()).toEqual(['corals', 'plants', 'portal', 'rocks', 'stone']);
  expect(placements.filter(({ group, p }) => group !== 'corals' && p.piece === 'coral_orange')).toEqual([]);
});
