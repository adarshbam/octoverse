import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { CAMERA_Z } from '../../../engine/config/stage';
import type { Placement } from '../../../engine/world/types';
import { asWorldLayout, layoutProblems, validateWorld } from '../../../engine/world/validateWorld';
import { AETHER_STAGE_FRAMES } from '../bundle';
import { OBSERVATORY_STAGE } from './config';
import { OBSERVATORY_KIT, OBSERVATORY_PATH, OBSERVATORY_PROPS, PATH_WIDTH, PORTAL_NODES, RUBBLE_BOB_AMPLITUDE, RUBBLE_PIECES } from './kit';
import layoutData from './layout.json';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const layout = asWorldLayout(layoutData);
const placements = Object.entries(layout.groups).flatMap(([group, list]) => list.map((p, index) => ({ group, index, p })));

type Box = { min: number[]; max: number[] };
interface GlbNode {
  name?: string;
  mesh?: number;
  extras?: { radius?: number };
}

/** The kit file's JSON chunk: its nodes (name to node) and the bounds of each mesh node's positions, in the node's own frame (glTF Y-up). */
const kit = (() => {
  const data = readFileSync(join(ROOT, 'public', OBSERVATORY_KIT.url));
  expect(data.subarray(0, 4).toString()).toBe('glTF');
  const doc = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString('utf8')) as {
    nodes: GlbNode[];
    meshes: { primitives: { attributes: { POSITION: number } }[] }[];
    accessors: { min: number[]; max: number[] }[];
  };
  const nodes = new Map(doc.nodes.map(node => [node.name ?? '', node] as const));
  const bounds = (name: string): Box => {
    const node = nodes.get(name);
    expect(node?.mesh, `${name} is a mesh node`).toBeDefined();
    const boxes = doc.meshes[node!.mesh!].primitives.map(prim => doc.accessors[prim.attributes.POSITION]);
    return { min: [0, 1, 2].map(k => Math.min(...boxes.map(a => a.min[k]))), max: [0, 1, 2].map(k => Math.max(...boxes.map(a => a.max[k]))) };
  };
  return { nodes, bounds };
})();

/** How far a placement reaches on the ground plane: the piece's own bounding radius (about its origin, from the kit file) times its largest horizontal scale. */
const reach = (p: Placement) => {
  const radius = kit.nodes.get(p.piece)?.extras?.radius;
  expect(radius, `${p.piece} carries a radius in the kit file`).toBeGreaterThan(0);
  const s = p.scale ?? 1;
  return radius! * (typeof s === 'number' ? s : Math.max(s[0], s[2]));
};

/** Distance from a point to a segment, on the ground plane. */
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

/** The union of the portal nodes' bounds (they share one frame: the arch's). */
function portalBounds(): Box {
  const boxes = PORTAL_NODES.map(name => kit.bounds(name));
  return { min: [0, 1, 2].map(k => Math.min(...boxes.map(b => b.min[k]))), max: [0, 1, 2].map(k => Math.max(...boxes.map(b => b.max[k]))) };
}

/**
 * Sample points inside a box of the kit file (glTF: x right, y up, z toward the camera) placed as
 * the page places it: scale, then turn about y, then move. Boxes are sampled on a grid, corners and
 * faces included.
 */
function placedPoints({ min, max }: Box, p: Placement, steps = 8) {
  expect(p.tilt ?? 0).toBe(0);
  const s = p.scale ?? 1;
  const [sx, sy, sz] = typeof s === 'number' ? [s, s, s] : s;
  const cos = Math.cos(p.rotY ?? 0);
  const sin = Math.sin(p.rotY ?? 0);
  const points: [number, number, number][] = [];
  for (let i = 0; i <= steps; i++)
    for (let j = 0; j <= steps; j++)
      for (let k = 0; k <= steps; k++) {
        const x = (min[0] + ((max[0] - min[0]) * i) / steps) * sx;
        const y = (min[1] + ((max[1] - min[1]) * j) / steps) * sy;
        const z = (min[2] + ((max[2] - min[2]) * k) / steps) * sz;
        points.push([p.position[0] + x * cos + z * sin, p.position[1] + y, p.position[2] - x * sin + z * cos]);
      }
  return points;
}

