import * as THREE from 'three';
import type { Point2 } from '../../../engine/config/types';
import { applyPlacement } from '../../../engine/world/placement';
import type { JellyfishConfig, Placement, Vec3, WorldConfig, WorldLight } from '../../../engine/world/types';
import { asWorldLayout } from '../../../engine/world/validateWorld';
import farData from './far.json';
import { OBSERVATORY_ATTACHED, OBSERVATORY_KIT, OBSERVATORY_PROPS, WINDOWED_PIECES } from './kit';
import layoutData from './layout.json';

// The drowned observatory (spec 7.7). Two configs share the water, the post and the colours:
// - OBSERVATORY_STAGE, the stage backdrop from before the kit (Tasks 1 to 8): only the water, an
//   empty glb and no pieces. Kept for the tests and reviews that measured against it.
// - OBSERVATORY_WORLD (Task 9), the world the page shows: the kit (kit.glb, its baked near light in
//   near.glb), the layout (layout.json), the far plate (far.json), the membrane, the glyph's pulse,
//   the windows' and lanterns' glow, and the live elements (jellyfish, star specks, bubbles, manta
//   fish, bobbing rubble).
// There is no lava and no red light anywhere in her world: the seabed's glow is black (none), no
// embers, and every light and palette colour is cool, magenta or amber (config.test: no hue within
// 20 degrees of red at a saturation above 0.5).

/** An empty layout (no pieces), checked against the schema like a full one, so a later edit fails by name. */
const layout = asWorldLayout({ floorY: -2.45, groups: {}, chains: [], coralLights: [] });

/**
 * The seabed's own light: none. Black is no glow (types.ts `FloorGlow`); the world's own look
 * fits it to P2's water, which has no glow below, only dark indigo.
 */
const NO_GLOW = '#000000';

const palette = {
  // The ruin's stone: dark blue-violet, lit warm from its windows once the towers exist.
  stone: '#2c2f6a',
  // The brain glyph's neon violet-blue, the coral's magenta and an amber lantern, for the pieces to come.
  glyph: '#6a5aff',
  coral: '#c02ad0',
  // The warm amber of the lanterns and lit windows, a relic the world names (`relics.amber`).
  amber: '#ffb040',
  // The water at the horizon: P2's mid water (5, 19, 75).
  waterFar: '#05134b',
  floor: '#0a0f33',
  floorGlow: { cracks: NO_GLOW, lava: NO_GLOW, sheen: NO_GLOW, pores: NO_GLOW },
};

/**
 * Post-processing: contact shadows and bloom as Nox's (her glow is the brightest thing in frame, so
 * the bloom threshold keeps the pink-white core from washing out: Task 3 and 6 tune it), and a
 * lighter vignette, since P2's corners are lit by the ruin and its rays. Task 6: vignette 0.8 to 0.4
 * (the water samples away from her were too dark) and a higher, softer bloom (threshold 0.66 to 0.8,
 * intensity 1.05 to 0.8: the face glow bloomed to white below the mouth).
 */
const POST: WorldConfig['post'] = {
  contactShadow: { reach: 0.22, minGap: 0.04, maxGap: 1.0, near: 10.8, far: 13.6, strength: 0.6, color: '#0a0830' },
  // Fix round 1: threshold 0.8 to 0.95, so the pink-white face (luminance about 0.9) no longer blooms over the
  // pupils (they read 30 to 40 per channel at 0.8, 11 to 15 at 0.95); only near-white highlights bloom now.
  bloom: { luminanceThreshold: 0.95, luminanceSmoothing: 0.25, intensity: 0.8, radius: 0.85 },
  vignette: { offset: 0.3, darkness: 0.4 },
};

/**
 * The water's own colours, fitted to panel 2's samples: the lit water at the top right (2, 36, 100)
 * is the zenith, the mid water (5, 19, 75) the horizon (`palette.waterFar`), and near-black indigo
 * below. The surface's glow and the shafts are cool blue leaning cyan-white where they widen; the
 * far fish are violet against the glow.
 */
const WATER_COLOURS: WorldConfig['water']['colours'] = {
  deep: '#03051a',
  zenith: '#022464',
  glow: '#2f6bff',
  opening: '#6ab0ff',
  rays: '#5a8cff',
  raysWide: '#9cc4ff',
  fish: '#2a1a68',
};

/** What wet stone, the skin and the orbs mirror: blue from the surface, indigo round the horizon, near black below, and no glow on the seabed. */
const WATER_ENVIRONMENT: WorldConfig['water']['environment'] = { top: '#3a60e8', horizon: '#0c1a5a', low: '#080a24', seabedGlow: null };

