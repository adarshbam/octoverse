import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { asBakeRecord, type BakedPointLight } from '../../../engine/world/bakedLight';
import { farCardSize } from '../../../engine/world/farPlate';
import { kitMaterialBrightest } from '../../../engine/world/kitMaterials';
import { membraneFlow } from '../../../engine/world/membraneMaterial';
import type { Vec3 } from '../../../engine/world/types';
import { validateWorld } from '../../../engine/world/validateWorld';
import { HOST_BUNDLE, HOST_STAGE_FRAMES } from '../bundle';
import { HOST } from '../character';
import { CORAL_RISE, EMBER_LOCAL, MEMBRANE_LOCAL, PATH_POINTS, REEF_WORLD } from './config';
import farData from './far.json';
import layoutData from './layout.json';

// The reef (platform spec 7.7): the host's world as data. Its kit and layout are Task 4's; this file
// checks the world built on them: the baked near world, the far plate, the membrane, the light and
// the live elements, against the spec's colours and the host's own light (spec 7.2: the reef never
// outshines the host's face glow).

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const PUBLIC = join(ROOT, 'public');
const KIT_DIR = join(PUBLIC, 'octoverse', 'world', 'reef');
const nodeList = JSON.parse(readFileSync(join(KIT_DIR, 'kit.nodes.json'), 'utf8')) as { pieces: string[]; nodes: string[]; attached: { node: string; piece: string }[] };

