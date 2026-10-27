/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { CAMERA_Z } from '../config/stage';
import { KIT_LOD_DISTANCE, LOD_HYSTERESIS } from './kitLod';
import layoutData from './security/layout.json';
import { SECURITY_WORLD } from './security/config';
import type { Vec3, WorldConfig } from './types';
import { asWorldLayout, layoutProblems, validateWorld } from './validateWorld';

const placements = (world: WorldConfig) => [...world.layout.pillars, ...world.layout.rocks, ...world.layout.corals];

const KIT_FILE = new URL('../../../public/nox/world/security/kit.glb', import.meta.url);

interface GltfNode {
  name?: string;
  mesh?: number;
  children?: number[];
  extras?: Record<string, unknown>;
}
interface Gltf {
  nodes: GltfNode[];
  meshes: { primitives: { indices?: number; attributes: Record<string, number> }[] }[];
  accessors: { count: number }[];
  extensionsUsed?: string[];
}

/** The kit file's glTF JSON. A glb is a 12-byte header, then a JSON chunk (length, type, data); compression leaves it readable. */
function readKit() {
  const glb = readFileSync(KIT_FILE);
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as Gltf;
  const byName = new Map(json.nodes.filter(n => n.name).map(n => [n.name!, n]));
  /** Triangles drawn by a node and everything under it. */
  const triangles = (node: GltfNode): number => {
    const own = node.mesh === undefined ? 0 : json.meshes[node.mesh].primitives.reduce((sum, p) => sum + json.accessors[p.indices!].count / 3, 0);
    return own + (node.children ?? []).reduce((sum, child) => sum + triangles(json.nodes[child]), 0);
  };
  return { json, size: glb.length, byName, triangles };
}

test('SECURITY_WORLD is valid', () => {
  expect(validateWorld(SECURITY_WORLD)).toEqual([]);
});

test('every placement names a kit piece', () => {
  expect(placements(SECURITY_WORLD).length).toBeGreaterThan(30);
  for (const p of placements(SECURITY_WORLD)) expect(SECURITY_WORLD.kit.pieces).toContain(p.piece);
  expect(SECURITY_WORLD.kit.pieces).toContain('chain');
});

test('the kit file holds every piece the world names', () => {
  const { byName } = readKit();
  for (const piece of SECURITY_WORLD.kit.pieces) expect(byName.has(piece), piece).toBe(true);
});

test('every piece has a lod1', () => {
  const { byName, triangles } = readKit();
  for (const piece of SECURITY_WORLD.kit.pieces) {
    const full = byName.get(piece);
    const far = byName.get(`${piece}_lod1`);
    expect(far, `${piece}_lod1`).toBeDefined();
    // About a quarter of the full piece's triangles.
    const share = triangles(far!) / triangles(full!);
    expect(share, piece).toBeGreaterThan(0.15);
    expect(share, piece).toBeLessThan(0.35);
  }
});

test('the kit is meshopt-compressed and inside the 6 MB world budget', () => {
  const { json, size } = readKit();
  expect(json.extensionsUsed).toContain('EXT_meshopt_compression');
  expect(size).toBeLessThan(6 * 1024 * 1024);
});

test('layout.json matches the WorldLayout schema', () => {
  expect(layoutProblems(layoutData)).toEqual([]);
  expect(asWorldLayout(layoutData)).toBe(layoutData);
  // Each kind of mistake is named: a missing field, a short position, an unknown key (Blender
  // reads the same file, so a misspelt key would be silently ignored there), a wrong type.
  const [pillar, ...pillars] = layoutData.pillars;
  const broken = (change: object) => layoutProblems({ ...layoutData, ...change }).join('\n');
  expect(broken({ floorY: undefined })).toContain('floorY');
  expect(broken({ pillars: [{ ...pillar, position: [1, 2] }, ...pillars] })).toContain('pillars[0]');
  expect(broken({ pillars: [{ ...pillar, rotZ: 0.2 }, ...pillars] })).toContain('rotZ');
  expect(broken({ rocks: [{ piece: 'rock_0', position: [0, 0, 0], scale: 'big' }] })).toContain('rocks[0]');
  expect(broken({ chains: [{ from: [0, 0, 0], to: [1, 1, 1] }] })).toContain('chains[0]');
  expect(broken({ coralLights: [[0, 0]] })).toContain('coralLights[0]');
  expect(broken({ lights: [] })).toContain('lights');
  expect(() => asWorldLayout({ ...layoutData, floorY: 'low' })).toThrow(/floorY/);
});

