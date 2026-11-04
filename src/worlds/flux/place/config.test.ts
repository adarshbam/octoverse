import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { asBakeRecord, type BakedPointLight } from '../../../engine/world/bakedLight';
import { farCardSize } from '../../../engine/world/farPlate';
import { kitMaterialBrightest } from '../../../engine/world/kitMaterials';
import type { Vec3, WorldLight } from '../../../engine/world/types';
import { validateWorld } from '../../../engine/world/validateWorld';
import { FLUX_BUNDLE, FLUX_STAGE_FRAMES } from '../bundle';
import { FLUX } from '../character';
import { PIPELINE_WORLD, PORTAL_LOCAL, RING_LOCAL } from './config';
import farData from './far.json';
import { INLAY_NODES, LED_COLOURS, LED_NODES } from './kit';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const PUBLIC = join(ROOT, 'public');

/** Linear luminance of an sRGB hex colour, as the kit materials measure their brightest value. */
function luminance(hex: string) {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}
const linearLuminance = ([r, g, b]: readonly number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function readBake() {
  const glb = readFileSync(join(PUBLIC, PIPELINE_WORLD.near!.url));
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { scenes: { extras?: Record<string, unknown> }[] };
  const record = asBakeRecord(json.scenes[0].extras?.nox_bake);
  // The pipeline's own lights, beside the engine's lists (which stay empty: no glyphs, no lava).
  return record as typeof record & { lights: Record<'portal' | 'ring', BakedPointLight[]> };
}

const materialOf = (node: string) => (PIPELINE_WORLD.materials ?? []).find(m => m.node === node);

test('the pipeline world validates, and it is the bundle\'s place', () => {
  expect(validateWorld(PIPELINE_WORLD)).toEqual([]);
  expect(FLUX_BUNDLE.place).toBe(PIPELINE_WORLD);
  expect(PIPELINE_WORLD.floor).toEqual({ material: 'sand' });
});

test('no red light: no light\'s red is above both its green and its blue (spec 7.7), and the skin accent is a cool blue', () => {
  const { surface, fill, points } = PIPELINE_WORLD.lights;
  const lights: Pick<WorldLight, 'kind' | 'color'>[] = [{ kind: 'surface', ...surface }, { kind: 'fill', ...fill }, ...points];
  expect(points.length).toBeGreaterThan(0);
  for (const light of lights) {
    const c = new THREE.Color(light.color);
    expect(c.r > c.g && c.r > c.b, `${light.kind} ${light.color} is red`).toBe(false);
  }
  expect(PIPELINE_WORLD.skinAccent).toMatch(/^color\(srgb-linear 0\.\d+ 0\.\d+ 0\.\d+\)$/);
  const [r, g, b] = PIPELINE_WORLD.skinAccent.slice('color(srgb-linear '.length, -1).split(' ').map(Number);
  expect(b).toBeGreaterThan(g);
  expect(g).toBeGreaterThan(r);
  // The surface spot comes from the upper right, with caustics on the skin.
  expect(surface.position[0]).toBeGreaterThan(surface.target[0]);
  expect(surface.position[1]).toBeGreaterThan(10);
  expect(PIPELINE_WORLD.water.causticStrength).toBeGreaterThan(0);
});

test('the LEDs blink on the four LED nodes, rate 0.4 to 2.5, duty 0.6, their brightest below the cup glow (spec 7.7)', () => {
  const leds = (PIPELINE_WORLD.materials ?? []).filter(m => m.material === 'led');
  expect(leds.map(m => m.node).sort()).toEqual([...LED_NODES].sort());
  // The kit script's colours, as kit.ts has them.
  const script = readFileSync(join(ROOT, 'blender/pipeline/build_kit.py'), 'utf8');
  for (const [name, rgb] of Object.entries(LED_COLOURS)) {
    const found = script.match(new RegExp(`"${name}": \\(([^)]*)\\)`));
    expect(found, name).not.toBeNull();
    expect(found![1].split(',').slice(0, 3).map(Number), name).toEqual([...rgb]);
  }
  const brightestColour = Math.max(...Object.values(LED_COLOURS).map(linearLuminance));
  const cupGlow = luminance(FLUX.suckers.style!.edge);
  for (const m of leds) {
    if (m.material !== 'led') continue;
    expect(m.params.rate).toEqual([0.4, 2.5]);
    expect(m.params.duty).toBe(0.6);
    expect(m.params.intensity * brightestColour, m.node).toBeLessThan(cupGlow);
    expect(kitMaterialBrightest(m) * brightestColour).toBeLessThan(cupGlow);
  }
});

test("the portal disc's brightest emissive value is below his face core's (the relic rule), and so is every kit material's", () => {
  const core = luminance(FLUX.glow.core);
  const disc = materialOf('portal_disc');
  expect(disc?.material).toBe('membrane');
  expect(kitMaterialBrightest(disc!)).toBeLessThan(core);
  // The arcs' inlays light one by one (a sequence's emissive drive, capped by the membrane's flash).
  for (const node of INLAY_NODES) expect(materialOf(node)?.material, node).toBe('membrane');
  for (const m of PIPELINE_WORLD.materials ?? []) if (m.material !== 'led') expect(kitMaterialBrightest(m), m.node).toBeLessThan(core);
});

test('the portal\'s props a sequence will drive validate: the arc inlays and the disc take an emissive drive', () => {
  const props = [
    ...INLAY_NODES.map((node, i) => ({ id: `portalArc${i + 1}`, node, drive: 'emissive' as const })),
    { id: 'portalDisc', node: 'portal_disc', drive: 'emissive' as const },
  ];
  expect(validateWorld({ ...PIPELINE_WORLD, props })).toEqual([]);
});

test('packets run along paths.bridge in cyan and lavender, at most 12, never below 4', () => {
  const packets = PIPELINE_WORLD.live.elements?.packets;
  expect(packets?.path).toBe('bridge');
  expect(PIPELINE_WORLD.layout.paths?.bridge?.length).toBeGreaterThanOrEqual(2);
  expect(packets!.count.high).toBeLessThanOrEqual(12);
  expect(packets!.count.low).toBeGreaterThanOrEqual(4);
  const [cyan, lavender] = packets!.colours.map(c => new THREE.Color(c).getHSL({ h: 0, s: 0, l: 0 }));
  expect(cyan.h * 360).toBeGreaterThan(170);
  expect(cyan.h * 360).toBeLessThan(200);
  expect(lavender.h * 360).toBeGreaterThan(240);
  expect(lavender.h * 360).toBeLessThan(280);
});

test('the live elements: blue-violet bubbles, fish (the tiers drop them at low), rays, no embers, no motes (glyph motes dropped, spec 12.6)', () => {
  const { live } = PIPELINE_WORLD;
  expect(live).toMatchObject({ bubbles: 1, fish: 1, rays: 1, embers: 0, motes: 0 });
  const tint = new THREE.Color(live.colours.bubbles.tint).getHSL({ h: 0, s: 0, l: 0 });
  expect(tint.h * 360).toBeGreaterThan(220);
  expect(tint.h * 360).toBeLessThan(270);
});

test('near.glb is baked from layout.json and the world\'s lights', () => {
  const baked = readBake();
  const { layout, lights, relics } = PIPELINE_WORLD;
  // Every placement of every group, as layout.json has it: a layout edit without a new bake fails here.
  expect(Object.keys(baked.instances).sort()).toEqual(Object.keys(layout.groups).sort());
  for (const [group, list] of Object.entries(layout.groups)) expect(baked.instances[group].map(i => i.placement), group).toEqual(list);
  // No glyphs, no lava, nothing behind the rocks.
  expect([baked.lights.glyph, baked.lights.lava, baked.lights.back]).toEqual([[], [], []]);
  expect([baked.lavaRise, baked.backRise]).toEqual([0, 0]);
  expect(baked.spill).toBe(relics.spill);
  expect(baked.settings).toMatchObject({ portalLocal: PORTAL_LOCAL, ringLocal: RING_LOCAL });
  // The LEDs' spill is baked from the LED params the page blinks them with (their mean level).
  const led = materialOf(LED_NODES[0]);
  expect(led?.material).toBe('led');
  if (led?.material === 'led') expect(baked.settings).toMatchObject({ led: { intensity: led.params.intensity, duty: led.params.duty } });
  const close = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 4));
  const pairs = [['portal', 'portal', relics.spill], ['ring', 'ring', 1]] as const;
  for (const [recorded, kind, rise] of pairs) {
    const config = lights.points.filter(l => l.kind === kind);
    expect(config.length, kind).toBeGreaterThan(0);
    expect(baked.lights[recorded], recorded).toHaveLength(config.length);
    baked.lights[recorded].forEach((light, i) => {
      close(light.position, config[i].position);
      expect(light.intensity).toBeCloseTo(config[i].intensity * rise, 9);
      expect([light.color, light.distance]).toEqual([config[i].color, config[i].distance]);
    });
  }
  expect(lights.points.every(l => l.kind === 'portal' || l.kind === 'ring')).toBe(true);
  expect(baked.lights.fill).toEqual(lights.fill);
  expect(baked.lights.surface).toEqual(lights.surface);
});

