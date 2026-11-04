import type { WorldConfig } from '../../../engine/world/types';
import { asWorldLayout } from '../../../engine/world/validateWorld';

// The drowned observatory's stage backdrop (spec 7.7): for now only the water. The kit is an
// empty glb and the layout has no pieces, so the stage shows Aether in indigo water, with the
// engine's own live elements (star motes, bubbles, rays). The ruin towers, the brain portal, the
// coral, the jellyfish and the path arrive with Task 8 onward: `place/layout.json` and `kit.glb` (Task 8) are checked by `layout.test.ts`, and Task 9 switches this stage to them. There is
// no lava and no red light anywhere in her world: the seabed's glow is black (none), no point
// lights, no embers.

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
