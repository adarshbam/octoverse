/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { CAMERA_Z } from '../config/stage';
import { asBakeRecord, reliefOf, stoneLights, type BakedLight, type LightRect } from './bakedLight';
import { KIT_LOD_DISTANCE, LOD_HYSTERESIS } from './kitLod';
import { SEABED, floorHeight } from './seabed';
import layoutData from './security/layout.json';
import { SECURITY_WORLD } from './security/config';
import type { Vec3, WorldConfig } from './types';
import { asWorldLayout, layoutProblems, validateWorld } from './validateWorld';

const placements = (world: WorldConfig) => [...world.layout.pillars, ...world.layout.rocks, ...world.layout.corals];

const PUBLIC = new URL('../../../public/', import.meta.url);
const KIT_FILE = new URL('nox/world/security/kit.glb', PUBLIC);
const NEAR_FILE = new URL('nox/world/security/near.glb', PUBLIC);

interface GltfNode {
  name?: string;
  mesh?: number;
  children?: number[];
  extras?: Record<string, unknown>;
}
interface Gltf {
  nodes: GltfNode[];
  meshes: { primitives: { indices?: number; attributes: Record<string, number>; material?: number }[] }[];
  accessors: { count: number }[];
  materials: { name?: string; emissiveTexture?: { index: number }; normalTexture?: { index: number } }[];
  textures: { source?: number; extensions?: Record<string, { source: number }> }[];
  images: { mimeType?: string }[];
  scenes: { extras?: Record<string, unknown> }[];
  extensionsUsed?: string[];
}

/** A glb file's glTF JSON. A glb is a 12-byte header, then a JSON chunk (length, type, data); compression leaves it readable. */
function readGlb(file: URL) {
  const glb = readFileSync(file);
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as Gltf;
  const byName = new Map(json.nodes.filter(n => n.name).map(n => [n.name!, n]));
  /** Triangles drawn by a node and everything under it. */
  const triangles = (node: GltfNode): number => {
    const own = node.mesh === undefined ? 0 : json.meshes[node.mesh].primitives.reduce((sum, p) => sum + json.accessors[p.indices!].count / 3, 0);
    return own + (node.children ?? []).reduce((sum, child) => sum + triangles(json.nodes[child]), 0);
  };
  return { json, size: glb.length, byName, triangles };
}
const readKit = () => readGlb(KIT_FILE);
/** What bake_world.py recorded in near.glb: the layout, lights and seabed it baked, and where each piece's light lies. */
const readBake = () => asBakeRecord(readGlb(NEAR_FILE).json.scenes[0].extras?.nox_bake);

/** Bytes in every file under a folder of public/. */
function folderBytes(folder: string) {
  const path = fileURLToPath(new URL(folder, PUBLIC));
  const files = readdirSync(path, { recursive: true, encoding: 'utf8' }).map(name => statSync(join(path, name))).filter(entry => entry.isFile());
  return files.reduce((sum, entry) => sum + entry.size, 0);
}

// The test scene's relic glow (src/spikeEnv/World.tsx, the owner's material, read only). The
// numbers are copied, not imported, because the spike goes in Task 12 (R4): the glyph panels draw
// white x 2.4 (line 199), the coral glows its red x 1.7 (line 166), and each lit pillar's glyph
// light, the red it spills on the stone, is 1.7 (line 233).
const TEST_SCENE = { glyphEmission: 2.4, coralEmission: 1.7, glyphLight: 1.7 };

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

test('the kit is meshopt-compressed, and what a visitor downloads fits the 6 MB budget', () => {
  expect(readKit().json.extensionsUsed).toContain('EXT_meshopt_compression');
  // What one visitor fetches (R35): the page loads near.glb or kit.glb, never both, so the larger
  // of the two counts, with the shared world files (the far plate's layers) and the KTX2 transcoder.
  const files = folderBytes('nox/world/') + folderBytes('nox/basis/');
  const kit = readKit().size;
  const near = readGlb(NEAR_FILE).size;
  const visitor = files - Math.min(kit, near);
  expect(files).toBeGreaterThan(kit + near);
  expect(visitor).toBeGreaterThan(Math.max(kit, near));
  expect(visitor).toBeLessThan(6 * 1024 * 1024);
});

test('world config with near.glb lists no stone point lights', () => {
  expect(SECURITY_WORLD.near?.url).toBe('/nox/world/security/near.glb');
  // The glyph, lava and fill light are baked into near.glb's lightmaps.
  expect(stoneLights(SECURITY_WORLD)).toEqual({ points: [], fill: null });
  // They stay as data for Nox's accents (Task 3), unchanged (R29).
  const kinds = (kind: string) => SECURITY_WORLD.lights.points.filter(l => l.kind === kind).map(l => [l.intensity, l.distance, l.skinRange]);
  expect(kinds('glyph')).toEqual(Array(4).fill([1.7, 2.1, 4.4]));
  expect(kinds('lava')).toEqual(Array(4).fill([3.4, 5, 6]));
  // Without near.glb the stone keeps its real-time lights, as before the bake.
  const unbaked = stoneLights({ ...SECURITY_WORLD, near: undefined });
  expect(unbaked.points).toBe(SECURITY_WORLD.lights.points);
  expect(unbaked.fill).toBe(SECURITY_WORLD.lights.fill);
});

