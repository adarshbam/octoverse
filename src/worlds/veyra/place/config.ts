import type { WorldConfig } from '../../../engine/world/types';

// The stage backdrop (spec 10.1): until the vault world exists, Veyra stands on a graded water
// backdrop fitted to P2's samples (the upper water 3, 73, 106 and the mid water 4, 23, 33 of the
// native panel; src/worlds/veyra/review/targets.json), with her own aura and local grade on. The
// kit is a glTF with one empty scene (blender/vault/empty_kit.py) and the layout names no piece, so
// there is no stone, no baked near world (the kit's real-time-lit level) and no far plate. There is
// no lava and no red light anywhere. Tasks 7 to 9 replace this with the vault: the kit, the bake,
// the far plate and the light; the water's colours and fog are fitted again there.

const layout: WorldConfig['layout'] = { floorY: -2.45, groups: {}, chains: [], coralLights: [] };

const palette = {
  stone: '#22403f',
  glyph: '#3fe0c5',
  // The one warm accent the vault will carry (orange-yellow coral).
  coral: '#e8a030',
  // The fog and the sky's horizon: the mid water of P2, a little lifted so it reads at a distance.
  waterFar: '#020b10',
  floor: '#0c1c20',
  // No seabed glow: no cracks, no lava, no sheen, no pores.
  floorGlow: {
    cracks: 'color(srgb-linear 0 0 0)',
    lava: 'color(srgb-linear 0 0 0)',
    sheen: 'color(srgb-linear 0 0 0)',
    pores: 'color(srgb-linear 0 0 0)',
  },
};

/** Soft shadows where arms cross and pass under the head; Nox's reach and range (the character sits at the same distance), in a deep teal. */
const POST: WorldConfig['post'] = {
  contactShadow: { reach: 0.22, minGap: 0.04, maxGap: 1.0, near: 10.8, far: 13.6, strength: 0.6, color: '#041c24' },
  bloom: { luminanceThreshold: 0.8, luminanceSmoothing: 0.2, intensity: 0.4, radius: 0.6 },
  vignette: { offset: 0.3, darkness: 0.9 },
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

export const VAULT_STAGE: WorldConfig = {
  id: 'vault-stage',
  kit: { url: '/veyra/world/stage.glb', pieces: [] },
  layout,
  // A slight upward lean (spec 7.7, smaller than Nox's 0.07) and a calmer drift: 0.8 of his amount at 0.75 of his pace.
  camera: { tilt: 0.04, hover: { amount: 0.8, pace: 0.75 } },
  // The world's light on her skin: a faint cool teal, never warm.
  skinAccent: 'color(srgb-linear 0.01 0.04 0.045)',
  post: POST,
  // No lava, no crevice or floor glow, no embers; the opening at the top and the shafts at their natural size.
  glow: { lava: 0, back: 0, crevice: 0, floor: 0, embers: 0, top: 1, rays: 1 },
  relics: { glyph: 1, coral: 1, spill: 1 },
  palette,
  lights: {
    surface: { color: '#4fc8ff', intensity: 1.1, position: [0.6, 24, -10], target: [0, layout.floorY, -8] },
    fill: { color: '#4fb8e0', intensity: 1.1, position: [-1.5, 10, 2] },
    points: [],
  },
  water: { fogDensity: 0.034, surfaceDir: [0.03, 0.45, -0.89], environmentIntensity: 0.06, causticStrength: 0.005, colours: WATER_COLOURS, environment: WATER_ENVIRONMENT },
  live: { snow: 1, motes: 1, fish: 1, rays: 1, bubbles: 1, embers: 0, colours: LIVE_COLOURS },
};
