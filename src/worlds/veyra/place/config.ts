import * as THREE from 'three';
import { applyPlacement } from '../../../engine/world/placement';
import type { Placement, Vec3, WorldConfig, WorldLight } from '../../../engine/world/types';
import { asWorldLayout } from '../../../engine/world/validateWorld';
import farData from './far.json';
import { VAULT_KIT } from './kit';
import layoutData from './layout.json';

// The vault (spec 7.7): Veyra's world under deep blue-teal water. A stone portal with a cyan energy
// membrane and a padlock stands to the right and back of the stage; mossy blocks, broken walls and
// steps frame both sides; dark rocks, glowing green plants and two orange corals fill the
// foreground; kelp and seagrass sway on the flanks. The light is cool: the surface's cyan spot with
// caustics, a cool fill, the portal's cyan spill on the stone round it and the plants' green light
// (both baked by blender/vault/bake_world.py into near.glb), and the corals' faint warm accent. No
// lava and no red light anywhere. The ruin beyond `farPlate.cutZ` is the far plate
// (blender/vault/render_far.py, far.json). The layout is data (layout.json), the single source:
// the Blender scripts read the same file.

/** Checked against the `WorldLayout` schema as it loads, so a bad edit fails here by name. */
const layout = asWorldLayout(layoutData);

const palette = {
  stone: '#22403f',
  // The one warm accent: orange-yellow coral (P1, P2 lower right).
  coral: '#e8a030',
  // The kit's own colours (the bake's albedo too): dark blue-teal seabed rock and pebbles, and the
  // coral's orange body under its glow (P1's foreground rocks; Nox's are violet-black and red).
  rock: '#16262c',
  pebble: '#1c2c30',
  coralBody: '#8a4a14',
  // The fog and the sky's horizon: the mid water of P2, as Task 7 fitted it.
  waterFar: '#020b10',
  floor: '#0c1c20',
  // The moss floor's patches.
  moss: '#1d4a34',
  // The portal's spill and the plants' light (the light kinds of the same names).
  portal: '#3ad8e8',
  plant: '#38e0a0',
  // No seabed glow: no cracks, no lava, no sheen, no pores.
  floorGlow: {
    cracks: 'color(srgb-linear 0 0 0)',
    lava: 'color(srgb-linear 0 0 0)',
    sheen: 'color(srgb-linear 0 0 0)',
    pores: 'color(srgb-linear 0 0 0)',
  },
};

/**
 * The portal's spill: points of the arch's own frame (stage axes: x across the doorway, y up, z
 * out of it toward the camera) placed with each arch, two in the doorway (low and high) and one
 * before it over the threshold. bake_world.py's PORTAL_LOCAL; config.test checks near.glb's record.
 */
export const PORTAL_LOCAL: readonly Vec3[] = [[0, 0.8, 0.15], [0, 2.4, 0.15], [0, 1.3, 1.2]];
/** A glowing plant's light stands this many times its scale above its foot (bake_world.py's PLANT_RISE). */
export const PLANT_RISE = 0.45;
/** A coral's warm light stands this far above the floor (bake_world.py's CORAL_RISE). */
export const CORAL_RISE = 0.5;

/** A point of a placed piece's own frame where its placement puts it, as the page places the piece. */
function placedPoint(p: Placement, local: Vec3): Vec3 {
  const frame = new THREE.Object3D();
  applyPlacement(frame, p);
  frame.updateMatrixWorld(true);
  const v = frame.localToWorld(new THREE.Vector3(...local));
  return [v.x, v.y, v.z];
}
const largest = (s: Placement['scale']) => (typeof s === 'object' ? Math.max(...s) : (s ?? 1));

// The portal's cyan on the stone round the doorway (the bake raises it by relics.spill); the skin
// takes it from a little further. The plants' green, low and short. The corals' warm accent, the
// only light whose red is not below its green and blue, kept faint (intensity at most 0.4).
const portalLights: WorldLight[] = (layout.groups.portal ?? []).flatMap(arch =>
  PORTAL_LOCAL.map(local => ({ kind: 'portal', position: placedPoint(arch, local), color: palette.portal, intensity: 5, distance: 4.5, skinRange: 3 })),
);
const plantLights: WorldLight[] = (layout.groups.plants ?? []).map(p => ({
  kind: 'plant',
  position: [p.position[0], p.position[1] + PLANT_RISE * largest(p.scale), p.position[2]],
  color: palette.plant,
  intensity: 1.5,
  distance: 2.4,
  skinRange: 2,
}));
const coralLights: WorldLight[] = (layout.groups.corals ?? []).map(p => ({
  kind: 'coral_orange',
  position: [p.position[0], layout.floorY + CORAL_RISE, p.position[2]],
  color: palette.coral,
  intensity: 0.3,
  distance: 1.8,
  skinRange: 1.5,
}));

/** Soft shadows where arms cross and pass under the head; Nox's reach and range (the character sits at the same distance), in a deep teal. */
const POST: WorldConfig['post'] = {
  contactShadow: { reach: 0.22, minGap: 0.04, maxGap: 1.0, near: 10.8, far: 13.6, strength: 0.6, color: '#041c24' },
  // Task 7's bloom: a high threshold, so the cyan membrane and edges glow without clipping to white.
  bloom: { luminanceThreshold: 0.8, luminanceSmoothing: 0.2, intensity: 0.4, radius: 0.6 },
  // 0.75 (Task 11, was 0.9): the portal and the corner plants of the desktop frame lit as P1 has them; 0.6 lifted
  // her arm-top sample past delta E 10 (it is 9.3 at 0.75).
  vignette: { offset: 0.3, darkness: 0.75 },
};

