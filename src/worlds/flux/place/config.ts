import type { WorldConfig } from '../../../engine/world/types';

// "Pipeline Deep", first pass (Task 2): the stage backdrop. An empty kit (public/flux/world/stage.glb,
// blender/pipeline/empty_kit.py), no layout and no baked near world or far plate, so Flux shows on
// dark navy water fitted to P2: the mid water beside him is (0, 16, 45) and the lit water toward the
// shaft at the upper right is (1, 74, 136). The kit, layout, light and live elements of spec 7.7
// replace this in the world tasks. No red anywhere: the seabed has no glow and no embers drift.

/** P2's mid water, and its lit upper water, as sRGB hex. */
const MID_WATER = '#00102d';
const UPPER_WATER = '#014a88';

const palette: WorldConfig['palette'] = {
  stone: '#1c2c4c',
  glyph: '#4aa6d0',
  coral: '#c070f0',
  lava: '#7050f0',
  waterFar: MID_WATER,
  floor: '#0a1224',
  // No seabed glow yet: black is none.
  floorGlow: {
    cracks: 'color(srgb-linear 0 0 0)',
    lava: 'color(srgb-linear 0 0 0)',
    sheen: 'color(srgb-linear 0 0 0)',
    pores: 'color(srgb-linear 0 0 0)',
  },
};

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

/** The live elements' own colours: blue-violet bubbles, blue motes, cool snow; no embers (they stay at 0). */
const LIVE_COLOURS: WorldConfig['live']['colours'] = {
  bubbles: { rim: '#8ab4ff', tint: '#5a50d0' },
  embers: { color: '#4aa6d0', hot: '#a0d8ff' },
  motes: { color: '#4a90e8', hot: '#a0c8ff' },
  snow: '#a8d0ff',
};

export const PIPELINE_STAGE: WorldConfig = {
  id: 'pipeline-stage',
  kit: { url: '/flux/world/stage.glb', pieces: [] },
  layout: { floorY: -2.45, pillars: [], rocks: [], corals: [], chains: [], coralLights: [] },
  // The camera leans up as Nox's (radians), and drifts a little livelier: the shared hover at his
  // amount, at 1.2 times his pace (spec 7.7).
  camera: { tilt: 0.07, hover: { amount: 1, pace: 1.2 } },
  // The light through the skin: a faint violet, never warm (no red anywhere in the pipeline world).
  skinAccent: 'color(srgb-linear 0.03 0.02 0.07)',
  post: POST,
  glow: { lava: 0, back: 0, crevice: 0, floor: 0, embers: 0, top: 1.5, rays: 1.2 },
  relics: { glyph: 1, coral: 1, spill: 1 },
  palette,
  lights: {
    // Cool blue shafts from the upper right, and a cool fill from overhead.
    surface: { color: '#6fa8ff', intensity: 1.1, position: [6, 24, -10], target: [0, -2.45, -8] },
    fill: { color: '#6f8fff', intensity: 1.1, position: [-1.5, 10, 2] },
    points: [],
  },
  water: { fogDensity: 0.034, surfaceDir: [0.35, 0.5, -0.8], environmentIntensity: 0.06, causticStrength: 0.005, colours: WATER_COLOURS, environment: WATER_ENVIRONMENT },
  live: { snow: 1, motes: 0.6, fish: 1, rays: 1, bubbles: 1, embers: 0, colours: LIVE_COLOURS },
};