/**
 * Is a world point inside what the intro camera shows? The camera sits at z = CAMERA_Z looking down
 * -z; the stage frame is the rectangle the intro must show on the z = 0 plane, and a wider viewport
 * shows more across (the field of view fits the frame's height, `fovFor`). The view widens with
 * depth in proportion to the distance from the camera.
 */
function inView([x, y, z]: readonly [number, number, number], aspect: number) {
  const { width, height } = AETHER_STAGE_FRAMES.intro;
  const halfHeight = Math.max(height, width / aspect) / 2;
  const depth = CAMERA_Z - z;
  if (depth <= 0) return false;
  const grow = depth / CAMERA_Z;
  return Math.abs(x) <= halfHeight * aspect * grow && Math.abs(y) <= halfHeight * grow;
}

test('the layout is a valid layout and names only pieces in the kit\'s piece list', () => {
  expect(layoutProblems(layoutData)).toEqual([]);
  const pieces: readonly string[] = OBSERVATORY_KIT.pieces;
  for (const { group, index, p } of placements) expect(pieces, `${group}[${index}] ${p.piece}`).toContain(p.piece);
  // No lit placements (only pillars carry glyph lights), no chains (the kit has no chain piece), no lava lights.
  expect(placements.filter(({ p }) => p.light)).toEqual([]);
  expect(layout.chains).toEqual([]);
  expect(layout.coralLights).toEqual([]);
});

test('the kit file holds every piece and node the kit list names, each placed piece with its radius', () => {
  for (const piece of OBSERVATORY_KIT.pieces) {
    expect(kit.nodes.has(piece), piece).toBe(true);
    expect(kit.nodes.get(piece)!.extras?.radius, `${piece} radius`).toBeGreaterThan(0);
  }
  for (const node of OBSERVATORY_KIT.nodes) expect(kit.nodes.has(node), node).toBe(true);
});

test('the groups read as the observatory: a portal, towers both sides, walls, floating rubble in the mid water, rocks and coral in front', () => {
  expect(Object.keys(layout.groups).sort()).toEqual(['corals', 'portal', 'rocks', 'rubble', 'towers', 'walls']);
  expect(layout.groups.portal).toHaveLength(1);
  const towers = layout.groups.towers;
  expect(towers.filter(p => p.position[0] < 0).length).toBeGreaterThanOrEqual(2);
  expect(towers.filter(p => p.position[0] > 0).length).toBeGreaterThanOrEqual(2);
  expect(towers.every(p => /^tower_[a-d]$/.test(p.piece))).toBe(true);
  expect(layout.groups.walls.every(p => /^wall_[a-c]$/.test(p.piece))).toBe(true);
  // Rubble hangs in the water: above the floor, in the middle distance, and only the rubble pieces are in the group.
  const rubble = layout.groups.rubble;
  expect(rubble.map(p => p.piece).sort()).toEqual([...RUBBLE_PIECES].sort());
  for (const p of rubble) {
    expect(p.position[1], p.piece).toBeGreaterThan(layout.floorY + 0.5);
    expect(p.position[2], p.piece).toBeLessThan(-5);
  }
  // Foreground: rocks and coral in front of the stage plane on both sides, magenta fans and amber corals.
  const front = (list: Placement[], side: number) => list.filter(p => p.position[2] > 0 && Math.sign(p.position[0]) === side).length;
  expect(front(layout.groups.rocks, -1)).toBeGreaterThanOrEqual(2);
  expect(front(layout.groups.rocks, 1)).toBeGreaterThanOrEqual(2);
  expect(front(layout.groups.corals, -1)).toBeGreaterThanOrEqual(2);
  expect(front(layout.groups.corals, 1)).toBeGreaterThanOrEqual(2);
  expect(layout.groups.corals.filter(p => p.piece.startsWith('coral_fan_')).length).toBeGreaterThanOrEqual(2);
  expect(layout.groups.corals.filter(p => p.piece.startsWith('coral_amber_')).length).toBeGreaterThanOrEqual(2);
  expect(layout.groups.corals.every(p => /^coral_(fan|amber)_[a-c]$/.test(p.piece))).toBe(true);
});

