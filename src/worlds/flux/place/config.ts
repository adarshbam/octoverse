import * as THREE from 'three';
import { applyPlacement } from '../../../engine/world/placement';
import type { Placement, Vec3, WorldConfig, WorldLight } from '../../../engine/world/types';
import { asWorldLayout } from '../../../engine/world/validateWorld';
import farData from './far.json';
import { PIPELINE_KIT, inlayMaterials, ledMaterials } from './kit';
import layoutData from './layout.json';

// "Pipeline Deep" (spec 7.7): Flux's world, a sunken server city under deep navy water. Server
// towers built of rack modules frame both sides, their LEDs blinking blue, cyan, a little violet
// and a few amber; a walkway-pipe bridge with violet-pink ring arches runs from the left distance
// to the GitHub portal, which stands dim to the right and back; dark rocks and small coral clumps
// fill the foreground, on sand. The light is cool: the surface's blue spot from the upper right
// with caustics, a cool fill, the portal's white-blue spill on its plinth, the LEDs' faint spill on
// the rack faces and the rings' violet-pink spill on the deck (all baked by
// blender/pipeline/bake_world.py into near.glb). No red light anywhere. The city beyond
// `farPlate.cutZ` is the far plate (blender/pipeline/render_far.py, far.json). The layout is data
// (layout.json), the single source: the Blender scripts read the same file.
//
// PIPELINE_STAGE below is Task 2's stage backdrop (an empty kit, no layout), kept for the checks
// that still look at Flux on the bare stage; the bundle's place is PIPELINE_WORLD.

/** Checked against the `WorldLayout` schema as it loads, so a bad edit fails here by name. */
const layout = asWorldLayout(layoutData);

/** P2's mid water, and its lit upper water, as sRGB hex. */
const MID_WATER = '#00102d';
const UPPER_WATER = '#014a88';

/**
 * The portal's spill: points of the portal's frame (stage axes: x across the ring, y up, z out of
 * it toward the camera) placed with its plinth: one before the disc's middle, one low over the
 * plinth's top step, one before the plinth. bake_world.py's PORTAL_LOCAL; config.test checks near.glb's record.
 */
export const PORTAL_LOCAL: readonly Vec3[] = [[0, 2.85, 0.5], [0, 1.2, 0.8], [0, 1.0, 2.2]];
/** The bridge rings' spill: a point under each arch's crown, in the bridge segment's frame (bake_world.py's RING_LOCAL). */
export const RING_LOCAL: readonly Vec3[] = [[0, 2.15, 0]];

/** A point of a placed piece's own frame where its placement puts it, as the page places the piece. */
function placedPoint(p: Placement, local: Vec3): Vec3 {
  const frame = new THREE.Object3D();
  applyPlacement(frame, p);
  frame.updateMatrixWorld(true);
  const v = frame.localToWorld(new THREE.Vector3(...local));
  return [v.x, v.y, v.z];
}

const palette: WorldConfig['palette'] = {
  stone: '#1c2c4c',
  glyph: '#4aa6d0',
  // The coral clumps' own glow (Kit.tsx's coral emissive, times relics.coral): a soft pink.
  coral: '#d070c8',
  waterFar: MID_WATER,
  floor: '#0a1224',
  // The sand floor: blue-grey sand, dark rock through it (spec 7.7).
  sand: '#3a4a66',
  rock: '#121828',
  // The portal's white-blue spill and the rings' violet-pink (the light kinds of the same names).
  portal: '#a8d4ff',
  ring: '#b070ff',
  // No seabed glow: black is none.
  floorGlow: {
    cracks: 'color(srgb-linear 0 0 0)',
    lava: 'color(srgb-linear 0 0 0)',
    sheen: 'color(srgb-linear 0 0 0)',
    pores: 'color(srgb-linear 0 0 0)',
  },
};

// The portal's white-blue on the plinth and the stone round it (the bake raises it by relics.spill);
// the skin takes it from a little further. The rings' violet-pink on the deck under each arch.
const portalLights: WorldLight[] = (layout.groups.portal ?? [])
  .filter(p => p.piece === 'portal_plinth')
  .flatMap(p => PORTAL_LOCAL.map(local => ({ kind: 'portal', position: placedPoint(p, local), color: palette.portal as string, intensity: 2, distance: 5, skinRange: 3 })));
const ringLights: WorldLight[] = (layout.groups.bridge ?? [])
  .filter(p => p.piece === 'bridge_arch')
  .flatMap(p => RING_LOCAL.map(local => ({ kind: 'ring', position: placedPoint(p, local), color: palette.ring as string, intensity: 1.5, distance: 3.5, skinRange: 2.5 })));