test('relic emission is 1.15 to 1.25 times the test scene’s', () => {
  const { relics, lights } = SECURITY_WORLD;
  const rises = { glyph: relics.glyph / TEST_SCENE.glyphEmission, coral: relics.coral / TEST_SCENE.coralEmission, spill: relics.spill };
  for (const [name, rise] of Object.entries(rises)) {
    expect(rise, name).toBeGreaterThanOrEqual(1.15);
    expect(rise, name).toBeLessThanOrEqual(1.25);
  }
  // The red spill baked onto the stone is the test scene's glyph light, raised by the spill.
  const baked = readBake();
  expect(baked.spill).toBe(relics.spill);
  expect(baked.lights.glyph.length).toBeGreaterThan(0);
  for (const glyph of baked.lights.glyph) expect(glyph.intensity / TEST_SCENE.glyphLight).toBeCloseTo(relics.spill, 6);
  // Nox's accents keep the test scene's glyph light (R29).
  for (const glyph of lights.points.filter(l => l.kind === 'glyph')) expect(glyph.intensity).toBe(TEST_SCENE.glyphLight);
});

test('near.glb is baked from layout.json and the world’s lights', () => {
  const baked = readBake();
  const { layout, lights } = SECURITY_WORLD;
  // Every placement as layout.json has it, so a layout edit without a new bake fails here.
  for (const group of ['pillars', 'rocks', 'corals'] as const) {
    expect(baked.instances[group].map(i => i.placement), group).toEqual(layout[group]);
  }
  const close = (a: Vec3, b: Vec3, digits: number) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));
  const glyphs = lights.points.filter(l => l.kind === 'glyph');
  expect(baked.lights.glyph).toHaveLength(glyphs.length);
  baked.lights.glyph.forEach((light, i) => {
    // The bake places each glyph light from the kit's glyph_centre (4 decimals), the config from its 2-decimal copy.
    close(light.position, glyphs[i].position, 2);
    expect([light.color, light.distance]).toEqual([glyphs[i].color, glyphs[i].distance]);
  });
  const lava = lights.points.filter(l => l.kind === 'lava');
  expect(baked.lights.lava).toHaveLength(lava.length);
  baked.lights.lava.forEach((light, i) => {
    close(light.position, lava[i].position, 9);
    // The bake lays the lava on the stone and seabed a little stronger than the data Nox's skin takes.
    expect(light.intensity).toBeCloseTo(lava[i].intensity * SECURITY_WORLD.glow.lava, 9);
    expect([light.color, light.distance]).toEqual([lava[i].color, lava[i].distance]);
  });
  expect(baked.lavaRise).toBe(SECURITY_WORLD.glow.lava);
  // A lava light stands behind each front rock heap, low, rimming it red from behind.
  expect(baked.backRise).toBe(SECURITY_WORLD.glow.back);
  expect(baked.lights.back.length).toBeGreaterThanOrEqual(6);
  for (const light of baked.lights.back) {
    expect(light.intensity).toBeCloseTo(lava[0].intensity * SECURITY_WORLD.glow.back, 9);
    expect(light.position[1]).toBeLessThan(layout.floorY + 1);
    expect(light.position[2]).toBeLessThan(layout.rocks.map(r => r.position[2]).reduce((a, b) => Math.max(a, b)));
  }
  expect(baked.lights.fill).toEqual(lights.fill);
  expect(baked.lights.surface).toEqual(lights.surface);
});

test('the baked seabed is the page’s: floorHeight agrees at every sampled point', () => {
  const { seabed } = readBake();
  expect({ width: seabed.width, nearZ: seabed.nearZ, farZ: seabed.farZ, segments: seabed.segments }).toEqual(SEABED);
  expect(seabed.samples.length).toBeGreaterThanOrEqual(64);
  for (const [x, z, y] of seabed.samples) expect(Math.abs(floorHeight(x, z, SECURITY_WORLD.layout.floorY) - y), `${x}, ${z}`).toBeLessThan(1e-9);
});

