import type { Vec3, WorldConfig, WorldLayout, WorldLight } from '../types';
import layoutData from './layout.json';

// The security realm: a ruined corridor of rune pillars, boulders, coral and chains under deep
// water, lit red from the glyphs and the lava below and blue from the surface. The layout is
// data (layout.json), shared with the Blender kit scripts; the rest is read by `WorldScene`.

/** JSON reads positions as plain number arrays; in the layout they are always x, y, z. */
const layout = layoutData as unknown as WorldLayout;

const palette = {
  stone: '#343c5a',
  glyph: '#ff2436',
  coral: '#ff1a30',
  lava: '#ff3418',
  waterFar: '#071535',
  floor: '#15161f',
};

/** Where each lit pillar's glyph panels stand off the stone: found from the kit, in stage units. */
const GLYPH_LIGHT_POSITIONS: Vec3[] = [
  [-3.3126, -0.09, -0.4246],
  [-3.4483, 1.37, -4.5199],
  [3.6517, 1.37, -0.6199],
  [3.1787, 1.14, -5.5182],
];

// Glyph light: short on the stone, so the red stays round the panels; Nox's skin carries it further.
const glyphLights: WorldLight[] = GLYPH_LIGHT_POSITIONS.map(position => ({ kind: 'glyph', position, color: palette.glyph, intensity: 1.7, distance: 2.1, skinRange: 4.4 }));
// Lava light: pools low round the coral at each lower corner, and at the near pillars' feet.
const lavaLights: WorldLight[] = layout.coralLights.map(position => ({ kind: 'lava', position, color: palette.lava, intensity: 3.4, distance: 5, skinRange: 6 }));

export const SECURITY_WORLD: WorldConfig = {
  id: 'security',
  kit: {
    url: '/nox/world/security/kit.glb',
    pieces: ['pillar_a', 'pillar_b', 'pillar_c', 'pillar_d', 'rock_0', 'rock_1', 'rock_2', 'rock_3', 'rock_4', 'coral_0', 'coral_1', 'coral_2', 'chain'],
  },
  layout,
  palette,
  lights: {
    surface: { color: '#6f9cff', intensity: 2.2, position: [0.6, 24, -10], target: [0, layout.floorY, -8] },
    fill: { color: '#6f8fff', intensity: 2.2, position: [-1.5, 10, 2] },
    points: [...glyphLights, ...lavaLights],
  },
  water: { fogDensity: 0.034, surfaceDir: [0.03, 0.45, -0.89], environmentIntensity: 0.4 },
  live: { snow: 1, motes: 1, fish: 1, rays: 1, bubbles: 1, embers: 1 },
};