/** The live elements' own colours: glassy pale-blue bubbles, blue-white star motes, violet-lilac embers (none drawn yet: `glow.embers` is 0), pale blue snow. */
const LIVE_COLOURS: WorldConfig['live']['colours'] = {
  bubbles: { rim: '#9ad0ff', tint: '#6a5ad8' },
  embers: { color: '#9a6aff', hot: '#e0b0ff' },
  motes: { color: '#8ab4ff', hot: '#e8f0ff' },
  snow: '#a8c0ff',
};

export const OBSERVATORY_STAGE: WorldConfig = {
  id: 'observatory',
  kit: { url: '/aether/world/stage.glb', pieces: [] },
  layout,
  // A slight upward lean, about Veyra's (spec 7.7); the drift is the shared one, a touch floatier
  // than Nox's: his amount (1) and 0.85 of his pace (1).
  camera: { tilt: 0.04, hover: { amount: 1 * 1.0, pace: 1 * 0.85 } },
  // The light her world puts on her skin: a faint lavender, never warm red.
  skinAccent: 'color(srgb-linear 0.035 0.03 0.07)',
  post: POST,
  // No lava, back lights or crevice glow; the rays and the surface's opening are Nox's strength.
  glow: { lava: 0, back: 0, crevice: 0, floor: 0, embers: 0, top: 1.2, rays: 1.2 },
  relics: { glyph: 1, coral: 1, spill: 1, amber: 1 },
  palette,
  lights: {
    // Cool blue-white rays from the upper right (spec 7.7), and a cool fill from overhead.
    surface: { color: '#a8c4ff', intensity: 1.1, position: [6, 24, -10], target: [0, layout.floorY, -8] },
    fill: { color: '#8090ff', intensity: 1.1, position: [-1.5, 10, 2] },
    points: [],
  },
  water: { fogDensity: 0.03, surfaceDir: [0.45, 0.45, -0.77], environmentIntensity: 0.06, causticStrength: 0.005, colours: WATER_COLOURS, environment: WATER_ENVIRONMENT },
  live: { snow: 1, motes: 1, fish: 0, rays: 1, bubbles: 1, embers: 0, colours: LIVE_COLOURS },
};

// --- The world (Task 9) -----------------------------------------------------------------------

/** The observatory's layout (layout.json), checked against the `WorldLayout` schema as it loads. */
const worldLayout = asWorldLayout(layoutData);

/**
 * The world's colours. The engine reads `stone`, `coral` (the coral fans' glow), `floor` and
 * `waterFar`; the sand floor reads `sand` and `rock`; `portal` and `amber` name the light colours of
 * those kinds. No red: the amber is orange-yellow, the coral magenta (config.test).
 */
export const WORLD_PALETTE = {
  ...palette,
  // The fog and the sky's horizon: far.json's fog colour (config.test keeps the two equal).
  waterFar: farData.fog.color,
  // The sand floor: dark blue silt (P1's ground below the portal, about (5 to 10, 20 to 37, 74 to
  // 108) lit). The shader scales `sand` by 0.8 to 1.2 across its ripples (0.65 in the wet patches),
  // so it sits a little brighter than the mean wanted; `rock` shows through in patches.
  sand: '#232c6c',
  rock: '#121433',
  // The portal's cyan spill (bake_world.py PORTAL).
  portal: '#40d0ff',
  // The windows', lanterns' and small corals' amber (bake_world.py WINDOW, AMBER_CORAL).
  amber: '#ffa040',
};

/**
 * The portal's spill: points of the arch's own frame (stage axes: x across the doorway, y up, z out
 * of it toward the front) placed with the arch, two in the doorway (low and high) and one before it
 * over the steps. bake_world.py's PORTAL_LOCAL; config.test checks near.glb's record against it.
 */
export const PORTAL_LOCAL: readonly Vec3[] = [[0, 1.0, 0.3], [0, 3.0, 0.3], [0, 0.9, 1.6]];
/** A coral fan's magenta light stands this far above the floor (bake_world.py's CORAL_RISE). */
export const CORAL_RISE = 0.5;
/** The coral fans' light colour (bake_world.py's CORAL): a lighter magenta than their glow. */
export const CORAL_LIGHT = '#d040e0';

/** The windows' glow (their kit material, and render_far.py's WINDOW_GLOW): amber, at a strength kept under her face glow. */
export const WINDOW_GLOW = { color: WORLD_PALETTE.amber, strength: 1.3 } as const;

