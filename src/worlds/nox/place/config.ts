import type { Placement, Vec3, WorldConfig, WorldLight } from '../../../engine/world/types';
import { asWorldLayout } from '../../../engine/world/validateWorld';
import farData from './far.json';
import layoutData from './layout.json';

// The security realm: a ruined corridor of rune pillars, boulders, coral and chains under deep
// water, lit red from the glyphs and the lava below and blue from the surface. The layout is
// data (layout.json), the single source: the Blender kit script (blender/security/build_kit.py)
// reads the same file. The rest is read by `WorldScene`.

/** Checked against the `WorldLayout` schema as it loads, so a bad edit fails here by name. */
const layout = asWorldLayout(layoutData);

const palette = {
  stone: '#343c5a',
  glyph: '#ff2436',
  coral: '#ff1a30',
  lava: '#ff3418',
  waterFar: '#071535',
  floor: '#1d1218',
  /**
   * The seabed's lava light as linear amounts (colour.ts): the cracks' glow, the lava under the
   * rubble, the puddles' red sheen, and the glow in the rocks' pores.
   */
  floorGlow: {
    cracks: 'color(srgb-linear 1 0.09 0.05)',
    lava: 'color(srgb-linear 1 0.12 0.04)',
    sheen: 'color(srgb-linear 1 0.1 0.05)',
    pores: 'color(srgb-linear 1 0.16 0.05)',
  },
};

/**
 * Height of each pillar piece's glyph column (the mean of its glyph panels' centres) above the
 * piece's base, in stage units. The kit script sets these and writes them into the kit file as
 * `glyph_centre`; validateWorld.test checks the two agree.
 */
const GLYPH_CENTRE: Record<string, number> = { pillar_a: 3.59, pillar_b: 3.82, pillar_c: 1.78, pillar_d: 2.36 };
/** A glyph light stands this far in front of its pillar's axis (the glyph face is at about 0.5). */
const GLYPH_LIGHT_REACH = 0.985;

/** A lit pillar's glyph light: before its glyph column, turned with the pillar. */
function glyphLightPosition(pillar: Placement): Vec3 {
  const centre = GLYPH_CENTRE[pillar.piece];
  if (centre === undefined) throw new Error(`lit pillar ${pillar.piece} has no glyph column`);
  const [x, y, z] = pillar.position;
  const rot = pillar.rotY ?? 0;
  return [x + Math.sin(rot) * GLYPH_LIGHT_REACH, y + centre, z + Math.cos(rot) * GLYPH_LIGHT_REACH];
}

// Glyph light: short on the stone, so the red stays round the panels; Nox's skin carries it further.
const glyphLights: WorldLight[] = (layout.groups.pillars ?? [])
  .filter(p => p.light)
  .map(p => ({ kind: 'glyph', position: glyphLightPosition(p), color: palette.glyph, intensity: 1.7, distance: 2.1, skinRange: 4.4 }));
// Lava light: pools low round the coral at each lower corner, and at the near pillars' feet.
const lavaLights: WorldLight[] = layout.coralLights.map(position => ({ kind: 'lava', position, color: palette.lava, intensity: 3.4, distance: 5, skinRange: 6 }));

/**
 * The relics glow a little more than in the test scene (the owner: "just a little more", still
 * subtle): 1.2 times its glyph panels (2.4), coral (1.7) and glyph light on the stone (1.7). The
 * glyph light's spill is baked by blender/security/bake_world.py, which records it in near.glb.
 */
const RELIC_RISE = 1.2;

/** The lower third and top fixes (see WorldConfig.glow); bake_world.py's LAVA_RISE and BACK_LIGHT carry the baked two. */
const GLOW = { lava: 1.4, back: 1.0, crevice: 1.8, floor: 1.4, embers: 2.2, top: 1.5, rays: 1.6 };

/**
 * How Nox's skin takes the world's light: warm and pink, through the flesh (the test scene's
 * balance at 0.2 of its strength). Four times Task 3's start, so the warmth reads on the arms'
 * undersides (panel 2's red band); the cap bounds the brightest patches, and the light still falls
 * off from the lava corners. Linear components (0.052, 0.0252, 0.06), which hex cannot hold exactly.
 */
