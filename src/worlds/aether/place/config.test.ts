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
import { AETHER_STAGE_FRAMES } from '../bundle';
import { AMBER_CORALS, CORAL_RISE, MANTA_SILHOUETTE, MEMBRANE_COLOR, OBSERVATORY_STAGE, OBSERVATORY_WORLD, PORTAL_LOCAL, WINDOW_GLOW } from './config';
import farData from './far.json';
import { OBSERVATORY_PATH, RUBBLE_PIECES, WINDOWED_PIECES } from './kit';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const PUBLIC = join(ROOT, 'public');

/** Her face glow's pink-white core (character.ts mantle jelly `core`; spec 7.7's face glow 253, 212, 232). */
const FACE_GLOW = '#fdd4e8';

/** Linear luminance of an sRGB hex colour, as the kit materials measure their brightest value. */
function luminance(hex: string) {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/** Red, as spec 7.7 forbids it: a hue within 20 degrees of red at a saturation (HSV) above 0.5. */
function isRed(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0 || (max - min) / max <= 0.5) return false;
  let hue = max === r ? ((g - b) / (max - min)) * 60 : max === g ? 120 + ((b - r) / (max - min)) * 60 : 240 + ((r - g) / (max - min)) * 60;
  if (hue < 0) hue += 360;
  return hue <= 20 || hue >= 340;
}

type ObservatoryLights = Record<'portal' | 'window' | 'lantern' | 'coral' | 'amberCoral' | 'path', BakedPointLight[]>;

function readBake() {
  const glb = readFileSync(join(PUBLIC, OBSERVATORY_WORLD.near!.url));
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { scenes: { extras?: Record<string, unknown> }[] };
  const record = asBakeRecord(json.scenes[0].extras?.nox_bake);
  // The observatory's own lights, beside the engine's lists (which stay empty: no glyph panels, no lava).
  return record as typeof record & { lights: ObservatoryLights };
}

test('the observatory world and the stage backdrop validate', () => {
  expect(validateWorld(OBSERVATORY_WORLD)).toEqual([]);
  expect(validateWorld(OBSERVATORY_STAGE)).toEqual([]);
});

test('no red: no light, palette or kit material colour within 20 degrees of red at a saturation above 0.5 (spec 7.7)', () => {
  const { surface, fill, points } = OBSERVATORY_WORLD.lights;
  const colours: [string, string][] = [
    ['surface', surface.color],
    ['fill', fill.color],
    ...points.map(l => [l.kind, l.color] as [string, string]),
    ...Object.entries(OBSERVATORY_WORLD.palette).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v] as [string, string]] : Object.entries(v).map(([g, c]) => [`floorGlow.${g}`, c] as [string, string]))),
    ...(OBSERVATORY_WORLD.materials ?? []).flatMap(m => Object.entries(m.params).filter(([, v]) => typeof v === 'string').map(([k, v]) => [`${m.node}.${k}`, v as string] as [string, string])),
  ];
  expect(points.length).toBeGreaterThan(0);
  for (const [name, colour] of colours) expect(isRed(colour), `${name} ${colour}`).toBe(false);
  // And every light the bake lays on the stone.
  for (const [kind, value] of Object.entries(readBake().lights)) {
    const list = (Array.isArray(value) ? value : [value]) as { color: string }[];
    for (const light of list) expect(isRed(light.color), `baked ${kind} ${light.color}`).toBe(false);
  }
});