/** A point of a placed piece's own frame where its placement puts it, as the page places the piece. */
function placedPoint(p: Placement, local: Vec3): Vec3 {
  const frame = new THREE.Object3D();
  applyPlacement(frame, p);
  frame.updateMatrixWorld(true);
  const v = frame.localToWorld(new THREE.Vector3(...local));
  return [v.x, v.y, v.z];
}

const placements = Object.values(worldLayout.groups).flat();
const arches = placements.filter(p => p.piece === 'portal_arch');

// The portal's cyan on the stone round the doorway (the bake raises it by relics.spill); her skin
// takes it from a little further. The coral fans' magenta, low and short.
const portalLights: WorldLight[] = arches.flatMap(arch =>
  PORTAL_LOCAL.map(local => ({ kind: 'portal', position: placedPoint(arch, local), color: WORLD_PALETTE.portal, intensity: 2, distance: 4.5, skinRange: 3 })),
);
const coralLights: WorldLight[] = (worldLayout.groups.corals ?? [])
  .filter(p => p.piece.startsWith('coral_fan_'))
  .map(p => ({ kind: 'coral', position: [p.position[0], worldLayout.floorY + CORAL_RISE, p.position[2]], color: CORAL_LIGHT, intensity: 0.6, distance: 2.2, skinRange: 1.8 }));
/**
 * The warm light: one for each lit piece in the near world and one for the lanterns, for her skin's
 * accents and the unbaked fallback only. The bake lights the stone from each window and lantern
 * bead (bake_world.py WINDOW, LANTERN), which this list does not repeat.
 */
const amberLights: WorldLight[] = [
  ...placements
    .filter(p => (WINDOWED_PIECES as readonly string[]).includes(p.piece) && p.position[2] >= farData.cutZ)
    .map(p => ({ kind: 'amber', position: [p.position[0], p.position[1] + 3, p.position[2] + 2] as Vec3, color: WORLD_PALETTE.amber, intensity: 0.8, distance: 5, skinRange: 2 })),
  ...arches.map(arch => ({ kind: 'amber', position: placedPoint(arch, [0, 2.2, 0.6]), color: WORLD_PALETTE.amber, intensity: 0.5, distance: 4, skinRange: 2 })),
];

/** The far fish: violet manta rays seen from above, wings spread, gliding nose first (+x), as P1 paints them. 19 points in the unit box. */
export const MANTA_SILHOUETTE: readonly Point2[] = [
  [1.0, 0.08], [0.82, 0.18], [0.55, 0.45], [0.25, 0.85], [0.05, 0.95], [-0.05, 0.75], [-0.2, 0.35], [-0.35, 0.12], [-1.0, 0.02],
  [-1.0, -0.02], [-0.35, -0.12], [-0.2, -0.35], [-0.05, -0.75], [0.05, -0.95], [0.25, -0.85], [0.55, -0.45], [0.82, -0.18], [1.0, -0.08],
  [0.9, 0],
];

/** The small amber corals (glow on the page; layout.json puts each at its rest height, as the bake does). */
export const AMBER_CORALS = ['coral_amber_a', 'coral_amber_b', 'coral_amber_c'] as const;

/**
 * The kit nodes with a kit material (engine KIT_MATERIAL_VARIANTS): the doorway's membrane (P1's
 * deep blue body, cyan rim, slow flowing lines), the brain glyph (neon violet-blue, pulsing once in
 * 7.5 s: spec 7.7 asks for a pulse every 6 to 9 s), the lanterns and every lit window (amber, a
 * faint flicker), and the small amber corals (amber, brightest at the tips). Every one stays under
 * her face glow's brightness (spec 7.7's relic rule; config.test).
 *
 * The membrane's colour is not P1's sample (15, 56, 167) = #0f38a7 as such: the engine draws the
 * body at 0.32 of `color` (membraneMaterial.ts) and the fog takes about a third of it at the
 * portal's distance, so #0f38a7 read (5, 26, 91) on the page. #2876ff is the brightest colour
 * whose body keeps P1's red and green (it reads about (15, 56, 132): blue tops out, as `color` can
 * not pass 1). MORNING-REVIEW-aether.md asks the engine for a body level, which would let this go
 * back to #0f38a7.
 */
export const MEMBRANE_COLOR = '#2876ff';

