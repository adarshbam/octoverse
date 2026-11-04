import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { CAMERA_Z } from '../../../engine/config/stage';
import { faceAnchor } from '../../../engine/types/bundle';
import { PROP_DRIVE_IDS, bobOffset } from '../../../engine/world/props';
import type { Placement, WorldConfig } from '../../../engine/world/types';
import { asWorldLayout, layoutProblems, validateWorld } from '../../../engine/world/validateWorld';
import { HOST_BUNDLE, HOST_STAGE_FRAMES } from '../bundle';
import { REEF_WORLD } from './config';
import layoutData from './layout.json';

// The reef's layout against the kit it is built from (blender/reef/build_kit.py writes the kit
// file and `kit.nodes.json`, the node list this test reads), and against the paintings P1 and P2.

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const KIT_DIR = join(ROOT, 'public', 'octoverse', 'world', 'reef');
const layout = asWorldLayout(layoutData);
const placements = Object.entries(layout.groups).flatMap(([group, list]) => list.map((p, index) => ({ group, index, p })));

type Box = { min: [number, number, number]; max: [number, number, number] };
interface NodeList {
  url: string;
  pieces: string[];
  nodes: string[];
  attached: { node: string; piece: string }[];
  /** Per node (and `_lod1`): the bounding box in the node's own frame, glTF axes (x right, y up, z toward the camera), and the radius of placed pieces. */
  info: Record<string, { bounds: Box; radius?: number }>;
}
const nodeList = JSON.parse(readFileSync(join(KIT_DIR, 'kit.nodes.json'), 'utf8')) as NodeList;

/** The kit file's own node names (the JSON chunk of the glb), which must agree with the list written beside it. */
const glbNodes = (() => {
  const data = readFileSync(join(KIT_DIR, 'kit.glb'));
  expect(data.subarray(0, 4).toString()).toBe('glTF');
  const doc = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString('utf8')) as { nodes: { name?: string; extras?: { radius?: number } }[] };
  return new Map(doc.nodes.map(node => [node.name ?? '', node.extras ?? {}] as const));
})();

const cards = nodeList.pieces.filter(name => name.startsWith('card_glass_'));

/** How far a placement reaches on the ground plane: the piece's bounding radius (about its origin) times its largest horizontal scale. */
const reach = (p: Placement) => {
  const radius = nodeList.info[p.piece]?.radius;
  expect(radius, `${p.piece} carries a radius`).toBeGreaterThan(0);
  const s = p.scale ?? 1;
  return radius! * (typeof s === 'number' ? s : Math.max(s[0], s[2]));
};

/** The corners of a node's box, placed as the page places a piece: scale, then turn about y, then move (no tilt). */
function placedCorners({ min, max }: Box, p: Placement) {
  expect(p.tilt ?? 0, `${p.piece} tilt (this test reads untilted placements)`).toBe(0);
  const s = p.scale ?? 1;
  const [sx, sy, sz] = typeof s === 'number' ? [s, s, s] : s;
  const cos = Math.cos(p.rotY ?? 0);
  const sin = Math.sin(p.rotY ?? 0);
  const out: [number, number, number][] = [];
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]])
      for (const z of [min[2], max[2]]) out.push([p.position[0] + x * sx * cos + z * sz * sin, p.position[1] + y * sy, p.position[2] - x * sx * sin + z * sz * cos]);
  return out;
}

/** A world point in the frame the stage panels are drawn in: the camera sits at z = CAMERA_Z on the axis, the frame is the z = 0 plane. */
const toFrame = ([x, y, z]: readonly [number, number, number]) => [(x * CAMERA_Z) / (CAMERA_Z - z), (y * CAMERA_Z) / (CAMERA_Z - z)] as const;

/** The frame rectangle a node of a placement covers: [x0, x1, y0, y1]. */
function frameBox(box: Box, p: Placement) {
  const pts = placedCorners(box, p).map(toFrame);
  const xs = pts.map(q => q[0]);
  const ys = pts.map(q => q[1]);
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] as const;
}