test('the membrane: deep blue (P1), a cyan edge, and a flow within [0, 1] that holds while the world is still', () => {
  const membrane = OBSERVATORY_WORLD.materials!.find(m => m.node === 'portal_membrane');
  expect(membrane?.material).toBe('membrane');
  const params = membrane!.params as { color: string; edge: string; flowSpeed: number; flowScale: number; flash: number };
  // Deep blue (config.ts MEMBRANE_COLOR: P1's #0f38a7 raised for the engine's 0.32 body level and the fog).
  expect(params.color).toBe(MEMBRANE_COLOR);
  const body = new THREE.Color(params.color);
  expect(body.b).toBeGreaterThan(body.g);
  expect(body.g).toBeGreaterThan(body.r);
  const edge = new THREE.Color(params.edge);
  expect(edge.b).toBeGreaterThan(edge.r);
  expect(edge.g).toBeGreaterThan(edge.r);
  for (let t = 0; t < 600; t += 0.73) {
    const f = membraneFlow(t, params.flowSpeed);
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThanOrEqual(1);
  }
  expect(membraneFlow(1e9, params.flowSpeed)).toBeLessThanOrEqual(1);
});

test("every kit material's brightest emissive value is below her face glow's (spec 7.7's relic rule)", () => {
  const core = luminance(FACE_GLOW);
  const nodes = (OBSERVATORY_WORLD.materials ?? []).map(m => m.node).sort();
  expect(nodes).toEqual(['portal_glyph', 'portal_lanterns', 'portal_membrane', ...WINDOWED_PIECES.map(p => `${p}_windows`), ...AMBER_CORALS].sort());
  for (const m of OBSERVATORY_WORLD.materials ?? []) expect(kitMaterialBrightest(m), m.node).toBeLessThan(core);
});

test('the glyph pulses once every 6 to 9 s (spec 7.7), from its glow; nothing drives an emissive prop it would fight', () => {
  const glyph = OBSERVATORY_WORLD.materials!.find(m => m.node === 'portal_glyph');
  expect(glyph?.material).toBe('glow');
  const { period, pulse } = glyph!.params as { period: number; pulse: number };
  expect(period).toBeGreaterThanOrEqual(6);
  expect(period).toBeLessThanOrEqual(9);
  expect(pulse).toBeGreaterThan(0.3);
  expect((OBSERVATORY_WORLD.props ?? []).filter(p => p.drive === 'emissive')).toEqual([]);
  // Every rubble fragment bobs.
  expect((OBSERVATORY_WORLD.props ?? []).filter(p => p.drive === 'bob').map(p => p.node).sort()).toEqual([...RUBBLE_PIECES].sort());
});

test('the live elements: jellyfish 10, 7 and 4 by tier, the manta fish, star motes, bubbles, no embers; a sand floor', () => {
  const { live, floor, palette } = OBSERVATORY_WORLD;
  expect(live.elements?.jellyfish?.count).toEqual({ high: 10, medium: 7, low: 4 });
  expect([live.fish, live.motes, live.embers]).toEqual([1, 1, 0]);
  expect(live.bubbles).toBeGreaterThan(0);
  expect(live.fishSilhouette).toBe(MANTA_SILHOUETTE);
  expect(MANTA_SILHOUETTE.length).toBeLessThanOrEqual(24);
  for (const [x, y] of MANTA_SILHOUETTE) {
    expect(Math.abs(x)).toBeLessThanOrEqual(1);
    expect(Math.abs(y)).toBeLessThanOrEqual(1);
  }
  // Nose first: its frontmost point is on +x.
  expect(Math.max(...MANTA_SILHOUETTE.map(p => p[0]))).toBe(1);
  expect(floor?.material).toBe('sand');
  expect(typeof palette.sand).toBe('string');
  expect(typeof palette.rock).toBe('string');
});

