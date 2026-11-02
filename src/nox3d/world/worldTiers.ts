import type { QualityTier } from '../stage/quality';

/** What the world draws at a quality tier. `high` is the full world; lower tiers thin it out. */
export interface WorldTier {
  /** Share of the ambient bubbles and embers drawn. */
  particles: number;
  /** Share of the light shafts drawn. */
  rays: number;
  /** Side of the surface light's shadow map, in texels. Only Nox casts into it (a pure measure of the cost). */
  shadowMap: number;
  /** Scale of the far plate's textures (the mip level it loads from). */
  plateScale: number;
  /** The school of far fish. */
  fish: boolean;
  /** The red motes off the seabed. */
  motes: boolean;
}

export const WORLD_TIERS: Record<QualityTier, WorldTier> = {
  high: { particles: 1, rays: 1, shadowMap: 2048, plateScale: 1, fish: true, motes: true },
  medium: { particles: 0.6, rays: 0.6, shadowMap: 1024, plateScale: 0.75, fish: true, motes: false },
  low: { particles: 0.35, rays: 0.4, shadowMap: 1024, plateScale: 0.5, fish: false, motes: false },
};

/**
 * Whether the stone and iron cast into the surface light's shadow map. At the 1024 tiers only
 * Nox does: the ruin's own shadows are the first thing the lower tiers give up (lever 1).
 */
export const stoneCastsShadow = (tier: WorldTier) => tier.shadowMap > 1024;

/**
 * Whether the stone and seabed draw their baked relief and its specular (per-fragment extras, R36):
 * the full world only. Its own decision; it shares only the test with the shadows, by the tier whose
 * surface light has the large shadow map.
 */
export const reliefShown = (tier: WorldTier) => tier.shadowMap > 1024;