test('the portal stands to the right and back (x > 6, z < -6), on the path', () => {
  const [{ position: [x, , z] }] = layout.groups.portal;
  expect(x).toBeGreaterThan(6);
  expect(z).toBeLessThan(-6);
  // The path ends at the foot of the portal's steps: within a step's depth of the steps' front edge.
  const [{ position, rotY = 0, scale }] = layout.groups.portal;
  const s = scale as number;
  const steps = kit.bounds('portal_steps');
  const front = [position[0] + steps.max[2] * s * Math.sin(rotY), position[2] + steps.max[2] * s * Math.cos(rotY)] as const;
  const end = OBSERVATORY_PATH[OBSERVATORY_PATH.length - 1];
  expect(Math.hypot(end[0] - front[0], end[1] - front[1])).toBeLessThan(0.6);
});

test('the intro frame holds no portal node: the whole portal stays out of the frame, and out of a 3:2 and a 16:9 window too', () => {
  const bounds = portalBounds();
  const [portal] = layout.groups.portal;
  const points = placedPoints(bounds, portal);
  for (const aspect of [AETHER_STAGE_FRAMES.intro.width / AETHER_STAGE_FRAMES.intro.height, 1.5, 16 / 9]) {
    const inside = points.filter(point => inView(point, aspect));
    expect(inside.length, `portal points in view at aspect ${aspect.toFixed(2)}`).toBe(0);
  }
  // Each node on its own too (the nodes share the frame, so this follows from the union, but names the offender).
  for (const name of PORTAL_NODES) expect(placedPoints(kit.bounds(name), portal).filter(point => inView(point, 1.5)), name).toEqual([]);
});

test('the towers lie outside the arm-span box (3.84 across, plus a 0.3 margin on each side)', () => {
  const armHalf = 3.84 / 2 + 0.3;
  expect(layout.groups.towers.length).toBeGreaterThanOrEqual(4);
  for (const p of layout.groups.towers) {
    const gap = Math.abs(p.position[0]) - reach(p) - armHalf;
    expect(gap, `${p.piece} at (${p.position[0]}, ${p.position[2]}) reaches into the arm-span box`).toBeGreaterThanOrEqual(0);
  }
  // They frame the intro: a tower on each side whose foot, seen from the camera, lies inside the intro frame.
  const seen = (side: number) =>
    layout.groups.towers.some(p => {
      const projected = (p.position[0] * CAMERA_Z) / (CAMERA_Z - p.position[2]);
      return Math.sign(projected) === side && Math.abs(projected) <= AETHER_STAGE_FRAMES.intro.width / 2;
    });
  expect(seen(-1)).toBe(true);
  expect(seen(1)).toBe(true);
});

test('a clear path 2.4 wide runs from the left distance toward the portal: no piece stands on it, and it turns gently', () => {
  expect(PATH_WIDTH).toBe(2.4);
  const [start] = OBSERVATORY_PATH;
  expect(start[0]).toBeLessThan(-8); // the left distance
  const line = OBSERVATORY_PATH.map(([x, z]) => [x, z] as const);
  for (const { group, index, p } of placements) {
    if (group === 'portal' || group === 'rubble') continue; // the portal ends the path; rubble hangs above it
    const gap = distanceToPolyline([p.position[0], p.position[2]], line) - reach(p) - PATH_WIDTH / 2;
    expect(gap, `${group}[${index}] ${p.piece} at (${p.position[0]}, ${p.position[2]}) is on the path`).toBeGreaterThanOrEqual(0);
  }
  for (let i = 1; i + 1 < line.length; i++) {
    const a = [line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]];
    const b = [line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]];
    expect(Math.acos((a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b)))).toBeLessThan(Math.PI / 3);
  }
});

test('the layout stands on the floor the stage backdrop uses (floorY -2.45)', () => {
  expect(layout.floorY).toBe(-2.45);
});

