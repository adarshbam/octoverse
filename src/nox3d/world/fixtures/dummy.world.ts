import type { Placement, WorldConfig } from '../types';
import { SECURITY_WORLD } from '../security/config';

// A second world made of configuration alone (Task 26): the security kit's pieces under another
// palette and a mirrored, sparser layout. It leaves out the baked near world and the far plate, so
// the page builds it from the kit and the layout. Test and development only (see dummy.character.ts).
const mirror = (p: Placement): Placement => ({ ...p, position: [-p.position[0], p.position[1], p.position[2]], rotY: -(p.rotY ?? 0) });
const base = SECURITY_WORLD.layout;

const palette = { stone: '#3c4a3c', glyph: '#30e0c0', coral: '#e8b010', lava: '#e89c10', waterFar: '#052a30', floor: '#14201c' };
// No pillar is lit (so no glyph lights); each coral light keeps a lava light.
const layout = {
  ...base,
  pillars: base.pillars.filter((_, i) => i % 2 === 0).map(mirror).map(({ light: _light, ...p }) => p),
  rocks: base.rocks.map(mirror),
  corals: base.corals.map(mirror),
  chains: base.chains.map(c => ({ ...c, from: [-c.from[0], c.from[1], c.from[2]] as const, to: [-c.to[0], c.to[1], c.to[2]] as const })),
  coralLights: base.coralLights.map(([x, y, z]) => [-x, y, z] as const),
};

export const DUMMY_WORLD: WorldConfig = {
  ...SECURITY_WORLD,
  id: 'dummy',
  near: undefined,
  farPlate: undefined,
  layout,
  relics: { glyph: 2, coral: 1.5, spill: 1 },
  palette,
  lights: {
    surface: { color: '#8cf0d8', intensity: 1.0, position: [-0.6, 24, -10], target: [0, base.floorY, -8] },
    fill: { color: '#6fd0c0', intensity: 1.0, position: [1.5, 10, 2] },
    points: SECURITY_WORLD.lights.points.filter(l => l.kind === 'lava').map((l, i) => ({ ...l, color: palette.lava, position: layout.coralLights[i] })),
  },
  water: { fogDensity: 0.05, surfaceDir: [-0.03, 0.45, -0.89], environmentIntensity: 0.08, causticStrength: 0.006 },
  // A cooler skin accent, a slower and gentler drift, and a heavier vignette: all configuration.
  skinAccent: '#2c6a60',
  camera: { tilt: 0.05, hover: { amount: 0.6, pace: 0.5 } },
  post: { ...SECURITY_WORLD.post, vignette: { offset: 0.25, darkness: 1.0 } },
};
