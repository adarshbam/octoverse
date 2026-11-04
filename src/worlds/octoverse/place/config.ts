import * as THREE from 'three';
import { applyPlacement } from '../../../engine/world/placement';
import type { JellyfishConfig, Placement, Vec3, WorldConfig, WorldLight, WorldProp } from '../../../engine/world/types';
import { asWorldLayout } from '../../../engine/world/validateWorld';
import farData from './far.json';
import { REEF_CARDS, REEF_KIT, REEF_MAGENTA_CORALS } from './kit';
import layoutData from './layout.json';

// The reef (platform spec 7.7): the host's world under deep indigo water. A ruined gateway of dark
// blocky masonry stands right and back of the stage, ember-lit windows in its stones, its doorway
// holding the shared membrane in violet-blue with the OctoVerse octopus glyph before it; dark rocks
// frame both sides; magenta and orange coral grow in clumps at the corners; thin glass portfolio
// cards float behind the host (scenery, never interface). The light: cool blue from the surface
// (top right), the membrane's violet spill on the stone round the doorway, the windows' and the
// orange coral's warm embers, the magenta coral's own faint light, and the warm violet-orange glow
// of the path the host swims along (all but the surface baked by blender/reef/bake_world.py into
// near.glb). Beyond `farPlate.cutZ` the reef goes on in the far plate (blender/reef/render_far.py,
// far.json). The layout is data (layout.json, Task 4), the single source: the Blender scripts read
// the same file. Nothing here outshines the host: every kit light is below its face glow (spec 7.2,
// 7.7; config.test), and the engine caps the world's light on its skin at 10% and caustics at 5%.

/** Checked against the `WorldLayout` schema as it loads, so a bad edit fails here by name. */
const layout = asWorldLayout(layoutData);

/**
 * The reef's colours. Besides the engine's four and the sand floor's two, each is named by a light
 * kind or a relic (validateWorld): `membrane`, `ember`, `magenta` and `path` are light kinds,
 * `glyph` and `glass` relics. Every light and kit material takes its colour from here (config.test).
 */
const palette = {
  // Dark blue-violet masonry and boulders.
  stone: '#2a2a5a',
  // The orange coral (P1, P2 lower corners): the engine's coral glow, and its light's kind.
  coral: '#ff8a3a',
  // The fog and the sky's horizon: P2's mid water (20, 30, 95), as Task 3 fitted it. The brief's
  // #021648 (spec 7.7's 2, 22, 72 near the host) darkened P2's mid water sample to delta E 12.9 on the
  // rendered intro; with this one the water just outside the head still reads (2, 22, 72) within 10.
  waterFar: '#141e5f',
  floor: '#120c28',
  // The sand floor: violet-grey sand, dark violet rock showing through toward the sides.
  sand: '#5c4a72',
  rock: '#1a1430',
  // The membrane's lavender edge and light lines (relics.glyph: the gate's glyph light).
  glyph: '#b48cff',
  // The membrane's violet-blue body (P1's sample, 117, 56, 252), and its spill on the stone.
  membrane: '#7538fc',
  // The windows' ember light.
  ember: '#ff9a40',
  // The magenta coral's own glow and faint light.
  magenta: '#e040c0',
  // The path's warm violet-orange glow (P1's floor path, 169, 120, 150).
  path: '#a97896',
  // The glass cards' cool lavender-blue (relics.glass: their glow's strength).
  glass: '#8aa0ff',
  // No seabed glow: the sand floor reads none (no cracks, lava, sheen or pores).
  floorGlow: {
    cracks: 'color(srgb-linear 0 0 0)',
    lava: 'color(srgb-linear 0 0 0)',
    sheen: 'color(srgb-linear 0 0 0)',
    pores: 'color(srgb-linear 0 0 0)',
  },
};

/**
 * The membrane's spill: points of the arch's own frame (stage axes: x across the doorway, y up, z
 * out of it toward the camera), placed with each arch: two in the doorway (low and high, just
 * before the membrane) and one over the threshold. bake_world.py's MEMBRANE_LOCAL.
 */
export const MEMBRANE_LOCAL: readonly Vec3[] = [[0, 0.6, 0.02], [0, 1.8, 0.02], [0, 0.9, 0.7]];
/** The windows' embers: points of the arch's frame just before its front, by the window clusters (bake_world.py's EMBER_LOCAL). */
export const EMBER_LOCAL: readonly Vec3[] = [[-0.8, 0.9, 0.5], [0.8, 1.2, 0.5], [-0.7, 2.4, 0.5], [0.85, 2.2, 0.5]];
/** A coral's light stands this far above the floor (bake_world.py's CORAL_RISE). */
export const CORAL_RISE = 0.5;
/** The path's glow: (x, z) points along the path from the left distance toward the gate, each lit PATH_RISE above the floor (bake_world.py's PATH_POINTS). */
export const PATH_POINTS: readonly (readonly [number, number])[] = [[-5.2, -3.4], [-2.6, -2.4], [0.2, -3.4], [1.6, -5.6]];
export const PATH_RISE = 0.45;

