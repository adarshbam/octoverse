import type { Placement, Vec3, WorldConfig, WorldLight } from '../types';
import { asWorldLayout } from '../validateWorld';
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
  floor: '#15161f',
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
const glyphLights: WorldLight[] = layout.pillars
  .filter(p => p.light)
  .map(p => ({ kind: 'glyph', position: glyphLightPosition(p), color: palette.glyph, intensity: 1.7, distance: 2.1, skinRange: 4.4 }));
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