/** Distance from a point to an axis-aligned rectangle (0 inside). */
const gapToRect = (px: number, py: number, [x0, x1, y0, y1]: readonly [number, number, number, number]) => Math.hypot(Math.max(x0 - px, 0, px - x1), Math.max(y0 - py, 0, py - y1));

function distanceToSegment([px, pz]: readonly [number, number], [ax, az]: readonly [number, number], [bx, bz]: readonly [number, number]) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

/** The swim path of the entrance on the ground plane (x, z): from the far left to the stage spot. */
const SWIM_PATH = [
  [-9, -6],
  [-5.2, -3],
  [-2.2, -1],
  [0, 0],
] as const;
const SWIM_WIDTH = 2.4;

const gate = placements.filter(({ p }) => p.piece === 'gate_arch');
const GATE_NODES = ['gate_windows', 'gate_membrane', 'gate_glyph'];

test('the layout is a valid layout and names only pieces in the kit', () => {
  expect(layoutProblems(layoutData)).toEqual([]);
  for (const { group, index, p } of placements) expect(nodeList.pieces, `${group}[${index}] ${p.piece}`).toContain(p.piece);
  // Nothing is lit by the layout (the bake carries the glow), there are no chains and no lava lights.
  expect(placements.filter(({ p }) => p.light)).toEqual([]);
  expect(layout.chains).toEqual([]);
  expect(layout.coralLights).toEqual([]);
});

test('every kit node is in the glb, each placed piece with its lod1 and its radius, and the list beside the kit agrees with the file', () => {
  for (const name of [...nodeList.pieces, ...nodeList.nodes]) expect(glbNodes.has(name), name).toBe(true);
  for (const piece of nodeList.pieces) {
    expect(glbNodes.has(`${piece}_lod1`), `${piece}_lod1`).toBe(true);
    expect(glbNodes.get(piece)!.radius, `${piece} radius`).toBeGreaterThan(0);
    expect(nodeList.info[piece].radius, `${piece} listed radius`).toBeGreaterThan(0);
  }
  for (const name of GATE_NODES) expect(nodeList.nodes, name).toContain(name);
  // The named parts of the brief.
  for (const name of ['gate_arch', 'gate_windows', 'gate_membrane', 'gate_glyph']) expect([...nodeList.pieces, ...nodeList.nodes], name).toContain(name);
  for (const prefix of ['rock_', 'coral_magenta_', 'coral_orange_']) expect(nodeList.pieces.some(n => n.startsWith(prefix)), prefix).toBe(true);
  // The gate's parts share the arch's frame: attached to it, each drawn with every placement of the arch.
  expect(nodeList.attached).toEqual(GATE_NODES.map(node => ({ node, piece: 'gate_arch' })));
});

test('six to eight thin glass cards are in the kit, and none stands within 0.6 of the intro face anchor', () => {
  expect(cards.length).toBeGreaterThanOrEqual(6);
  expect(cards.length).toBeLessThanOrEqual(8);
  expect(cards).toEqual(Array.from({ length: cards.length }, (_, i) => `card_glass_0${i + 1}`));
  const [ax, ay, az] = faceAnchor(HOST_BUNDLE, 'intro');
  for (const name of cards) {
    const { bounds } = nodeList.info[name];
    expect(bounds.max[2] - bounds.min[2], `${name} is thin`).toBeLessThan(0.12);
    const placed = placements.filter(({ p }) => p.piece === name);
    expect(placed, `${name} is placed once`).toHaveLength(1);
    const { p } = placed[0];
    // On the stage the card is behind the host (never in front of its arms) ...
    expect(p.position[2], `${name} is behind the host`).toBeLessThanOrEqual(-0.5);
    // ... no part of it comes within 0.6 of the face in the picture's frame, nor in the world.
    expect(gapToRect(ax, ay, frameBox(bounds, p)), `${name} in the frame`).toBeGreaterThanOrEqual(0.6);
    const nearest = Math.min(...placedCorners(bounds, p).map(c => Math.hypot(c[0] - ax, c[1] - ay, c[2] - az)));
    expect(nearest, `${name} in the world`).toBeGreaterThanOrEqual(0.6);
  }
});

