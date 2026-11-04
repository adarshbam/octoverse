// A world is data: the kit it is built from, where the pieces stand, its colours and lights,
// and how much of each live element it carries. A new world is a new config, not new rendering.

import type { ContactShadowSettings } from './contactShadowEffect';

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

/**
 * A point light in world space. The patch it makes on Nox's skin reaches `skinRange`, further than on stone.
 * `kind` names what the light is, as a string a world may choose (`validateWorld` still knows
 * 'glyph' and 'lava': it counts those against the lit pillars and the coral lights).
 */
export interface WorldLight {
  kind: string;
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
   * first. When it is there the near world leaves out the pieces beyond `cutZ` (farPlate.ts),
   * and a layer that fails to load leaves its range to the water's fog.
   */
  farPlate?: { cutZ: number; layers: readonly { url: string; z: number }[] };
  layout: WorldLayout;
  /**
   * The camera's lean: it pitches up by `tilt` radians (a low camera looking up, so the pillars
   * converge toward the top as in panel 2) and shifts its frame down by the matching lens shift
   * (lensShift.ts), so Nox's face stays where the unleaned camera had it. `hover` is the drift
   * (cameraHover.ts): `amount` multiplies the stage's hover amount (1 is the test scene's drift)
   * and `pace` the drift's clock (1 is Nox's; 0.5 drifts half as fast).
   */
  camera: { tilt: number; hover: { amount: number; pace: number } };
  /**
   * The colour the world's light puts on the skin of the character: warm and pink through the
   * flesh, as `uAccentWarmth` takes it. A CSS colour, or `color(srgb-linear r g b)` for one that
   * 8-bit hex cannot say (colour.ts).
   */
  skinAccent: string;
  /** Post-processing for the world: contact shadows, then bloom, then a vignette. There is deliberately no tone-mapping pass. */
  post: {
    /** Soft shadows where arms cross each other and pass under the head, within `near` to `far` of the camera. */
    contactShadow: ContactShadowSettings;
    /** Threshold-based bloom. */
    bloom: { luminanceThreshold: number; luminanceSmoothing: number; intensity: number; radius: number };
    /** Darker corners in the 3D world. */
    vignette: { offset: number; darkness: number };
  };
  /**
   * How the relics (glyph panels and glowing coral) glow: `glyph` multiplies a panel's white before
   * its own brightness, `coral` the coral's red, and `spill` the glyph light that the bake lays on
   * the stone round them. The WorldLight data for Nox's accents does not rise with them.
   */
  relics: { glyph: number; coral: number; spill: number };
  palette: { stone: string; glyph: string; coral: string; lava: string; waterFar: string; floor: string; floorGlow: FloorGlow };
  lights: {
    /** From the surface, high above and beyond the stage: shadows, and caustics in its cookie. */
    surface: { color: string; intensity: number; position: Vec3; target: Vec3 };
    /** A cool fill from overhead. */
    fill: { color: string; intensity: number; position: Vec3 };
    points: WorldLight[];
  };
  /**
   * The look fixes of the test scene, each a multiplier on what that part had (1 is the test
   * scene): `lava` the lava lights baked on the stone and seabed (the WorldLight data Nox's skin
   * takes does not rise), `back` the red lights behind the front rock heaps that rim them, `crevice`
   * the glow in the rocks' pores, `floor` the seabed's lava cracks and glow, `embers` how many
   * embers drift, `top` the cyan opening at the surface and `rays` how many light shafts fan down.
   */
  glow: { lava: number; back: number; crevice: number; floor: number; embers: number; top: number; rays: number };
  /**
   * `surfaceDir` points at the brightest patch of surface; the sky, the water's reflections and its
   * rays follow it. `causticStrength` is the caustics' share of the surface light on the character's
   * skin: the bright lines reach their cap, the gaps stay well under it. `colours` are the water's
   * own (the sky sphere, the shafts, the far fish) and `environment` the light every reflective
   * surface mirrors.
   */
  water: { fogDensity: number; surfaceDir: Vec3; environmentIntensity: number; causticStrength: number; colours: WaterColours; environment: WaterEnvironment };
  /** The share (0 to 1) of each live element that is drawn: 1 is the full amount. */
  live: { snow: number; motes: number; fish: number; rays: number; bubbles: number; embers: number };
}

/**
 * The seabed's own light (Floor.tsx, and the rocks' pores in Kit.tsx), each a colour the shader
 * compiles in (`#rrggbb`, or `color(srgb-linear r g b)` for an amount of light hex cannot say;
 * colour.ts): `cracks` glows in the floor's cracks and round them, `lava` under the rubble at the
 * sides, `sheen` is that glow mirrored by the wet puddles, `pores` the glow in the rocks' pores.
 * Black is no glow; the sheen also goes with `glow.floor` at 0 (nothing to mirror). Each is
 * scaled by its `glow.*` fix (floor or crevice), the sheen by none.
 */
export interface FloorGlow {
  cracks: string;
  lava: string;
  sheen: string;
  pores: string;
}

/** The water's own colours (Water.tsx), each `#rrggbb`. */
export interface WaterColours {
  /** The sky sphere below the horizon: the deep water under the ruin (`palette.waterFar` is its horizon). */
  deep: string;
  /** The sky sphere toward the surface overhead. */
  zenith: string;
  /** The surface's glow round its brightest patch, its ripples and its far shafts. */
  glow: string;
  /** What the glow leans toward at the very top of the frame as `glow.top` rises above 1 (the opening). */
  opening: string;
  /** The light shafts, and the colour they lean toward as `glow.rays` widens their fan above 1. */
  rays: string;
  raysWide: string;
  /** The far school of fish, dark against the glow. */
  fish: string;
}

/**
 * The water's light from every direction (textures.ts `makeWaterEnvironment`), which wet stone,
 * iron, the skin and the orbs mirror: `top` from the surface (and its sun patch), `horizon` round
 * the middle, `low` toward the seabed, each `#rrggbb`; `seabedGlow` is a glow in patches along the
 * seabed band, or null for none (no seabed glow, the reflections kept).
 */
export interface WaterEnvironment {
  top: string;
  horizon: string;
  low: string;
  seabedGlow: string | null;
}
