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
  layout: WorldLayout;
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