test('the far plate: its cards sized for his intro frame, its fog the world\'s, its layers KTX2 files within budget', () => {
  expect(PIPELINE_WORLD.farPlate!.cutZ).toBe(farData.cutZ);
  expect(farData.fog).toEqual({ color: PIPELINE_WORLD.palette.waterFar, density: PIPELINE_WORLD.water.fogDensity });
  expect(farData.layers.length).toBeGreaterThanOrEqual(2);
  expect(farData.layers.length).toBeLessThanOrEqual(3);
  let bytes = 0;
  farData.layers.forEach((layer, i) => {
    const size = farCardSize(layer.z, FLUX_STAGE_FRAMES.intro);
    expect(layer.width, `layer ${i}`).toBeCloseTo(size.width, 2);
    expect(layer.height, `layer ${i}`).toBeCloseTo(size.height, 2);
    // Pixel sides are multiples of 4 (block compression), and the image keeps the card's shape within a pixel.
    expect(layer.pixels.map(p => p % 4)).toEqual([0, 0]);
    expect(Math.abs(layer.pixels[1] - (layer.pixels[0] * layer.height) / layer.width)).toBeLessThanOrEqual(4);
    const { url, z } = PIPELINE_WORLD.farPlate!.layers[i];
    expect(z).toBe(layer.z);
    const data = readFileSync(join(PUBLIC, url));
    expect(data.subarray(1, 7).toString('latin1'), url).toBe('KTX 20');
    bytes += data.length;
  });
  // Farthest first, each layer's range ending where the next begins, the nearest at the cut.
  expect(farData.layers.map(l => l.z)).toEqual([...farData.layers.map(l => l.z)].sort((a, b) => a - b));
  expect(farData.layers[farData.layers.length - 1].near).toBe(farData.cutZ);
  for (let i = 1; i < farData.layers.length; i++) expect(farData.layers[i].far).toBe(farData.layers[i - 1].near);
  expect(bytes).toBeLessThan(1.2 * 1024 * 1024);
});

test('what a visitor downloads for the pipeline world fits the 6 MB budget', () => {
  // As Nox's (R35): the page loads near.glb or kit.glb, never both; the far plate and the transcoder come with either.
  const folder = (dir: string): number =>
    readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => sum + (e.isDirectory() ? folder(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
  const kit = statSync(join(PUBLIC, PIPELINE_WORLD.kit.url)).size;
  const near = statSync(join(PUBLIC, PIPELINE_WORLD.near!.url)).size;
  // stage.glb (Task 2's empty backdrop) stays in the folder for the stage-only config; a visitor never loads it.
  const stage = statSync(join(PUBLIC, 'flux', 'world', 'stage.glb')).size;
  const visitor = folder(join(PUBLIC, 'flux', 'world')) + folder(join(PUBLIC, 'nox', 'basis')) - Math.min(kit, near) - stage;
  expect(visitor).toBeLessThan(6 * 1024 * 1024);
});