const HEX = /^#[0-9a-f]{6}$/i;
/** Linear luminance of an sRGB hex colour, as the kit materials measure their brightest value. */
function luminance(hex: string) {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

/** CIE76 delta E between two sRGB hex colours. */
function deltaE(a: string, b: string) {
  const lab = (hex: string) => {
    const lin = rgb(hex).map(v => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const xyz = [
      (0.4124564 * lin[0] + 0.3575761 * lin[1] + 0.1804375 * lin[2]) / 0.95047,
      0.2126729 * lin[0] + 0.7151522 * lin[1] + 0.072175 * lin[2],
      (0.0193339 * lin[0] + 0.119192 * lin[1] + 0.9503041 * lin[2]) / 1.08883,
    ].map(t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116));
    return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
  };
  const [p, q] = [lab(a), lab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/** The bake record in near.glb's scene extras. */
function readBake() {
  const glb = readFileSync(join(PUBLIC, REEF_WORLD.near!.url));
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { scenes: { extras?: Record<string, unknown> }[] };
  const record = asBakeRecord(json.scenes[0].extras?.nox_bake);
  return record as typeof record & { lights: Record<'membrane' | 'ember' | 'coral' | 'magenta' | 'path', BakedPointLight[]> };
}

/** A kit.glb material's emissive colour (linear, times its strength), by the node that carries it. */
function kitEmissive(node: string) {
  const glb = readFileSync(join(PUBLIC, REEF_WORLD.kit.url));
  const doc = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as {
    nodes: { name?: string; mesh?: number }[];
    meshes: { primitives: { material?: number }[] }[];
    materials: { emissiveFactor?: number[]; extensions?: { KHR_materials_emissive_strength?: { emissiveStrength: number } } }[];
  };
  const found = doc.nodes.find(n => n.name === node);
  const material = doc.materials[doc.meshes[found!.mesh!].primitives[0].material!];
  const strength = material.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1;
  const [r, g, b] = (material.emissiveFactor ?? [0, 0, 0]).map(v => v * strength);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test('the reef world validates', () => {
  expect(validateWorld(REEF_WORLD)).toEqual([]);
});

test('the host bundle draws the reef, with its post-processing', () => {
  expect(HOST_BUNDLE.place).toBe(REEF_WORLD);
  const { post } = HOST_BUNDLE.place;
  expect(post).toBeDefined();
  expect(Object.keys(post).sort()).toEqual(['bloom', 'contactShadow', 'vignette']);
});

test('the kit is Task 4\'s file and node list: the gate\'s parts attached to the arch', () => {
  expect(REEF_WORLD.kit.url).toBe('/octoverse/world/reef/kit.glb');
  expect([...REEF_WORLD.kit.pieces]).toEqual(nodeList.pieces);
  expect([...(REEF_WORLD.kit.nodes ?? [])]).toEqual(nodeList.nodes);
  expect([...(REEF_WORLD.kit.attached ?? [])]).toEqual(nodeList.attached);
  expect(REEF_WORLD.layout).toEqual(layoutData);
});

test('no hex literal outside the palette: every light and kit material colour is a palette colour', () => {
  const palette = new Set(Object.entries(REEF_WORLD.palette).flatMap(([name, v]) => (name === 'floorGlow' ? [] : [String(v).toLowerCase()])));
  // The schema's own colour tables: the palette, the water, the live elements' colours, post and the two water lights.
  const ownTables = /^(palette|water\.(colours|environment)|live\.(colours|elements)|post)\.|^lights\.(surface|fill)\.color$/;
  const strays: string[] = [];
  const walk = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      if (HEX.test(value) && !ownTables.test(path) && !palette.has(value.toLowerCase())) strays.push(`${path} ${value}`);
    } else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(REEF_WORLD, '');
  expect(strays).toEqual([]);
});

test('the floor is the shared sand, its path glowing warm violet-orange (#a97896)', () => {
  expect(REEF_WORLD.floor?.material).toBe('sand');
  expect(REEF_WORLD.palette.path).toBe('#a97896');
  const path = REEF_WORLD.lights.points.filter(l => l.kind === 'path');
  expect(path.length).toBe(PATH_POINTS.length);
  for (const light of path) expect(light.color).toBe('#a97896');
});

test('the water: deep indigo (P1 mid water #011236 below the horizon), the fog and horizon indigo, not black, brightening to cyan-blue toward the surface', () => {
  expect(REEF_WORLD.water.colours.deep).toBe('#011236');
  // The fog and horizon: the brief's #021648 (2, 22, 72) read P2's mid water at delta E 12.9 on the
  // rendered intro (Task 3: 8.6), so the fog keeps Task 3's P2-fitted indigo; the water just outside
  // the head still reads (2, 22, 72) within delta E 10 (task-5-report.md).
  expect(deltaE(REEF_WORLD.palette.waterFar, '#021648')).toBeLessThanOrEqual(20); // 15.9: a lighter neighbour, not another hue
  const [r, , b] = rgb(REEF_WORLD.palette.waterFar);
  expect(b - r).toBeGreaterThanOrEqual(55);
  // The surface glow: the brief's #1081db (P2's upper water sample itself) rendered the sample at
  // delta E 17.4 (Task 3: 11.0), so the glow keeps Task 3's brighter cyan-blue, within reach of it.
  expect(deltaE(REEF_WORLD.water.colours.glow, '#1081db')).toBeLessThanOrEqual(20);
  expect(luminance(REEF_WORLD.palette.waterFar)).toBeLessThan(luminance(REEF_WORLD.water.colours.glow));
});

test('the camera drifts between Veyra\'s and Nox\'s pace (0.85)', () => {
  expect(REEF_WORLD.camera.hover.pace).toBe(0.85);
});

test('the gateway\'s membrane is the shared membrane in violet-blue, near P1\'s (117, 56, 252), and flows within [0, 1]', () => {
  const membrane = REEF_WORLD.materials!.find(m => m.node === 'gate_membrane');
  expect(membrane?.material).toBe('membrane');
  const { color, flowSpeed } = membrane!.params as { color: string; edge: string; flowSpeed: number };
  const [r, g, b] = rgb(color);
  expect(b).toBeGreaterThan(r);
  expect(r).toBeGreaterThan(g);
  expect(deltaE(color, '#7538fc')).toBeLessThanOrEqual(25);
  for (let t = 0; t < 600; t += 0.73) {
    const f = membraneFlow(t, flowSpeed);
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThanOrEqual(1);
  }
});

test('the glass cards draw with their own material, not as stone', () => {
  const cards = nodeList.pieces.filter(p => p.startsWith('card_glass_'));
  expect(cards.length).toBeGreaterThanOrEqual(6);
  for (const card of cards) expect(REEF_WORLD.materials!.find(m => m.node === card)?.material, card).toBe('glow');
});

test('magenta and orange corals differ: the magenta ones glow magenta, the orange ones keep the palette\'s orange coral', () => {
  const magenta = nodeList.pieces.filter(p => p.startsWith('coral_magenta_'));
  const orange = nodeList.pieces.filter(p => p.startsWith('coral_orange_'));
  expect(magenta.length).toBeGreaterThan(0);
  for (const piece of orange) expect(REEF_WORLD.materials!.find(m => m.node === piece), piece).toBeUndefined();
  for (const piece of magenta) {
    const m = REEF_WORLD.materials!.find(a => a.node === piece);
    expect(m?.material, piece).toBe('glow');
    const colour = (m!.params as { color: string }).color;
    const [r, g, b] = rgb(colour);
    expect(r).toBeGreaterThan(g + 80);
    expect(b).toBeGreaterThan(g + 40);
    expect(deltaE(colour, REEF_WORLD.palette.coral)).toBeGreaterThan(30);
  }
  // An assigned coral leaves the coral dressing and its drop onto the seabed or a boulder: the layout gives
  // it the height it rests at (bake_world.py --rests prints them), the bake's record agrees within a hair.
  const baked = readBake().instances.corals;
  (REEF_WORLD.layout.groups.corals ?? []).forEach((p, i) => {
    if (!p.piece.startsWith('coral_magenta_')) return;
    expect(baked[i].matrix[13], `${p.piece} at ${p.position[0]}, ${p.position[2]}`).toBeCloseTo(p.position[1], 3);
  });
});

test("relic rule: every kit light of the reef is below the host's face glow (spec 7.7)", () => {
  const core = luminance(HOST.glow.core);
  for (const m of REEF_WORLD.materials ?? []) expect(kitMaterialBrightest(m), m.node).toBeLessThan(core);
  // The glyph keeps the kit file's own emissive material (the 'emissive' drive raises it in the entrance, Task 12): at rest it is below the face too.
  expect(REEF_WORLD.materials!.find(m => m.node === 'gate_glyph')).toBeUndefined();
  expect(kitEmissive('gate_glyph')).toBeLessThan(core);
  // Every point light below the face glow's colour, and the relics at most their data.
  for (const light of REEF_WORLD.lights.points) expect(luminance(light.color) * Math.min(light.intensity, 1), light.kind).toBeLessThan(core);
});

test('live elements: bubbles and violet motes; no embers', () => {
  expect(REEF_WORLD.live.bubbles).toBeGreaterThan(0);
  expect(REEF_WORLD.live.motes).toBeGreaterThan(0);
  expect(REEF_WORLD.live.embers).toBe(0);
  const [r, g, b] = rgb(REEF_WORLD.live.colours.motes.color);
  expect(b).toBeGreaterThan(g);
  expect(r).toBeGreaterThan(g);
});

test.skip('three to five jellyfish at the edges, at least two at tier low', () => {
  // TODO(Aether Task 7: jellyfish): the `jellyfish` live element is not in the engine yet (ruling R14).
  // Declare live.elements.jellyfish (count high 5, low 2, orange and violet) and replace this with:
  //   const jelly = REEF_WORLD.live.elements!.jellyfish!;
  //   expect(jelly.count.high).toBe(5);
  //   expect(jelly.count.low).toBeGreaterThanOrEqual(2);
});

test("near.glb is baked from layout.json and the world's lights", () => {
  const baked = readBake();
  const { layout, lights, relics } = REEF_WORLD;
  expect(Object.keys(baked.instances).sort()).toEqual(Object.keys(layout.groups).sort());
  for (const [group, list] of Object.entries(layout.groups)) expect(baked.instances[group].map(i => i.placement), group).toEqual(list);
  expect([baked.lights.glyph, baked.lights.lava, baked.lights.back]).toEqual([[], [], []]);
  expect(baked.spill).toBe(relics.spill);
  expect(baked.settings).toMatchObject({ membraneLocal: MEMBRANE_LOCAL, emberLocal: EMBER_LOCAL, coralRise: CORAL_RISE, pathPoints: PATH_POINTS });
  const close = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 4));
  const pairs = [['membrane', relics.spill], ['ember', 1], ['coral', 1], ['magenta', 1], ['path', 1]] as const;
  for (const [kind, rise] of pairs) {
    const config = lights.points.filter(l => l.kind === kind);
    expect(baked.lights[kind], kind).toHaveLength(config.length);
    baked.lights[kind].forEach((light, i) => {
      close(light.position, config[i].position);
      expect(light.intensity).toBeCloseTo(config[i].intensity * rise, 9);
      expect([light.color, light.distance]).toEqual([config[i].color, config[i].distance]);
    });
  }
  expect(baked.lights.fill).toEqual(lights.fill);
  expect(baked.lights.surface).toEqual(lights.surface);
});

test("the far plate: its cards sized for the host's intro frame, its fog the world's, its layers KTX2 files within budget", () => {
  expect(REEF_WORLD.farPlate!.cutZ).toBe(farData.cutZ);
  expect(farData.fog).toEqual({ color: REEF_WORLD.palette.waterFar, density: REEF_WORLD.water.fogDensity });
  let bytes = 0;
  farData.layers.forEach((layer, i) => {
    const size = farCardSize(layer.z, HOST_STAGE_FRAMES.intro);
    expect(layer.width, `layer ${i}`).toBeCloseTo(size.width, 2);
    expect(layer.height, `layer ${i}`).toBeCloseTo(size.height, 2);
    expect(layer.pixels.map(p => p % 4)).toEqual([0, 0]);
    expect(Math.abs(layer.pixels[1] - (layer.pixels[0] * layer.height) / layer.width)).toBeLessThanOrEqual(4);
    const { url, z } = REEF_WORLD.farPlate!.layers[i];
    expect(z).toBe(layer.z);
    const data = readFileSync(join(PUBLIC, url));
    expect(data.subarray(1, 7).toString('latin1'), url).toBe('KTX 20');
    bytes += data.length;
  });
  expect(farData.layers.map(l => l.z)).toEqual([...farData.layers.map(l => l.z)].sort((a, b) => a - b));
  expect(farData.layers[farData.layers.length - 1].near).toBe(farData.cutZ);
  for (let i = 1; i < farData.layers.length; i++) expect(farData.layers[i].far).toBe(farData.layers[i - 1].near);
  expect(bytes).toBeLessThan(1.2 * 1024 * 1024);
});

test('what a visitor downloads for the reef fits the 6 MB budget', () => {
  const folder = (dir: string): number =>
    readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => sum + (e.isDirectory() ? folder(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
  const kit = statSync(join(PUBLIC, REEF_WORLD.kit.url)).size;
  const near = statSync(join(PUBLIC, REEF_WORLD.near!.url)).size;
  const visitor = folder(KIT_DIR) + folder(join(PUBLIC, 'nox', 'basis')) - Math.min(kit, near);
  expect(visitor).toBeLessThan(6 * 1024 * 1024);
});