/** Post-processing: contact shadows where arms cross, threshold bloom, a vignette. No tone-mapping pass. */
const POST: WorldConfig['post'] = {
  contactShadow: { reach: 0.22, minGap: 0.04, maxGap: 1.0, near: 10.8, far: 13.6, strength: 0.6, color: '#06102a' },
  bloom: { luminanceThreshold: 0.66, luminanceSmoothing: 0.25, intensity: 1.05, radius: 0.85 },
  vignette: { offset: 0.3, darkness: 0.9 },
};

/**
 * The water's own colours: near-black navy below, the lit upper water as the zenith, blue shafts.
 * At P2's camera the upper water sample (1, 74, 136) is lit mostly by the shafts, not the zenith, so
 * Task 6 made the shafts a purer blue (at #2f86e0 / #4fb0f0 the corner read grey-blue, 19, 65, 108:
 * delta E 12); it now renders about 9, 57, 108 (delta E 9). Brighter shafts (glow.rays 1.5) moved them
 * off the sample and lit the mid water instead, so their strength stays 1.2.
 */
const WATER_COLOURS: WorldConfig['water']['colours'] = {
  deep: '#00081c',
  zenith: UPPER_WATER,
  glow: '#2a86d8',
  opening: '#4fc4ff',
  rays: '#0a6ee0',
  raysWide: '#1a8af0',
  fish: '#02102a',
};

/** What the skin and the orbs mirror: blue from the surface, the mid water round the horizon, near black below, no seabed glow. */
const WATER_ENVIRONMENT: WorldConfig['water']['environment'] = { top: '#2f7fe8', horizon: MID_WATER, low: '#020818', seabedGlow: null };

/** The live elements' own colours: blue-violet bubbles, blue motes (off), cool snow; no embers (they stay at 0). */
const LIVE_COLOURS: WorldConfig['live']['colours'] = {
  bubbles: { rim: '#8ab4ff', tint: '#5a50d0' },
  embers: { color: '#4aa6d0', hot: '#a0d8ff' },
  motes: { color: '#4a90e8', hot: '#a0c8ff' },
  snow: '#a8d0ff',
};

/**
 * The kit nodes with a kit material (engine KIT_MATERIAL_VARIANTS):
 * - the LED faces (R22: their own `<piece>_led` nodes), blinking each on its own beat at 0.4 to 2.5
 *   blinks a second, lit 60% of the time; their brightest (intensity times the cyan, the brightest
 *   LED colour) stays below his cup glow (config.test);
 * - the portal disc: a soft white-blue membrane, slow light lines flowing round it (the disc's slow
 *   breathing), its brightest below his face core even at a full flash (the relic rule). Task 10
 *   tamed the lines: the disc's fan triangles bend each line into short straight pieces, which at
 *   the old contrast (edge about 17 times the body) read as cracks. The edge colour is now about a
 *   third of the body colour, so a line peaks near 1.4 times the body: a faint shimmer on lit glass;
 * - each ring arc's inlay: a membrane of its own, faint at rest, which a sequence's emissive drive
 *   raises up to five times as the arcs light one by one (Task 15);
 * - the bridge arches: a violet-pink glow, brightest at the crown (the kit's vertex colour, to the
 *   power 5, so the legs and feet fall dark and the glow sits in the hoop over the deck).
 */
const LED = { intensity: 0.75, rate: [0.4, 2.5] as const, duty: 0.6 };
const MATERIALS: WorldConfig['materials'] = [
  ...ledMaterials(LED),
  { node: 'portal_disc', material: 'membrane', params: { color: '#70a8e8', edge: '#3a6898', flowSpeed: 0.05, flowScale: 1, flash: 0.4 } },
  ...inlayMaterials({ color: '#0e2238', edge: '#2a5a8a', flowSpeed: 0, flowScale: 1, flash: 4 }),
  { node: 'bridge_arch', material: 'glow', params: { color: '#c070f0', strength: 1, tips: 5, pulse: 0.2, period: 6 } },
];