/** A point of a placed piece's own frame where its placement puts it, as the page places the piece. */
function placedPoint(p: Placement, local: Vec3): Vec3 {
  const frame = new THREE.Object3D();
  applyPlacement(frame, p);
  frame.updateMatrixWorld(true);
  const v = frame.localToWorld(new THREE.Vector3(...local));
  return [v.x, v.y, v.z];
}

const gates = layout.groups.gate ?? [];
const corals = layout.groups.corals ?? [];
const isMagenta = (p: Placement) => p.piece.startsWith('coral_magenta_');

// The membrane's violet on the stone round the doorway (the bake raises it by relics.spill); the
// windows' embers, low and short; each coral's faint light in its own colour; the path's warm glow
// on the sand. Their reach on the host's skin is short, and the engine caps what they add there.
const membraneLights: WorldLight[] = gates.flatMap(arch =>
  MEMBRANE_LOCAL.map(local => ({ kind: 'membrane', position: placedPoint(arch, local), color: palette.membrane, intensity: 1.6, distance: 3.5, skinRange: 2 })),
);
const emberLights: WorldLight[] = gates.flatMap(arch =>
  EMBER_LOCAL.map(local => ({ kind: 'ember', position: placedPoint(arch, local), color: palette.ember, intensity: 0.5, distance: 1.6, skinRange: 1 })),
);
const coralLight = (p: Placement, kind: 'coral' | 'magenta'): WorldLight => ({
  kind,
  position: [p.position[0], layout.floorY + CORAL_RISE, p.position[2]],
  color: palette[kind],
  intensity: 0.3,
  distance: 1.8,
  skinRange: 1.5,
});
const orangeCoralLights = corals.filter(p => !isMagenta(p)).map(p => coralLight(p, 'coral'));
const magentaCoralLights = corals.filter(isMagenta).map(p => coralLight(p, 'magenta'));
const pathLights: WorldLight[] = PATH_POINTS.map(([x, z]) => ({ kind: 'path', position: [x, layout.floorY + PATH_RISE, z], color: palette.path, intensity: 1.2, distance: 3.2, skinRange: 0.6 }));

/** The relics: the coral's glow at its colour, the membrane's spill on the stone 1.2 times its light data, the cards' glass glow. */
const relics: WorldConfig['relics'] = { glyph: 1, coral: 1, spill: 1.2, glass: 0.55 };

/**
 * The kit nodes drawn with a kit material (engine KIT_MATERIAL_VARIANTS): the doorway's membrane
 * (violet-blue body, lavender edge and lines, a slow flow); the windows' ember glow; each glass
 * card (a cool glow following the card's own shading, bright icons on a dim screen); and the
 * magenta corals (their glow brightest at the tips, as the engine's coral). The orange corals keep
 * the engine's coral dressing in `palette.coral`. The glyph keeps the kit's own lavender emissive
 * material for the `'emissive'` prop drive (Task 12). Every one stays below the host's face glow.
 */
const MATERIALS: WorldConfig['materials'] = [
  { node: 'gate_membrane', material: 'membrane', params: { color: palette.membrane, edge: palette.glyph, flowSpeed: 0.05, flowScale: 1, flash: 0.3 } },
  { node: 'gate_windows', material: 'glow', params: { color: palette.ember, strength: 0.7, tips: 0, pulse: 0.2, period: 6 } },
  ...REEF_CARDS.map(node => ({ node, material: 'glow' as const, params: { color: palette.glass, strength: relics.glass, tips: 2, pulse: 0.1, period: 8 } })),
  ...REEF_MAGENTA_CORALS.map(node => ({ node, material: 'glow' as const, params: { color: palette.magenta, strength: 0.9, tips: 1.6, pulse: 0.15, period: 9 } })),
];

/**
 * The glass cards drift: each a `bob` prop on its own (the engine gives each its own phase from its
 * id), a few hundredths of a stage unit either way, once every 5 to 9 seconds, no two the same
 * (spec 7.7: scenery, never interface). The cards keep their glow material: the `bob` drive moves
 * a node and the glow sets its own level, so the two coexist (validateWorld only refuses an
 * 'emissive' drive on a glow).
 */
const CARD_BOBS: readonly { amplitude: number; period: number }[] = [
  { amplitude: 0.06, period: 7 },
  { amplitude: 0.05, period: 8.5 },
  { amplitude: 0.07, period: 5.5 },
  { amplitude: 0.04, period: 6.5 },
  { amplitude: 0.05, period: 9 },
  { amplitude: 0.08, period: 7.5 },
  { amplitude: 0.06, period: 5 },
  { amplitude: 0.04, period: 8 },
];
const PROPS: WorldProp[] = REEF_CARDS.map((node, i) => ({ id: node, node, drive: 'bob' as const, bob: CARD_BOBS[i % CARD_BOBS.length] }));