const SKIN_WARMTH = 'color(srgb-linear 0.052 0.0252 0.06)';
/** The caustics' share of the surface light on Nox's skin: the bright lines reach their cap, the gaps stay well under it. */
const CAUSTIC_STRENGTH = 0.005;

/** Post-processing for the stage: contact shadows, then threshold-based bloom, then a vignette. There is deliberately no tone-mapping pass. */
const POST: WorldConfig['post'] = {
  /**
   * Soft shadows where arms cross each other and pass under the head. The character sits about
   * 11.4 to 12.6 from the camera; the backdrop plate, at 15, is never shaded.
   */
  contactShadow: { reach: 0.22, minGap: 0.04, maxGap: 1.0, near: 10.8, far: 13.6, strength: 0.6, color: '#1a0418' },
  bloom: { luminanceThreshold: 0.66, luminanceSmoothing: 0.25, intensity: 1.05, radius: 0.85 },
  /** Darker corners in the 3D world: the ruin falls away into the dark, as in panel 2. */
  vignette: { offset: 0.3, darkness: 0.9 },
};

/**
 * The water's own colours: deep navy below, a blue zenith, the surface's blue glow leaning cyan at
 * the opening, blue shafts leaning cyan as their fan widens, and dark fish against the glow.
 */
const WATER_COLOURS: WorldConfig['water']['colours'] = {
  deep: '#03050f',
  zenith: '#0c2468',
  glow: '#3f8cff',
  opening: '#3fd0ff',
  rays: '#4f86ff',
  raysWide: '#4fc0ff',
  fish: '#0c1838',
};

/** What wet stone, iron, skin and the orbs mirror: bright blue from the surface, deep navy round the horizon, near black below, and the seabed's red glow in patches. */
const WATER_ENVIRONMENT: WorldConfig['water']['environment'] = { top: '#2a5cff', horizon: '#0a1840', low: '#0b0712', seabedGlow: '#ff2030' };

/** The live elements' own colours: pink-rimmed violet bubbles, crimson embers and red motes with hot orange ones, pale blue snow. */
const LIVE_COLOURS: WorldConfig['live']['colours'] = {
  bubbles: { rim: '#ff6a9a', tint: '#7a4aa8' },
  embers: { color: '#ff2c3c', hot: '#ff8a5a' },
  motes: { color: '#ff2238', hot: '#ff9a6a' },
  snow: '#a8c0ff',
};

export const SECURITY_WORLD: WorldConfig = {
  id: 'security',
  kit: {
    url: '/nox/world/security/kit.glb',
    pieces: ['pillar_a', 'pillar_b', 'pillar_c', 'pillar_d', 'rock_0', 'rock_1', 'rock_2', 'rock_3', 'rock_4', 'coral_0', 'coral_1', 'coral_2', 'chain'],
  },
  near: { url: '/nox/world/security/near.glb' },
  // far-0 is the farthest layer, as far.json orders them (blender/security/render_far.py writes the files).
  farPlate: { cutZ: farData.cutZ, layers: farData.layers.map((layer, i) => ({ url: `/nox/world/security/far-${i}.ktx2`, z: layer.z })) },
  layout,
  // Radians; tuned in the capture until the near pillars' edges lean as panel 2's do. The drift is the test scene's: full amount, its own pace.
  camera: { tilt: 0.07, hover: { amount: 1, pace: 1 } },
  skinAccent: SKIN_WARMTH,
  post: POST,
  glow: GLOW,
  relics: { glyph: 2.4 * RELIC_RISE, coral: 1.7 * RELIC_RISE, spill: RELIC_RISE },
  palette,
  lights: {
    surface: { color: '#6f9cff', intensity: 1.1, position: [0.6, 24, -10], target: [0, layout.floorY, -8] },
    fill: { color: '#6f8fff', intensity: 1.1, position: [-1.5, 10, 2] },
    points: [...glyphLights, ...lavaLights],
  },
  water: { fogDensity: 0.034, surfaceDir: [0.03, 0.45, -0.89], environmentIntensity: 0.06, causticStrength: CAUSTIC_STRENGTH, colours: WATER_COLOURS, environment: WATER_ENVIRONMENT },
  live: { snow: 1, motes: 1, fish: 1, rays: 1, bubbles: 1, embers: 1, colours: LIVE_COLOURS },
};