export const PIPELINE_WORLD: WorldConfig = {
  id: 'pipeline',
  kit: { url: PIPELINE_KIT.url, pieces: PIPELINE_KIT.pieces, nodes: PIPELINE_KIT.nodes, attached: PIPELINE_KIT.attached },
  near: { url: '/flux/world/near.glb' },
  // far-0 is the farthest layer, as far.json orders them (blender/pipeline/render_far.py writes the files).
  farPlate: { cutZ: farData.cutZ, layers: farData.layers.map((layer, i) => ({ url: `/flux/world/far/far-${i}.ktx2`, z: layer.z })) },
  materials: MATERIALS,
  layout,
  // The camera leans up as Nox's (radians), and drifts a little livelier: the shared hover at his
  // amount, at 1.2 times his pace (spec 7.7).
  camera: { tilt: 0.07, hover: { amount: 1, pace: 1.2 } },
  // The world's light on his skin: a faint cool blue, never warm (no red anywhere in the pipeline world).
  skinAccent: 'color(srgb-linear 0.015 0.03 0.07)',
  post: POST,
  // No lava, no crevice or floor glow, no embers; the opening at the top and the shafts as Task 6 fitted them.
  glow: { lava: 0, back: 0, crevice: 0, floor: 0, embers: 0, top: 1.5, rays: 1.2 },
  // The coral's glow dimmed (small clumps; at 0.6 the fans read as flat pink cut-outs); the portal's spill on the stone 1.2 times its light data (bake_world.py's SPILL).
  relics: { glyph: 1, coral: 0.4, spill: 1.2 },
  palette,
  floor: { material: 'sand' },
  lights: {
    // Cool blue light from the surface at the upper right (its shafts and caustics), a cool fill from overhead.
    surface: { color: '#6fa8ff', intensity: 1.1, position: [6, 24, -10], target: [0, layout.floorY, -8] },
    fill: { color: '#6f8fff', intensity: 1.1, position: [-1.5, 10, 2] },
    points: [...portalLights, ...ringLights],
  },
  water: { fogDensity: 0.034, surfaceDir: [0.35, 0.5, -0.8], environmentIntensity: 0.06, causticStrength: 0.005, colours: WATER_COLOURS, environment: WATER_ENVIRONMENT },
  // Blue-violet bubbles, fish far off (the tiers drop them at low), rays; no embers. No motes: the
  // glyph cards (spec 7.7) need motes that take a sprite set as data, which the engine's motes do
  // not, so they are dropped (spec 12.6). Packets of cyan and lavender light run along the bridge
  // toward the portal (10 at full quality, never below 4). In the intro one or two show at a time,
  // left of the left tower and between it and his left arms; the fog mutes them, so their colours
  // are the light ends of cyan and lavender and they are a little long, to read as streaks of light.
  live: {
    snow: 1,
    motes: 0,
    fish: 1,
    rays: 1,
    bubbles: 1,
    embers: 0,
    colours: LIVE_COLOURS,
    elements: {
      packets: { path: 'bridge', count: { high: 10, medium: 8, low: 6 }, speed: 1.6, length: 0.55, colours: ['#5ef0ff', '#c4b0ff'] },
    },
  },
};

// --- Task 2's stage backdrop ---------------------------------------------------------------------

/**
 * "Pipeline Deep", first pass (Task 2): the stage backdrop. An empty kit (public/flux/world/stage.glb,
 * blender/pipeline/empty_kit.py), no layout and no baked near world or far plate, so Flux shows on
 * dark navy water fitted to P2: the mid water beside him is (0, 16, 45) and the lit water toward the
 * shaft at the upper right is (1, 74, 136). The world's water, post and colours are the same.
 */
export const PIPELINE_STAGE: WorldConfig = {
  id: 'pipeline-stage',
  kit: { url: '/flux/world/stage.glb', pieces: [] },
  layout: { floorY: -2.45, groups: {}, chains: [], coralLights: [] },
  camera: { tilt: 0.07, hover: { amount: 1, pace: 1.2 } },
  // The light through the skin: a faint violet, never warm (no red anywhere in the pipeline world).
  skinAccent: 'color(srgb-linear 0.03 0.02 0.07)',
  post: POST,
  glow: { lava: 0, back: 0, crevice: 0, floor: 0, embers: 0, top: 1.5, rays: 1.2 },
  relics: { glyph: 1, coral: 1, spill: 1 },
  palette: { stone: palette.stone, glyph: palette.glyph, coral: '#c070f0', waterFar: MID_WATER, floor: palette.floor, floorGlow: palette.floorGlow },
  lights: {
    // Cool blue shafts from the upper right, and a cool fill from overhead.
    surface: { color: '#6fa8ff', intensity: 1.1, position: [6, 24, -10], target: [0, -2.45, -8] },
    fill: { color: '#6f8fff', intensity: 1.1, position: [-1.5, 10, 2] },
    points: [],
  },
  water: { fogDensity: 0.034, surfaceDir: [0.35, 0.5, -0.8], environmentIntensity: 0.06, causticStrength: 0.005, colours: WATER_COLOURS, environment: WATER_ENVIRONMENT },
  live: { snow: 1, motes: 0.6, fish: 1, rays: 1, bubbles: 1, embers: 0, colours: LIVE_COLOURS },
};
