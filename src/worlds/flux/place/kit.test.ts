import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { kitMaterialFor } from '../../../engine/world/kitMaterials';
import { LED_LOD1_NODES, PIPELINE_KIT, ledMaterials } from './kit';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');

interface Primitive {
  attributes: Record<string, number>;
  material?: number;
}

/** The kit file's JSON chunk: its nodes (name, mesh, extras), meshes and materials. */
const doc = (() => {
  const data = readFileSync(join(ROOT, 'public', PIPELINE_KIT.url));
  expect(data.subarray(0, 4).toString()).toBe('glTF');
  return JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString('utf8')) as {
    nodes: { name?: string; mesh?: number; children?: number[]; extras?: Record<string, unknown> }[];
    meshes: { primitives: Primitive[] }[];
    materials: { name?: string }[];
  };
})();
const nodes = new Map(doc.nodes.map(node => [node.name ?? '', node] as const));

/** The material names of a node's primitives (one per primitive). */
const materialsOf = (name: string) => {
  const node = nodes.get(name);
  expect(node, name).toBeDefined();
  expect(node!.mesh, `${name} has a mesh`).toBeDefined();
  return doc.meshes[node!.mesh!].primitives.map(p => (p.material === undefined ? '' : (doc.materials[p.material].name ?? '')));
};

test('the kit file holds every piece and its lod1, each placed piece with its bounding radius', () => {
  for (const piece of PIPELINE_KIT.pieces) {
    expect(nodes.has(piece), piece).toBe(true);
    expect(nodes.has(`${piece}_lod1`), `${piece}_lod1`).toBe(true);
    expect(nodes.get(piece)!.extras?.radius, `${piece} radius`).toBeGreaterThan(0);
  }
});

test('the LED faces of the towers and the rack module are their own top-level nodes, on the led material with colour and phase (R22)', () => {
  const owners = ['tower_a', 'tower_b', 'tower_c', 'rack_module'];
  expect([...PIPELINE_KIT.nodes].sort()).toEqual(owners.map(o => `${o}_led`).sort());
  expect([...LED_LOD1_NODES].sort()).toEqual(owners.map(o => `${o}_lod1_led`).sort());
  // Top level: no LED node is a child of its piece (the page clones a piece with its children and dresses them all as stone).
  const children = new Set(doc.nodes.flatMap(n => n.children ?? []));
  for (const name of [...PIPELINE_KIT.nodes, ...LED_LOD1_NODES]) {
    expect(children.has(doc.nodes.indexOf(nodes.get(name)!)), `${name} is top level`).toBe(false);
    expect(materialsOf(name), name).toEqual(['led']);
    const [primitive] = doc.meshes[nodes.get(name)!.mesh!].primitives;
    expect(Object.keys(primitive.attributes)).toEqual(expect.arrayContaining(['POSITION', 'COLOR_0', '_PHASE']));
  }
  // The pieces themselves keep no LED faces: the stone dressing would paint them over.
  for (const owner of owners) for (const name of [owner, `${owner}_lod1`]) expect(materialsOf(name), name).not.toContain('led');
  // No other node of the kit draws with the led material.
  const ledNodes = new Set<string>([...PIPELINE_KIT.nodes, ...LED_LOD1_NODES]);
  for (const [name, node] of nodes) if (node.mesh !== undefined && !ledNodes.has(name)) expect(materialsOf(name), name).not.toContain('led');
});

test('each LED node is attached to its own piece and drawn with the led material', () => {
  expect(PIPELINE_KIT.attached).toEqual(PIPELINE_KIT.nodes.map(node => ({ node, piece: node.slice(0, -'_led'.length) })));
  for (const { piece } of PIPELINE_KIT.attached) expect(PIPELINE_KIT.pieces).toContain(piece);
  const params = { intensity: 1, rate: [0.4, 2.5] as const, duty: 0.6 };
  const materials = ledMaterials(params);
  expect(materials.map(m => m.node)).toEqual([...PIPELINE_KIT.nodes]);
  for (const m of materials) expect(m).toEqual({ node: m.node, material: 'led', params });
  // The pieces keep their stone dressing; only the LED nodes take the led.
  for (const piece of PIPELINE_KIT.pieces) expect(kitMaterialFor(materials, piece), piece).toBeUndefined();
});
