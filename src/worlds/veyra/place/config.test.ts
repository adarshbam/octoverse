import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { asBakeRecord, type BakedPointLight } from '../../../engine/world/bakedLight';
import { farCardSize } from '../../../engine/world/farPlate';
import { kitMaterialBrightest } from '../../../engine/world/kitMaterials';
import { membraneFlow } from '../../../engine/world/membraneMaterial';
import type { Vec3, WorldLight } from '../../../engine/world/types';
import { validateWorld } from '../../../engine/world/validateWorld';
import { VEYRA_STAGE_FRAMES } from '../bundle';
import { VEYRA } from '../character';
import { CORAL_RISE, PLANT_RISE, PORTAL_LOCAL, VAULT_WORLD } from './config';
import farData from './far.json';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const PUBLIC = join(ROOT, 'public');

/** Linear luminance of an sRGB hex colour, as the kit materials measure their brightest value. */
function luminance(hex: string) {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

function readBake() {
  const glb = readFileSync(join(PUBLIC, VAULT_WORLD.near!.url));
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { scenes: { extras?: Record<string, unknown> }[] };
  const record = asBakeRecord(json.scenes[0].extras?.nox_bake);
  // The vault's own lights, beside the engine's lists (which stay empty: no glyphs, no lava).
  return record as typeof record & { lights: Record<'portal' | 'plant' | 'coral', BakedPointLight[]> };
}

test('the vault world validates', () => {
  expect(validateWorld(VAULT_WORLD)).toEqual([]);
});

test('no red light: each light\'s red is below its green and its blue, but the corals\' faint orange (intensity at most 0.4)', () => {
  const { surface, fill, points } = VAULT_WORLD.lights;
  const lights: Pick<WorldLight, 'kind' | 'color' | 'intensity'>[] = [{ kind: 'surface', ...surface }, { kind: 'fill', ...fill }, ...points];
  expect(points.length).toBeGreaterThan(0);
  for (const light of lights) {
    const c = new THREE.Color(light.color);
    if (light.kind === 'coral_orange') {
      expect(light.intensity, `${light.kind} ${light.color}`).toBeLessThanOrEqual(0.4);
      // Orange, not red: its green above its blue, and (as sRGB bytes) at least half its red.
      const [r, g, b] = [1, 3, 5].map(i => parseInt(light.color.slice(i, i + 2), 16));
      expect(g, `${light.kind} ${light.color}`).toBeGreaterThan(b);
      expect(g, `${light.kind} ${light.color}`).toBeGreaterThanOrEqual(r / 2);
      continue;
    }
    expect(c.r, `${light.kind} ${light.color}`).toBeLessThan(c.g);
    expect(c.r, `${light.kind} ${light.color}`).toBeLessThan(c.b);
  }
  // The skin's accent from the world is cool too.
  expect(VAULT_WORLD.skinAccent).toMatch(/^color\(srgb-linear 0\.0\d+ 0\.0\d+ 0\.0\d+\)$/);
  const [r, g, b] = VAULT_WORLD.skinAccent.slice('color(srgb-linear '.length, -1).split(' ').map(Number);
  expect(r).toBeLessThan(g);
  expect(r).toBeLessThan(b);
});

/** Every colour string in a value, with its path: `#rrggbb` and `color(srgb-linear r g b)`, at any depth. */
function colours(value: unknown, path: string, out: { path: string; rgb: number[] }[] = []) {
  if (typeof value === 'string') {
    if (/^#[0-9a-f]{6}$/i.test(value)) out.push({ path, rgb: [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255) });
    const linear = /^color\(srgb-linear ([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(value);
    if (linear) out.push({ path, rgb: linear.slice(1).map(Number) });
  } else if (Array.isArray(value)) value.forEach((v, i) => colours(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) colours(v, path ? `${path}.${k}` : k, out);
  return out;
}

/** HSL hue in degrees of an RGB triple (0 to 1 each). */
function hue([r, g, b]: number[]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const h = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
  return (h * 60 + 360) % 360;
}

test('no red anywhere in the world: in no colour the world sets is red the strongest channel, but the coral\'s named orange', () => {
  // The whole world config (palette, fog, water and environment, live colours, kit materials, lights,
  // post, kelp, seagrass) and what of her character draws on the world: her grade and aura.
  const all = [...colours(VAULT_WORLD, ''), ...colours({ grade: VEYRA.glow.grade, aura: VEYRA.glow.aura }, 'character')];
  const coralLights = new Set(VAULT_WORLD.lights.points.flatMap((l, i) => (l.kind === 'coral_orange' ? [`lights.points[${i}].color`] : [])));
  const exceptions = new Set(['palette.coral', 'palette.coralBody', ...coralLights]);
  expect(all.length).toBeGreaterThan(40);
  expect(all.map(c => c.path)).toEqual(expect.arrayContaining(['palette.waterFar', 'palette.rock', 'water.colours.fish', 'materials[0].params.edge', 'post.contactShadow.color', 'character.grade.color']));
  for (const { path, rgb } of all) {
    if (exceptions.has(path)) continue;
    const [r, g, b] = rgb;
    expect(r > g && r > b, `${path} (${rgb.map(v => v.toFixed(3)).join(', ')}) is red-led`).toBe(false);
  }
  // The exceptions are orange, not red: hue 20 to 50 degrees (red is under 15). The coral body
  // passes "green at least half its red" by little (74 against 69), so the hue holds it explicitly.
  expect(exceptions.size).toBe(2 + coralLights.size);
  for (const path of exceptions) {
    const { rgb } = all.find(c => c.path === path)!;
    expect(hue(rgb), path).toBeGreaterThanOrEqual(20);
    expect(hue(rgb), path).toBeLessThanOrEqual(50);
  }
});

test('the membrane flows within [0, 1] at its own speed, and its flow holds while the world is still', () => {
  const membrane = VAULT_WORLD.materials!.find(m => m.node === 'membrane');
  expect(membrane?.material).toBe('membrane');
  const { flowSpeed } = membrane!.params as { flowSpeed: number };
  for (let t = 0; t < 600; t += 0.73) {
    const f = membraneFlow(t, flowSpeed);
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThanOrEqual(1);
  }
  expect(membraneFlow(1e9, flowSpeed)).toBeLessThanOrEqual(1);
});

test("the portal's brightest emissive value is below her face core's (spec 7.7's relic rule)", () => {
  const core = luminance(VEYRA.glow.core);
  // Everything that stands in the arch's frame: the membrane (at a full flash) and the padlock.
  const portalNodes = new Set(['arch', ...(VAULT_WORLD.kit.attached ?? []).filter(a => a.piece === 'arch').map(a => a.node)]);
  const portal = (VAULT_WORLD.materials ?? []).filter(m => portalNodes.has(m.node));
  expect(portal.map(m => m.node).sort()).toEqual(['membrane', 'padlock_body', 'padlock_ring']);
  for (const m of portal) expect(kitMaterialBrightest(m), m.node).toBeLessThan(core);
  // The glowing plants stay under it as well.
  for (const m of VAULT_WORLD.materials ?? []) expect(kitMaterialBrightest(m), m.node).toBeLessThan(core);
});

test('near.glb is baked from layout.json and the world\'s lights', () => {
  const baked = readBake();
  const { layout, lights, relics } = VAULT_WORLD;
  // Every placement of every group, as layout.json has it: a layout edit without a new bake fails here.
  expect(Object.keys(baked.instances).sort()).toEqual(Object.keys(layout.groups).sort());
  for (const [group, list] of Object.entries(layout.groups)) expect(baked.instances[group].map(i => i.placement), group).toEqual(list);
  // No glyphs, no lava, nothing behind the rocks.
  expect([baked.lights.glyph, baked.lights.lava, baked.lights.back]).toEqual([[], [], []]);
  expect([baked.lavaRise, baked.backRise]).toEqual([0, 0]);
  expect(baked.spill).toBe(relics.spill);
  expect(baked.settings).toMatchObject({ portalLocal: PORTAL_LOCAL, plantRise: PLANT_RISE, coralRise: CORAL_RISE });
  const close = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 4));
  const pairs = [['portal', 'portal', relics.spill], ['plant', 'plant', 1], ['coral', 'coral_orange', 1]] as const;
  for (const [recorded, kind, rise] of pairs) {
    const config = lights.points.filter(l => l.kind === kind);
    expect(baked.lights[recorded], recorded).toHaveLength(config.length);
    baked.lights[recorded].forEach((light, i) => {
      close(light.position, config[i].position);
      expect(light.intensity).toBeCloseTo(config[i].intensity * rise, 9);
      expect([light.color, light.distance]).toEqual([config[i].color, config[i].distance]);
    });
  }
  expect(baked.lights.fill).toEqual(lights.fill);
  expect(baked.lights.surface).toEqual(lights.surface);
});

test('the far plate: its cards sized for her intro frame, its fog the world\'s, its layers KTX2 files within budget', () => {
  expect(VAULT_WORLD.farPlate!.cutZ).toBe(farData.cutZ);
  expect(farData.fog).toEqual({ color: VAULT_WORLD.palette.waterFar, density: VAULT_WORLD.water.fogDensity });
  let bytes = 0;
  farData.layers.forEach((layer, i) => {
    const size = farCardSize(layer.z, VEYRA_STAGE_FRAMES.intro);
    expect(layer.width, `layer ${i}`).toBeCloseTo(size.width, 2);
    expect(layer.height, `layer ${i}`).toBeCloseTo(size.height, 2);
    // Pixel sides are multiples of 4 (block compression), and the image keeps the card's shape within a pixel.
    expect(layer.pixels.map(p => p % 4)).toEqual([0, 0]);
    expect(Math.abs(layer.pixels[1] - (layer.pixels[0] * layer.height) / layer.width)).toBeLessThanOrEqual(4);
    const { url, z } = VAULT_WORLD.farPlate!.layers[i];
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

test('what a visitor downloads for the vault fits the 6 MB budget', () => {
  // As Nox's (R35): the page loads near.glb or kit.glb, never both; the far plate and the transcoder come with either.
  const folder = (dir: string): number =>
    readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => sum + (e.isDirectory() ? folder(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
  const kit = statSync(join(PUBLIC, VAULT_WORLD.kit.url)).size;
  const near = statSync(join(PUBLIC, VAULT_WORLD.near!.url)).size;
  const visitor = folder(join(PUBLIC, 'veyra', 'world')) + folder(join(PUBLIC, 'nox', 'basis')) - Math.min(kit, near);
  expect(visitor).toBeLessThan(6 * 1024 * 1024);
});