test('near.glb carries the kit’s pieces, with a lightmap UV set on stone, rock and coral, and KTX2 lightmaps and relief maps', () => {
  const near = readGlb(NEAR_FILE);
  const kit = readKit();
  expect(near.json.extensionsUsed).toEqual(expect.arrayContaining(['EXT_meshopt_compression', 'KHR_texture_basisu']));
  for (const piece of SECURITY_WORLD.kit.pieces) {
    for (const name of [piece, `${piece}_lod1`]) {
      const node = near.byName.get(name);
      expect(node, name).toBeDefined();
      // The same piece as the kit's, at the same detail.
      expect(near.triangles(node!), name).toBe(kit.triangles(kit.byName.get(name)!));
      // The piece's own mesh is on its node, or on an unnamed child when compression keeps the
      // dequantizing transform off the glyph panels (named children, which take no lightmap).
      const own = [node!, ...(node!.children ?? []).map(i => near.json.nodes[i]).filter(n => !n.name)].filter(n => n.mesh !== undefined);
      expect(own, name).toHaveLength(1);
      const uvSets = near.json.meshes[own[0].mesh!].primitives.map(p => 'TEXCOORD_1' in p.attributes);
      expect(uvSets, name).toEqual(uvSets.map(() => piece !== 'chain'));
    }
    if (piece.startsWith('pillar')) expect(near.byName.get(piece)?.extras?.glyph_centre).toBe(kit.byName.get(piece)?.extras?.glyph_centre);
  }
  const { atlases } = readBake();
  for (const name of Object.values(atlases)) {
    const node = near.byName.get(name);
    expect(node, name).toBeDefined();
    const material = near.json.materials[near.json.meshes[node!.mesh!].primitives[0].material!];
    // The lightmap is its emissive map, the relief map beside it its normal map.
    for (const slot of [material.emissiveTexture, material.normalTexture]) {
      const texture = near.json.textures[slot!.index];
      expect(near.json.images[texture.extensions!.KHR_texture_basisu.source].mimeType, name).toBe('image/ktx2');
    }
    expect(material.normalTexture!.index, name).not.toBe(material.emissiveTexture!.index);
  }
  expect(readBake().relief.scale).toBeGreaterThan(0);
});

test('the bake record carries the relief maps\' scale, and a record without it is refused', () => {
  const baked = readBake();
  expect(baked.relief.scale).toBeGreaterThan(0);
  expect(typeof baked.relief.encoding).toBe('string');
  expect(() => asBakeRecord({ ...baked, relief: undefined })).toThrow(/relief/);
  expect(() => asBakeRecord({ ...baked, relief: { scale: 0, encoding: '' } })).toThrow(/relief/);
  // reliefOf hands the shader a relief map and the scale the bake stored its strengths with.
  const map = {} as Parameters<typeof reliefOf>[1];
  expect(reliefOf({ record: baked } as BakedLight, map)).toEqual({ map, scale: baked.relief.scale });
});

test('each placed piece has a lightmap rect of its own inside its atlas, at both levels', () => {
  const { instances } = readBake();
  const all = [...instances.pillars, ...instances.rocks, ...instances.corals];
  for (const level of ['lod0', 'lod1'] as const) {
    const rects: LightRect[] = all.map(i => i[level]);
    for (const [u, v, w, h] of rects) {
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(u + w).toBeLessThanOrEqual(1 + 1e-9);
      expect(v + h).toBeLessThanOrEqual(1 + 1e-9);
    }
    const overlaps = rects.flatMap((a, i) => rects.slice(i + 1).filter(b => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3]));
    expect(overlaps, level).toEqual([]);
  }
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

test('a light of another kind validates: the kind is a name a world chooses', () => {
  const portal: WorldConfig = { ...SECURITY_WORLD, lights: { ...SECURITY_WORLD.lights, points: [...SECURITY_WORLD.lights.points, { ...SECURITY_WORLD.lights.points[0], kind: 'portal' }] } };
  expect(validateWorld(portal)).toEqual([]);
  const nameless: WorldConfig = { ...SECURITY_WORLD, lights: { ...SECURITY_WORLD.lights, points: [{ ...SECURITY_WORLD.lights.points[0], kind: '' }, ...SECURITY_WORLD.lights.points.slice(1)] } };
  expect(validateWorld(nameless).join('\n')).toContain('no kind');
});

test('the world values that moved out of the code are checked: skin accent, caustics, camera hover and post', () => {
  const bad = (change: Partial<WorldConfig>) => validateWorld({ ...SECURITY_WORLD, ...change }).join('\n');
  expect(bad({ skinAccent: 'pink' })).toContain('skinAccent');
  expect(bad({ skinAccent: '#ff8899' })).toBe('');
  expect(bad({ water: { ...SECURITY_WORLD.water, causticStrength: Number.NaN } })).toContain('causticStrength');
  expect(bad({ water: { ...SECURITY_WORLD.water, causticStrength: -1 } })).toContain('causticStrength');
  expect(bad({ camera: { ...SECURITY_WORLD.camera, hover: { amount: 1, pace: Number.POSITIVE_INFINITY } } })).toContain('hover.pace');
  expect(bad({ camera: { ...SECURITY_WORLD.camera, hover: { amount: -1, pace: 1 } } })).toContain('hover.amount');
  expect(bad({ camera: { tilt: Number.NaN, hover: SECURITY_WORLD.camera.hover } })).toContain('camera.tilt');
  const { post } = SECURITY_WORLD;
  expect(bad({ post: { ...post, contactShadow: { ...post.contactShadow, color: 'dark' } } })).toContain('contactShadow.color');
  expect(bad({ post: { ...post, contactShadow: { ...post.contactShadow, near: 20 } } })).toContain('near must be before far');
  expect(bad({ post: { ...post, bloom: { ...post.bloom, intensity: Number.NaN } } })).toContain('post.bloom.intensity');
  expect(bad({ post: { ...post, vignette: { ...post.vignette, darkness: -1 } } })).toContain('post.vignette.darkness');
});