test('pillars keep the open corridor: no pillar inside |x| < 2.9 for z between -30 and 2', () => {
  const inCorridor = SECURITY_WORLD.layout.pillars.filter(p => {
    const [x, , z] = p.position;
    return z >= -30 && z <= 2 && Math.abs(x) < 2.9;
  });
  expect(inCorridor).toEqual([]);
});

test('the intro draws its front lit pillars at full detail: each is inside the kit LOD distance from the panel 2 camera', () => {
  // The stage camera stands on the z axis at CAMERA_Z (config/stage.ts; App.tsx puts it at
  // (0, 0, CAMERA_Z) for the intro and its panel 2 view). THREE.LOD measures from the camera to the
  // piece's origin, the pillar's foot. A piece that shows its lod1 comes back to full detail only
  // inside KIT_LOD_DISTANCE less LOD_HYSTERESIS, so that is the line the pillars must clear in any
  // state, including a camera hover that has just swapped them. The rear lit pillars (about 18 and
  // 19 units away) are far enough back to draw their lod1.
  const camera: Vec3 = [0, 0, CAMERA_Z];
  const fullDetail = KIT_LOD_DISTANCE * (1 - LOD_HYSTERESIS);
  const lit = SECURITY_WORLD.layout.pillars.filter(p => p.light);
  for (const side of [-1, 1]) {
    const distances = lit.filter(p => Math.sign(p.position[0]) === side).map(p => Math.hypot(...p.position.map((v, i) => v - camera[i])));
    expect(distances.length, `lit pillars at x ${side < 0 ? '< 0' : '> 0'}`).toBeGreaterThan(0);
    expect(Math.min(...distances), `front lit pillar at x ${side < 0 ? '< 0' : '> 0'}`).toBeLessThan(fullDetail);
  }
});

test('a world with an unknown piece or a light without skinRange is reported', () => {
  const [first, ...rest] = SECURITY_WORLD.layout.rocks;
  const unknown: WorldConfig = { ...SECURITY_WORLD, layout: { ...SECURITY_WORLD.layout, rocks: [{ ...first, piece: 'rock_99' }, ...rest] } };
  expect(validateWorld(unknown).join('\n')).toContain('rock_99');
  const [light, ...others] = SECURITY_WORLD.lights.points;
  const unranged: WorldConfig = {
    ...SECURITY_WORLD,
    lights: { ...SECURITY_WORLD.lights, points: [{ ...light, skinRange: undefined as unknown as number }, ...others] },
  };
  expect(validateWorld(unranged).join('\n')).toContain('skinRange');
});

test('one glyph light per lit pillar', () => {
  const lit = SECURITY_WORLD.layout.pillars.filter(p => p.light).length;
  const glyphs = SECURITY_WORLD.lights.points.filter(l => l.kind === 'glyph');
  expect(glyphs).toHaveLength(lit);
  const dropped: WorldConfig = { ...SECURITY_WORLD, lights: { ...SECURITY_WORLD.lights, points: SECURITY_WORLD.lights.points.slice(1) } };
  expect(validateWorld(dropped).join('\n')).toContain('glyph');
});

test('each glyph light stands before its lit pillar, at the height of that piece’s glyph column in the kit', () => {
  const { byName } = readKit();
  const lit = SECURITY_WORLD.layout.pillars.filter(p => p.light);
  const glyphs = SECURITY_WORLD.lights.points.filter(l => l.kind === 'glyph');
  lit.forEach((pillar, i) => {
    const [px, py, pz] = pillar.position;
    const [lx, ly, lz] = glyphs[i].position;
    expect(Math.hypot(lx - px, lz - pz), `glyph light ${i}`).toBeLessThan(1.5);
    // In front of the pillar: the side its glyphs face (+z turned by rotY).
    const rot = pillar.rotY ?? 0;
    expect((lx - px) * Math.sin(rot) + (lz - pz) * Math.cos(rot), `glyph light ${i}`).toBeGreaterThan(0.5);
    const centre = byName.get(pillar.piece)?.extras?.glyph_centre;
    expect(typeof centre, `${pillar.piece} glyph_centre`).toBe('number');
    expect(ly - py, `glyph light ${i}`).toBeCloseTo(centre as number, 2);
  });
});

test('the layout carries the test scene: 14 pillars, 16 rocks, 11 corals, 4 chains, 4 coral lights', () => {
  const { layout } = SECURITY_WORLD;
  expect([layout.pillars.length, layout.rocks.length, layout.corals.length, layout.chains.length, layout.coralLights.length]).toEqual([14, 16, 11, 4, 4]);
  expect(layout.floorY).toBe(-2.45);
});