/**
 * The jellyfish (spec 7.7): a few small orange bells with violet filaments, in the open water at the
 * left edge of the intro frame, behind the cards and well away from the host's face (the gate holds
 * the right edge). Five at the top tier, three at medium, two at low (7.16: never fewer). The region
 * sits 5 to 8 units behind the stage, so its box projects to the outer part of the frame on the
 * stage plane (config.test).
 */
export const JELLYFISH: JellyfishConfig = {
  count: { high: 5, medium: 3, low: 2 },
  size: [0.14, 0.26],
  bell: palette.coral,
  filament: palette.glyph,
  pulse: [3, 6],
  drift: 0.04,
  region: { min: [-3.5, 1.4, -7.5], max: [-2.3, 3.6, -5.5] },
};

/** Soft shadows where arms cross and pass under the head; bloom and vignette as Task 3 fitted them to P2. */
const POST: WorldConfig['post'] = {
  contactShadow: { reach: 0.22, minGap: 0.04, maxGap: 1.0, near: 10.8, far: 13.6, strength: 0.5, color: '#140a30' },
  bloom: { luminanceThreshold: 0.66, luminanceSmoothing: 0.25, intensity: 1.0, radius: 0.85 },
  vignette: { offset: 0.3, darkness: 0.7 },
};

/**
 * The water's own colours: the mid water of P1 (1, 18, 54) below the horizon; the zenith and the
 * surface's cyan-blue glow toward the top right, as P2 is lit (Task 3's: the brief's #1081db, P2's
 * upper water sample itself, rendered that sample at delta E 17.4 against Task 3's 11.0).
 */
const WATER_COLOURS: WorldConfig['water']['colours'] = {
  deep: '#011236',
  zenith: '#0a50e8',
  glow: '#20a8ff',
  opening: '#3cb4ff',
  rays: '#2a86e8',
  raysWide: '#4cb0ff',
  fish: '#08103a',
};

/** What wet surfaces mirror: blue from the surface, indigo round the horizon, near black below; no seabed glow. */
const WATER_ENVIRONMENT: WorldConfig['water']['environment'] = { top: '#3a8cff', horizon: '#101c58', low: '#080a20', seabedGlow: null };

/** The live elements' own colours: lavender bubbles, violet motes with a warm hot one (the embers are off), pale blue snow. */
const LIVE_COLOURS: WorldConfig['live']['colours'] = {
  bubbles: { rim: '#b4a0ff', tint: '#5a4ab0' },
  embers: { color: '#ffb070', hot: '#ffd8a0' },
  motes: { color: '#a070ff', hot: '#ffc0d8' },
  snow: '#c8d4ff',
};

export const REEF_WORLD: WorldConfig = {
  id: 'reef',
  kit: {
    url: REEF_KIT.url,
    pieces: REEF_KIT.pieces,
    nodes: REEF_KIT.nodes,
    // The gate's other parts are built in the arch's frame: each stands in every arch.
    attached: REEF_KIT.nodes.map(node => ({ node, piece: 'gate_arch' })),
  },
  near: { url: '/octoverse/world/reef/near.glb' },
  // far-0 is the farthest layer, as far.json orders them (blender/reef/render_far.py writes the files).
  farPlate: { cutZ: farData.cutZ, layers: farData.layers.map((layer, i) => ({ url: `/octoverse/world/reef/far/far-${i}.ktx2`, z: layer.z })) },
  materials: MATERIALS,
  props: PROPS,
  layout,
  // A straight-on camera, as P2 is painted; Nox's drift amount at 0.85 of his pace (between Veyra's and his).
  camera: { tilt: 0, hover: { amount: 1, pace: 0.85 } },
  // The reef's light on the host's skin: a faint violet-peach warmth (Task 3's).
  skinAccent: 'color(srgb-linear 0.04 0.028 0.06)',
  post: POST,
  // No lava, crevice or floor glow, no embers; the opening and the shafts as Task 3 had them.
  glow: { lava: 0, back: 0, crevice: 0, floor: 0, embers: 0, top: 1, rays: 1.2 },
  relics,
  palette,
  floor: { material: 'sand' },
  lights: {
    surface: { color: '#7aa8ff', intensity: 1.0, position: [3, 24, -10], target: [0, layout.floorY, -8] },
    fill: { color: '#8a8cff', intensity: 1.0, position: [-1.5, 10, 2] },
    points: [...membraneLights, ...emberLights, ...orangeCoralLights, ...magentaCoralLights, ...pathLights],
  },
  // The surface's bright patch toward the top right, as P2 is lit.
  water: { fogDensity: 0.034, surfaceDir: [0.3, 0.3, -0.9], environmentIntensity: 0.06, causticStrength: 0.005, colours: WATER_COLOURS, environment: WATER_ENVIRONMENT },
  // Rising bubbles, violet motes, rays, far fish and the jellyfish (spec 7.7); no snow (not in the spec's list, and a cost: 7.16), no embers.
  live: { snow: 0, motes: 1, fish: 0.5, rays: 1, bubbles: 1, embers: 0, colours: LIVE_COLOURS, elements: { jellyfish: JELLYFISH } },
};
