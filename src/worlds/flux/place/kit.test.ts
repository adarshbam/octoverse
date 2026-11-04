import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { kitMaterialFor } from '../../../engine/world/kitMaterials';
import { INLAY_NODES, LED_LOD1_NODES, LED_NODES, PIPELINE_KIT, inlayMaterials, ledMaterials } from './kit';

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
  expect([...LED_NODES].sort()).toEqual(owners.map(o => `${o}_led`).sort());
  expect([...PIPELINE_KIT.nodes].sort()).toEqual([...LED_NODES, ...INLAY_NODES].sort());
  expect([...LED_LOD1_NODES].sort()).toEqual(owners.map(o => `${o}_lod1_led`).sort());
  // Top level: no LED node is a child of its piece (the page clones a piece with its children and dresses them all as stone).
  const children = new Set(doc.nodes.flatMap(n => n.children ?? []));
  for (const name of [...LED_NODES, ...LED_LOD1_NODES]) {
    expect(children.has(doc.nodes.indexOf(nodes.get(name)!)), `${name} is top level`).toBe(false);
    expect(materialsOf(name), name).toEqual(['led']);
    const [primitive] = doc.meshes[nodes.get(name)!.mesh!].primitives;
    expect(Object.keys(primitive.attributes)).toEqual(expect.arrayContaining(['POSITION', 'COLOR_0', '_PHASE']));
  }
  // The pieces themselves keep no LED faces: the stone dressing would paint them over.
  for (const owner of owners) for (const name of [owner, `${owner}_lod1`]) expect(materialsOf(name), name).not.toContain('led');
  // No other node of the kit draws with the led material.
  const ledNodes = new Set<string>([...LED_NODES, ...LED_LOD1_NODES]);
  for (const [name, node] of nodes) if (node.mesh !== undefined && !ledNodes.has(name)) expect(materialsOf(name), name).not.toContain('led');
});

test('each LED node is attached to its own piece and drawn with the led material', () => {
  expect(PIPELINE_KIT.attached.filter(a => a.node.endsWith('_led'))).toEqual(LED_NODES.map(node => ({ node, piece: node.slice(0, -'_led'.length) })));
  for (const { piece } of PIPELINE_KIT.attached) expect(PIPELINE_KIT.pieces).toContain(piece);
  const params = { intensity: 1, rate: [0.4, 2.5] as const, duty: 0.6 };
  const materials = ledMaterials(params);
  expect(materials.map(m => m.node)).toEqual([...LED_NODES]);
  for (const m of materials) expect(m).toEqual({ node: m.node, material: 'led', params });
  // The pieces keep their stone dressing; only the LED nodes take the led.
  for (const piece of PIPELINE_KIT.pieces) expect(kitMaterialFor(materials, piece), piece).toBeUndefined();
});

test('each ring arc keeps its lit inlay as its own top-level node, attached to the arc, one membrane each (Task 9)', () => {
  const arcs = ['portal_arc_1', 'portal_arc_2', 'portal_arc_3', 'portal_arc_4'];
  expect([...INLAY_NODES]).toEqual(arcs.map(arc => `${arc}_inlay`));
  expect(PIPELINE_KIT.attached.filter(a => a.node.endsWith('_inlay'))).toEqual(arcs.map(piece => ({ node: `${piece}_inlay`, piece })));
  const children = new Set(doc.nodes.flatMap(n => n.children ?? []));
  for (const name of INLAY_NODES) {
    expect(children.has(doc.nodes.indexOf(nodes.get(name)!)), `${name} is top level`).toBe(false);
    expect(materialsOf(name), name).toEqual(['portal_inlay']);
  }
  // The arcs keep only their stone: no inlay faces left on them for the stone dressing to paint over.
  for (const arc of arcs) for (const name of [arc, `${arc}_lod1`]) expect(materialsOf(name), name).not.toContain('portal_inlay');
  const params = { color: '#0e2238', edge: '#2a5a8a', flowSpeed: 0, flowScale: 1, flash: 4 };
  const materials = inlayMaterials(params);
  expect(materials).toEqual(INLAY_NODES.map(node => ({ node, material: 'membrane', params })));
});

test('the portal disc carries a flow map as its second UV set, for the membrane it is drawn with', () => {
  for (const name of ['portal_disc', 'portal_disc_lod1']) {
    const node = nodes.get(name)!;
    for (const primitive of doc.meshes[node.mesh!].primitives) expect(Object.keys(primitive.attributes), name).toEqual(expect.arrayContaining(['TEXCOORD_0', 'TEXCOORD_1']));
  }
});
