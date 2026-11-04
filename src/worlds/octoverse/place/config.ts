import type { WorldConfig } from '../../../engine/world/types';

// The host's stage backdrop: open indigo water, no kit (the reef, spec 7.7, comes later). With no
// kit file the world draws its water, fog and light only (the engine's last world level). The
// water is fitted to P2's water samples (spec 2.1): just outside the head (2, 22, 72), mid water
// (20, 30, 95), and the lit water top right (16, 129, 219); indigo, not black.

/** Nothing stands on the stage: no pieces, no lights of the kit's kinds. */
const LAYOUT: WorldConfig['layout'] = { floorY: -3, pillars: [], rocks: [], corals: [], chains: [], coralLights: [] };

/**
 * The water's own colours: deep indigo below, a lit blue surface glow toward the top right. Task 3
 * brightened the zenith and the glow toward P2's lit top right (upper water delta E 18.3 to 11.0);
 * the darker water round the host stays within delta E 10.
 */
const WATER_COLOURS: WorldConfig['water']['colours'] = {
  deep: '#020a2c',
  zenith: '#0a50e8',
  glow: '#20a8ff',
  opening: '#3cb4ff',
  rays: '#2a86e8',
  raysWide: '#4cb0ff',
  fish: '#08103a',
};

export const REEF_STAGE: WorldConfig = {
  id: 'reef-stage',
  // No kit: no file, no pieces.
  // TODO(kitless): the empty url fails to load (two page errors) and the world steps down to its last
  // level, water, fog and light (ruling R13). Replace with the reef kit in Task 5; until then stills
  // come from scripts/platform-capture.mjs, which accepts this world's missing kit.
  kit: { url: '', pieces: [] },
  layout: LAYOUT,
  // A straight-on camera, as P2 is painted; Nox's drift amount at 0.85 of his pace (calmer).
  camera: { tilt: 0, hover: { amount: 1, pace: 0.85 } },
  // The reef's light on the host's skin: a faint violet-peach warmth.
  skinAccent: 'color(srgb-linear 0.04 0.028 0.06)',
  post: {
    contactShadow: { reach: 0.22, minGap: 0.04, maxGap: 1.0, near: 10.8, far: 13.6, strength: 0.5, color: '#140a30' },
    bloom: { luminanceThreshold: 0.66, luminanceSmoothing: 0.25, intensity: 1.0, radius: 0.85 },
    vignette: { offset: 0.3, darkness: 0.7 },
  },
  // No relics on an empty stage; the values only need to be valid.
  relics: { glyph: 1, coral: 1, spill: 1 },
  glow: { lava: 1, back: 1, crevice: 1, floor: 0, embers: 0, top: 1, rays: 1.2 },
  palette: {
    stone: '#2a2a5a',
    glyph: '#b48cff',
    coral: '#ff8a6a',
    lava: '#ff9a5a',
    // The horizon of the water's sky: P2's mid water.
    waterFar: '#141e5f',
    floor: '#120c28',
    // No seabed glow.
    floorGlow: { cracks: 'color(srgb-linear 0 0 0)', lava: 'color(srgb-linear 0 0 0)', sheen: 'color(srgb-linear 0 0 0)', pores: 'color(srgb-linear 0 0 0)' },
  },
  lights: {
    surface: { color: '#7aa8ff', intensity: 1.0, position: [3, 24, -10], target: [0, -3, -8] },
    fill: { color: '#8a8cff', intensity: 1.0, position: [-1.5, 10, 2] },
    points: [],
  },
  // The surface's bright patch toward the top right, as P2 is lit.
  water: { fogDensity: 0.034, surfaceDir: [0.3, 0.3, -0.9], environmentIntensity: 0.06, causticStrength: 0.005, colours: WATER_COLOURS, environment: { top: '#3a8cff', horizon: '#101c58', low: '#080a20', seabedGlow: null } },
  // Bubbles and rays as in P2; no embers or motes (no lava on this stage); a little snow and far fish.
  live: {
    snow: 0.6,
    motes: 0,
    fish: 0.5,
    rays: 1,
    bubbles: 1,
    embers: 0,
    colours: { bubbles: { rim: '#b4a0ff', tint: '#5a4ab0' }, embers: { color: '#ffb070', hot: '#ffd8a0' }, motes: { color: '#c8a0ff', hot: '#ffd0b0' }, snow: '#c8d4ff' },
  },
};