export const WORLD_MATERIALS: NonNullable<WorldConfig['materials']> = [
  { node: 'portal_membrane', material: 'membrane', params: { color: MEMBRANE_COLOR, edge: '#30c8f8', flowSpeed: 0.05, flowScale: 1.2, flash: 0.25 } },
  { node: 'portal_glyph', material: 'glow', params: { color: '#7a6aff', strength: 1.6, tips: 0, pulse: 0.55, period: 7.5 } },
  { node: 'portal_lanterns', material: 'glow', params: { color: '#ffb050', strength: 1.3, tips: 0, pulse: 0.15, period: 4.3 } },
  ...WINDOWED_PIECES.map((piece, i) => ({ node: `${piece}_windows`, material: 'glow' as const, params: { ...WINDOW_GLOW, tips: 0, pulse: 0.08, period: 5.3 + 0.7 * i } })),
  ...AMBER_CORALS.map((node, i) => ({ node, material: 'glow' as const, params: { color: WORLD_PALETTE.amber, strength: 1.1, tips: 1.3, pulse: 0.2, period: 7.9 + 1.1 * i } })),
];

/**
 * The jellyfish (spec 7.7): pink-violet bells with cyan filaments, pulsing every 2.4 to 3.8 s and
 * drifting slowly up through the mid water behind her and round the towers; 10, 7 or 4 by tier.
 */
export const JELLYFISH: JellyfishConfig = {
  count: { high: 10, medium: 7, low: 4 },
  size: [0.16, 0.3],
  bell: '#d49cff',
  filament: '#5ce8ff',
  pulse: [2.4, 3.8],
  drift: 0.05,
  region: { min: [-9, -0.6, -15], max: [9, 5.2, -3.5] },
};

/** The live elements' own colours in the world: glassy pale-blue bubbles, blue-white star motes and twinkling specks (the snow), no embers. */
const WORLD_LIVE_COLOURS: WorldConfig['live']['colours'] = {
  bubbles: { rim: '#9ad0ff', tint: '#6a5ad8' },
  embers: { color: '#9a6aff', hot: '#e0b0ff' },
  motes: { color: '#9ab8ff', hot: '#f0f4ff' },
  snow: '#c8d8ff',
};

/**
 * The world's props: the rubble on `'bob'` (kit.ts OBSERVATORY_PROPS). The glyph's `'emissive'` prop
 * is left out here: nothing drives an emissive prop yet (only a sequence would, and none targets
 * it), and its pulse comes from its glow material, which validateWorld does not allow beside an
 * emissive drive (a glow sets its own level). MORNING-REVIEW-aether.md has the engine request.
 */
const WORLD_PROPS = OBSERVATORY_PROPS.filter(prop => prop.id !== 'portalGlyph');

export const OBSERVATORY_WORLD: WorldConfig = {
  ...OBSERVATORY_STAGE,
  kit: { url: OBSERVATORY_KIT.url, pieces: OBSERVATORY_KIT.pieces, nodes: OBSERVATORY_KIT.nodes, attached: OBSERVATORY_ATTACHED },
  near: { url: '/aether/world/near.glb' },
  // far-0 is the farthest layer, as far.json orders them (blender/aether/render_far.py writes the files).
  farPlate: { cutZ: farData.cutZ, layers: farData.layers.map((layer, i) => ({ url: `/aether/world/far/far-${i}.ktx2`, z: layer.z })) },
  materials: WORLD_MATERIALS,
  props: WORLD_PROPS,
  layout: worldLayout,
  // The portal's cyan on the stone 1.2 times its light data (bake_world.py's SPILL).
  relics: { glyph: 1, coral: 1, spill: 1.2, amber: 1 },
  palette: WORLD_PALETTE,
  floor: { material: 'sand' },
  lights: {
    // Cool blue-white rays from the upper right (spec 7.7), and a cool fill from overhead (bake_world.py SURFACE and FILL).
    surface: { color: '#a8c4ff', intensity: 1.1, position: [6, 24, -10], target: [0, worldLayout.floorY, -8] },
    fill: { color: '#8090ff', intensity: 1.1, position: [-1.5, 10, 2] },
    points: [...portalLights, ...coralLights, ...amberLights],
  },
  water: { ...OBSERVATORY_STAGE.water, fogDensity: farData.fog.density },
  live: {
    snow: 1,
    motes: 1,
    fish: 1,
    rays: 1,
    bubbles: 0.7,
    embers: 0,
    colours: WORLD_LIVE_COLOURS,
    elements: { jellyfish: JELLYFISH },
    fishSilhouette: MANTA_SILHOUETTE,
  },
};
