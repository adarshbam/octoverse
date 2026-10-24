// How a stage lights the character: one strong key light, one crisp rim (the character's neon
// edge, in its palette), one subtle warm underglow from below, gentle bounce light from the
// water above and the lava below, and haze that blends the far parts into the water.

export interface StageLighting {
  /** The key: direction toward the light (world), colour, intensity, and how far it wraps round into the shadow side. */
  key: { direction: readonly [number, number, number]; color: string; intensity: number; wrap: number };
  /** Warm light from below that glows through thin flesh: colour, intensity, wrap. */
  underglow: { color: string; intensity: number; wrap: number };
  /** Bounce light: from above (the water) and from below (the ruin's lava glow). */
  ambient: { sky: string; ground: string; intensity: number };
  /** Haze: parts lying `near` to `far` units behind the body blend toward `color` by up to `strength`. */
  haze: { color: string; near: number; far: number; strength: number };
}

export const INTRO_LIGHTING: StageLighting = {
  key: { direction: [-0.3, 0.95, 0.1], color: '#efe4ff', intensity: 1.0, wrap: 0.18 },
  underglow: { color: '#ff4a3c', intensity: 0.42, wrap: 0.6 },
  ambient: { sky: '#26309a', ground: '#8a1428', intensity: 0.2 },
  haze: { color: '#1a0c30', near: 0.15, far: 0.9, strength: 0.4 },
};