/** The water's own colours: deep blue-teal below, a teal-blue zenith (P2's upper water), the surface's cyan glow, cyan shafts leaning mint as they widen, and small blue-violet fish. */
const WATER_COLOURS: WorldConfig['water']['colours'] = {
  deep: '#010609',
  zenith: '#043c5e',
  glow: '#0678ae',
  opening: '#1ab8c8',
  rays: '#2a9ab8',
  raysWide: '#40c8c0',
  fish: '#2a2a7a',
};

/** What wet surfaces mirror: cyan from the surface, deep blue-teal round the horizon, near black below; no seabed glow. */
const WATER_ENVIRONMENT: WorldConfig['water']['environment'] = { top: '#1f9ac0', horizon: '#06303c', low: '#040f14', seabedGlow: null };

/** The live elements' own colours: cyan bubbles, green motes (the embers are off), pale cyan snow. */
const LIVE_COLOURS: WorldConfig['live']['colours'] = {
  bubbles: { rim: '#7af0ff', tint: '#2a7aa0' },
  embers: { color: '#3adca0', hot: '#a0ffc8' },
  motes: { color: '#3fe0a0', hot: '#c8ff9a' },
  snow: '#a0e0f0',
};

/**
 * The kit nodes with a kit material (engine KIT_MATERIAL_VARIANTS): the doorway's membrane (P1's
 * cyan body and mint-cyan rim), the padlock lit pale mint as P1 paints it, and the glowing plants
 * (teal-green, brightest at the bulbs, pulsing slowly). The portal stays under her face glow's
 * brightness (spec 7.7's relic rule; config.test). The portal takes a quarter of the water's fog
 * (`fog`): it is the world's one strong light and reads from the stage as P1 paints it, not greyed.
 * The membrane draws its body at 0.32 of `color` (membraneMaterial.ts), so `color` is bright.
 */
const PORTAL_FOG = 0.25;
const MATERIALS: WorldConfig['materials'] = [
  { node: 'membrane', material: 'membrane', params: { color: '#0fdcff', edge: '#70e6dc', flowSpeed: 0.06, flowScale: 1, flash: 0.2, fog: PORTAL_FOG } },
  { node: 'padlock_body', material: 'glow', params: { color: '#92f0e0', strength: 1.08, tips: 0, pulse: 0, period: 1, fog: PORTAL_FOG } },
  { node: 'padlock_ring', material: 'glow', params: { color: '#92f0e0', strength: 1.08, tips: 0, pulse: 0, period: 1, fog: PORTAL_FOG } },
  { node: 'glowplant_a', material: 'glow', params: { color: '#5af0d8', strength: 1.15, tips: 1.3, pulse: 0.35, period: 7 } },
  { node: 'glowplant_b', material: 'glow', params: { color: '#5af0d8', strength: 1.15, tips: 1.3, pulse: 0.35, period: 8.5 } },
];

export const VAULT_WORLD: WorldConfig = {
  id: 'vault',
  kit: {
    url: VAULT_KIT.url,
    pieces: VAULT_KIT.pieces,
    nodes: VAULT_KIT.nodes,
    // The portal's other parts are built in the arch's frame: each stands in every arch.
    attached: VAULT_KIT.nodes.map(node => ({ node, piece: 'arch' })),
  },
  near: { url: '/veyra/world/near.glb' },
  // far-0 is the farthest layer, as far.json orders them (blender/vault/render_far.py writes the files).
  farPlate: { cutZ: farData.cutZ, layers: farData.layers.map((layer, i) => ({ url: `/veyra/world/far/far-${i}.ktx2`, z: layer.z })) },
  materials: MATERIALS,
  layout,
  // A slight upward lean (spec 7.7, smaller than Nox's 0.07) and a calmer drift: 0.8 of his amount at 0.75 of his pace.
  camera: { tilt: 0.04, hover: { amount: 0.8, pace: 0.75 } },
  // The world's light on her skin: a faint cool teal, never warm.
  skinAccent: 'color(srgb-linear 0.01 0.04 0.045)',
  post: POST,
  // No lava, no crevice or floor glow, no embers; the opening at the top and the shafts at their natural size.
  glow: { lava: 0, back: 0, crevice: 0, floor: 0, embers: 0, top: 1, rays: 1 },
  // The coral's glow at its colour; the portal's spill on the stone 1.2 times its light data (bake_world.py's SPILL).
  relics: { glyph: 1, coral: 1, spill: 1.2 },
  palette,
  floor: { material: 'moss' },
  lights: {
    surface: { color: '#4fc8ff', intensity: 1.1, position: [0.6, 24, -10], target: [0, layout.floorY, -8] },
    fill: { color: '#4fb8e0', intensity: 1.1, position: [-1.5, 10, 2] },
    points: [...portalLights, ...plantLights, ...coralLights],
  },
  water: { fogDensity: 0.034, surfaceDir: [0.03, 0.45, -0.89], environmentIntensity: 0.06, causticStrength: 0.005, colours: WATER_COLOURS, environment: WATER_ENVIRONMENT },
  // Cyan bubbles, green motes, blue-violet fish far off (the tiers drop them at low), rays; no embers.
  // Kelp frames the flanks, seagrass closer in.
  live: {
    snow: 1,
    motes: 1,
    fish: 1,
    rays: 1,
    bubbles: 1,
    embers: 0,
    colours: LIVE_COLOURS,
    elements: {
      // The first 15 of the kelp's seeded scatter: the 16th stands in front of the doorway (from the
      // stage), as do the 18th, 22nd and 57th; the 15 frame the flanks and the far water.
      kelp: { count: 15, height: 3.2, sway: 0.22, color: '#0f5a48' },
      seagrass: { count: 220, height: 0.6, sway: 0.06, color: '#1a7058' },
    },
  },
};
