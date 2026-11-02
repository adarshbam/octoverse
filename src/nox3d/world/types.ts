// A world is data: the kit it is built from, where the pieces stand, its colours and lights,
// and how much of each live element it carries. A new world is a new config, not new rendering.

/** x, y, z in stage units. The camera looks down -z, so z < 0 is beyond Nox. */
export type Vec3 = readonly [number, number, number];

export interface Placement {
  /** Name of a piece in the kit. */
  piece: string;
  position: Vec3;
  rotY?: number;
  /** Lean from upright, about z (ruins settle). */
  tilt?: number;
  scale?: number | Vec3;
  /** Which rune set the glyph panels carry. */
  runes?: number;
  /** Near pillars light the stage from their glyphs. */
  light?: boolean;
}

/** A point light in world space. The patch it makes on Nox's skin reaches `skinRange`, further than on stone. */
export interface WorldLight {
  kind: 'glyph' | 'coral' | 'lava';
  position: Vec3;
  color: string;
  intensity: number;
  /** Reach on stone, in stage units. */
  distance: number;
  /** Reach on Nox's skin, in stage units. */
  skinRange: number;
}

export interface WorldLayout {
  /** Height of the seabed's mean level. */
  floorY: number;
  pillars: Placement[];
  rocks: Placement[];
  /** Coral; `y` is found by dropping each piece onto whatever is below it. */
  corals: Placement[];
  /** Chains hanging between two points, sagging by `sag` at the middle. */
  chains: { from: Vec3; to: Vec3; sag: number }[];
  /** Where the lava's red light pools, low round the coral. */
  coralLights: Vec3[];
}

export interface WorldConfig {
  id: string;
  /** The glTF file, and the pieces in it the layout may name. */
  kit: { url: string; pieces: readonly string[] };
  /**
   * The baked near world (blender/security/bake_world.py): the kit's pieces with a lightmap UV set,
   * their lightmaps and a record of the bake. When it is there the page loads it in place of the
   * kit, and the glyph, lava and fill light on the stone and seabed come from its lightmaps instead
   * of real-time lights.
   */
  near?: { url: string };
  /**
   * The ruin beyond the near world as transparent cards (blender/security/render_far.py), farthest
   * first. When it is there the near world leaves out the pieces beyond `FAR_CUT_Z` (farPlate.ts),
   * and a layer that fails to load leaves its range to the water's fog.
   */
  farPlate?: { layers: readonly { url: string; z: number }[] };
  layout: WorldLayout;
  /**
   * How the relics (glyph panels and glowing coral) glow: `glyph` multiplies a panel's white before
   * its own brightness, `coral` the coral's red, and `spill` the glyph light that the bake lays on
   * the stone round them. The WorldLight data for Nox's accents does not rise with them.
   */
  relics: { glyph: number; coral: number; spill: number };
  palette: { stone: string; glyph: string; coral: string; lava: string; waterFar: string; floor: string };
  lights: {
    /** From the surface, high above and beyond the stage: shadows, and caustics in its cookie. */
    surface: { color: string; intensity: number; position: Vec3; target: Vec3 };
    /** A cool fill from overhead. */
    fill: { color: string; intensity: number; position: Vec3 };
    points: WorldLight[];
  };
  /** `surfaceDir` points at the brightest patch of surface; the sky, the water's reflections and its rays follow it. */
  water: { fogDensity: number; surfaceDir: Vec3; environmentIntensity: number };
  /** The share (0 to 1) of each live element that is drawn: 1 is the full amount. */
  live: { snow: number; motes: number; fish: number; rays: number; bubbles: number; embers: number };
}