test('the gate stands right and back: P1 puts its membrane at about x +0.95 to +2.05, y -1.35 to +1.0 in the entrance frame', () => {
  expect(gate).toHaveLength(1);
  const p = gate[0].p;
  expect(p.position[0]).toBeGreaterThan(1.2);
  expect(p.position[2]).toBeLessThan(-2);
  expect(p.position[1]).toBeCloseTo(layout.floorY, 1);
  const [x0, x1, y0, y1] = frameBox(nodeList.info.gate_membrane.bounds, p);
  expect(Math.abs(x0 - 0.95)).toBeLessThan(0.12);
  expect(Math.abs(x1 - 2.05)).toBeLessThan(0.12);
  expect(Math.abs(y0 - -1.35)).toBeLessThan(0.1);
  expect(Math.abs(y1 - 1.0)).toBeLessThan(0.1);
  // The glyph stands inside the doorway, the windows inside the arch's masonry.
  const [gx0, gx1, gy0, gy1] = frameBox(nodeList.info.gate_glyph.bounds, p);
  expect(gx0).toBeGreaterThan(x0);
  expect(gx1).toBeLessThan(x1);
  expect(gy0).toBeGreaterThan(y0);
  expect(gy1).toBeLessThan(y1);
  const arch = frameBox(nodeList.info.gate_arch.bounds, p);
  const windows = frameBox(nodeList.info.gate_windows.bounds, p);
  expect(windows[0]).toBeGreaterThanOrEqual(arch[0]);
  expect(windows[1]).toBeLessThanOrEqual(arch[1]);
});

// TODO(Task 5/6): the 7.7 intro rule (gate soft or out of frame, brightest pixel below the face glow) is asserted by a rendered check in Task 5.
test('in the intro frame the gate stands right of the host: its membrane is clear of the face and its masonry reaches the right edge', () => {
  const p = gate[0].p;
  const [ax] = faceAnchor(HOST_BUNDLE, 'intro');
  const [x0] = frameBox(nodeList.info.gate_membrane.bounds, p);
  expect(x0).toBeGreaterThan(ax + 0.6);
  // The intro frame shows 2.56 each side of the centre (P2); the gate's masonry reaches the right edge of it.
  const half = HOST_STAGE_FRAMES.intro.width / 2;
  const arch = frameBox(nodeList.info.gate_arch.bounds, p);
  expect(arch[1]).toBeGreaterThan(half - 0.6);
  // A fallen block at the arch's foot may reach a little left of the face, low down and far behind it; the masonry stays right of that.
  expect(arch[0]).toBeGreaterThan(-1.0);
});

test('rocks frame both sides, foreground and mid water; the corals stand in clumps at the corners', () => {
  const rocks = layout.groups.rocks ?? [];
  expect(rocks.length).toBeGreaterThanOrEqual(6);
  expect(rocks.every(p => /^rock_/.test(p.piece))).toBe(true);
  expect(rocks.filter(p => p.position[0] < -1.5).length).toBeGreaterThanOrEqual(3);
  expect(rocks.filter(p => p.position[0] > 1.5).length).toBeGreaterThanOrEqual(3);
  expect(rocks.filter(p => p.position[2] > 0).length).toBeGreaterThanOrEqual(2);
  const corals = layout.groups.corals ?? [];
  expect(corals.every(p => /^coral_(magenta|orange)_/.test(p.piece))).toBe(true);
  // Only the `corals` group sways: a coral piece must not stand in any other group.
  expect(placements.filter(({ group, p }) => group !== 'corals' && p.piece.startsWith('coral_'))).toEqual([]);
  const left = corals.filter(p => p.position[0] < -1.5);
  const right = corals.filter(p => p.position[0] > 1.5);
  expect(left.length).toBeGreaterThanOrEqual(3);
  expect(right.length).toBeGreaterThanOrEqual(3);
  for (const clump of [left, right]) {
    expect(clump.some(p => p.piece.startsWith('coral_magenta_'))).toBe(true);
    expect(clump.some(p => p.piece.startsWith('coral_orange_'))).toBe(true);
  }
});