test("near.glb is baked from layout.json and the world's lights", () => {
  const baked = readBake();
  const { layout, lights, relics } = OBSERVATORY_WORLD;
  // Every placement of every group, as layout.json has it: a layout edit without a new bake fails here.
  expect(Object.keys(baked.instances).sort()).toEqual(Object.keys(layout.groups).sort());
  for (const [group, list] of Object.entries(layout.groups)) expect(baked.instances[group].map(i => i.placement), group).toEqual(list);
  expect([baked.lights.glyph, baked.lights.lava, baked.lights.back]).toEqual([[], [], []]);
  expect([baked.lavaRise, baked.backRise]).toEqual([0, 0]);
  expect(baked.spill).toBe(relics.spill);
  expect(baked.settings).toMatchObject({ portalLocal: PORTAL_LOCAL, coralRise: CORAL_RISE, path: OBSERVATORY_PATH.map(([x, z]) => [x, z]) });
  const close = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 4));
  for (const [kind, rise] of [['portal', relics.spill], ['coral', 1]] as const) {
    const config = lights.points.filter(l => l.kind === kind);
    expect(baked.lights[kind], kind).toHaveLength(config.length);
    baked.lights[kind].forEach((light, i) => {
      close(light.position, config[i].position);
      expect(light.intensity).toBeCloseTo(config[i].intensity * rise, 9);
      expect([light.color, light.distance]).toEqual([config[i].color, config[i].distance]);
    });
  }
  // The warm light the bake adds: from every window face, every lantern bead, each small amber coral, and the faint path.
  expect(baked.lights.window.length).toBeGreaterThan(0);
  expect(baked.lights.lantern.length).toBeGreaterThan(0);
  expect(baked.lights.path.length).toBeGreaterThan(0);
  for (const light of baked.lights.window) expect(light.color).toBe(WINDOW_GLOW.color);
  // Each small amber coral rests where the bake found its rest (layout.json's y), its light just above.
  const amber = layout.groups.corals.filter(p => p.piece.startsWith('coral_amber_'));
  expect(baked.lights.amberCoral).toHaveLength(amber.length);
  amber.forEach((p, i) => {
    const rise = (baked.settings as { amberCoralRise: number }).amberCoralRise;
    expect(baked.lights.amberCoral[i].position[1] - rise).toBeCloseTo(p.position[1], 3);
  });
  expect(baked.lights.fill).toEqual(lights.fill);
  expect(baked.lights.surface).toEqual(lights.surface);
});

test("the far plate: cut past the farthest rubble, its cards sized for her intro frame, its fog the world's, its layers KTX2 within budget", () => {
  expect(OBSERVATORY_WORLD.farPlate!.cutZ).toBe(farData.cutZ);
  // Every floating fragment the layout places stays in the near world (and bobs).
  for (const p of OBSERVATORY_WORLD.layout.groups.rubble ?? []) expect(p.position[2], p.piece).toBeGreaterThan(farData.cutZ);
  expect(farData.fog).toEqual({ color: OBSERVATORY_WORLD.palette.waterFar, density: OBSERVATORY_WORLD.water.fogDensity });
  let bytes = 0;
  farData.layers.forEach((layer, i) => {
    const size = farCardSize(layer.z, AETHER_STAGE_FRAMES.intro);
    expect(layer.width, `layer ${i}`).toBeCloseTo(size.width, 2);
    expect(layer.height, `layer ${i}`).toBeCloseTo(size.height, 2);
    expect(layer.pixels.map(p => p % 4)).toEqual([0, 0]);
    expect(Math.abs(layer.pixels[1] - (layer.pixels[0] * layer.height) / layer.width)).toBeLessThanOrEqual(4);
    const { url, z } = OBSERVATORY_WORLD.farPlate!.layers[i];
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

test('what a visitor downloads for the observatory fits the 6 MB budget', () => {
  const folder = (dir: string): number =>
    readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => sum + (e.isDirectory() ? folder(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
  const kit = statSync(join(PUBLIC, OBSERVATORY_WORLD.kit.url)).size;
  const near = statSync(join(PUBLIC, OBSERVATORY_WORLD.near!.url)).size;
  const visitor = folder(join(PUBLIC, 'aether', 'world')) + folder(join(PUBLIC, 'nox', 'basis')) - Math.min(kit, near);
  expect(visitor).toBeLessThan(6 * 1024 * 1024);
});