test('the engine accepts this kit and layout: the stage world with them in, the portal glyph on the emissive drive and the rubble on bob, validates', () => {
  const world = {
    ...OBSERVATORY_STAGE,
    kit: { url: OBSERVATORY_KIT.url, pieces: OBSERVATORY_KIT.pieces, nodes: OBSERVATORY_KIT.nodes },
    layout,
    props: OBSERVATORY_PROPS,
  };
  expect(validateWorld(world)).toEqual([]);
  // Every prop names a node of the kit file itself, not only of the kit list.
  for (const prop of world.props) expect(kit.nodes.has(prop.node), prop.node).toBe(true);
  // Only the `corals` group sways, and a coral in another group would be stone.
  expect(placements.filter(({ group, p }) => group !== 'corals' && p.piece.startsWith('coral_'))).toEqual([]);
  expect(world.props.find(prop => prop.node === 'portal_glyph')).toMatchObject({ drive: 'emissive' });
});

const bobProps = OBSERVATORY_PROPS.filter(prop => prop.drive === 'bob');

test("every floating fragment bobs: one 'bob' prop per rubble piece, on a piece the kit file holds and the layout places once, in the rubble group", () => {
  expect(bobProps.map(prop => prop.node).sort()).toEqual([...RUBBLE_PIECES].sort());
  expect(new Set(OBSERVATORY_PROPS.map(prop => prop.id)).size).toBe(OBSERVATORY_PROPS.length);
  for (const prop of bobProps) {
    expect(kit.nodes.has(prop.node), `${prop.node} is a node of kit.glb`).toBe(true);
    // The engine bobs placed layout pieces, found by piece name: this one is placed exactly once, in a plain stone group.
    expect(placements.filter(({ p }) => p.piece === prop.node).map(({ group }) => group), prop.node).toEqual(['rubble']);
  }
});

test('the bob is 0.04 stage units and takes 7 to 11 s, a different period for each fragment', () => {
  for (const prop of bobProps) {
    if (prop.drive !== 'bob') throw new Error('a bob prop');
    expect(prop.bob.amplitude, prop.id).toBe(0.04);
    expect(RUBBLE_BOB_AMPLITUDE).toBe(0.04);
    expect(prop.bob.period, prop.id).toBeGreaterThanOrEqual(7);
    expect(prop.bob.period, prop.id).toBeLessThanOrEqual(11);
  }
  const periods = bobProps.map(prop => (prop.drive === 'bob' ? prop.bob.period : 0));
  expect(new Set(periods).size).toBe(periods.length);
});

test('bobbing up or down by its amplitude moves no rubble into the intro frame or the arm-span box', () => {
  const armHalf = 3.84 / 2 + 0.3;
  const aspects = [AETHER_STAGE_FRAMES.intro.width / AETHER_STAGE_FRAMES.intro.height, 1.5, 16 / 9];
  for (const prop of bobProps) {
    if (prop.drive !== 'bob') throw new Error('a bob prop');
    const { amplitude } = prop.bob;
    const p = layout.groups.rubble.find(placement => placement.piece === prop.node)!;
    const box = kit.bounds(p.piece);
    // Arm-span box: the clearance on the ground plane does not depend on height, so the bob cannot change it.
    expect(Math.abs(p.position[0]) - reach(p) - armHalf, `${p.piece} clears the arm-span box`).toBeGreaterThanOrEqual(0);
    // Intro frame (and 3:2 and 16:9 windows): a piece out of it at rest stays out at both ends of the bob, and a piece in it stays in.
    for (const aspect of aspects) {
      const seen = (dy: number) => placedPoints(box, { ...p, position: [p.position[0], p.position[1] + dy, p.position[2]], tilt: 0 }).filter(point => inView(point, aspect)).length;
      const rest = seen(0);
      for (const dy of [-amplitude, amplitude]) {
        if (rest === 0) expect(seen(dy), `${p.piece} at bob ${dy} enters the view at aspect ${aspect.toFixed(2)}`).toBe(0);
        else expect(seen(dy), `${p.piece} at bob ${dy} leaves the view at aspect ${aspect.toFixed(2)}`).toBeGreaterThan(0);
      }
    }
  }
});