test('the path from the far left to the stage spot stays clear of rocks, corals and the gate', () => {
  for (const { group, index, p } of placements) {
    if (group === 'cards') continue; // floating scenery behind the host, not on the floor
    const point = [p.position[0], p.position[2]] as const;
    let best = Infinity;
    for (let i = 0; i + 1 < SWIM_PATH.length; i++) best = Math.min(best, distanceToSegment(point, SWIM_PATH[i], SWIM_PATH[i + 1]));
    expect(best - reach(p) - SWIM_WIDTH / 2, `${group}[${index}] ${p.piece} at (${p.position[0]}, ${p.position[2]}) is on the path`).toBeGreaterThanOrEqual(0);
  }
});

test('the layout stands on the floor of the host stage', () => {
  expect(layout.floorY).toBeCloseTo(-2.45, 5);
  expect(Object.keys(layout.groups).sort()).toEqual(['cards', 'corals', 'gate', 'rocks']);
});

/** The reef world (Task 5) on this kit: the stage's water, this kit and layout, the gate's parts attached to the arch. */
const world = (props: WorldConfig['props']): WorldConfig => ({
  ...REEF_WORLD,
  kit: { url: '/octoverse/world/reef/kit.glb', pieces: nodeList.pieces, nodes: nodeList.nodes, attached: nodeList.attached },
  layout,
  props,
});

test('the engine accepts this kit and layout, with the glyph on the emissive drive', () => {
  expect(PROP_DRIVE_IDS).toContain('emissive');
  expect(validateWorld(world([{ id: 'gateGlyph', node: 'gate_glyph', drive: 'emissive' }]))).toEqual([]);
  // Declaring every card as an 'emissive' prop is only a way to validate that each card is a kit node a prop may
  // name. It must not be copied into the real config: the cards take 'bob' (the test below), not 'emissive'.
  // The reef draws the cards with a glow material (Task 5), which sets its own level: the check runs without the materials.
  for (const name of cards) expect(validateWorld({ ...world([{ id: name, node: name, drive: 'emissive' }]), materials: [] }), name).toEqual([]);
});

test('the cards are on the bob drive, each its own prop with its own small, slow motion', () => {
  expect(PROP_DRIVE_IDS).toContain('bob');
  const props = REEF_WORLD.props ?? [];
  expect(props.map(p => p.node)).toEqual(cards);
  expect(new Set(props.map(p => p.id)).size).toBe(cards.length);
  for (const prop of props) {
    expect(prop.drive, prop.id).toBe('bob');
    // Scenery: 0.04 to 0.08 stage units either way, once every 5 to 9 seconds.
    expect(prop.bob?.amplitude, prop.id).toBeGreaterThanOrEqual(0.04);
    expect(prop.bob?.amplitude, prop.id).toBeLessThanOrEqual(0.08);
    expect(prop.bob?.period, prop.id).toBeGreaterThanOrEqual(5);
    expect(prop.bob?.period, prop.id).toBeLessThanOrEqual(9);
  }
  // The cards do not all move alike: the periods vary.
  expect(new Set(props.map(p => p.bob?.period)).size).toBeGreaterThanOrEqual(4);
  // Their phases come from their ids (props.ts), so they bob out of step.
  expect(new Set(props.map(p => bobOffset(1.3, p, 1))).size).toBe(cards.length);
  // The engine accepts the world with the cards on bob beside their glow material (only an 'emissive' drive clashes with one).
  expect(validateWorld(REEF_WORLD)).toEqual([]);
  expect(validateWorld(world(props))).toEqual([]);
  for (const node of cards) expect(REEF_WORLD.materials?.find(m => m.node === node)?.material, node).toBe('glow');
});
