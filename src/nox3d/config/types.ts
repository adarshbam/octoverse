// Everything that makes one octopus look and behave like itself. The renderer
// reads only these values; a new character is a new config, not new code.
// Units are world units (1 unit = 100 storyboard panel px, +y up).

export const ARM_IDS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'] as const;
export type ArmId = (typeof ARM_IDS)[number];
export type Point2 = readonly [number, number];
export type StageId = 'entering' | 'intro' | 'overview' | 'techFocus' | 'detail';

/**
 * The lower face's side lobes. They stick out below the dome, hold the blush,
 * and carry the head's outline down into the neck and arms.
 */
export interface CheekShape {
  /** Height (world y) where the lobe starts under the dome: the notch in the outline. */
  top: number;
  /** Height of the lobe's fullest point. */
  y: number;
  /** Height where the lobe has blended back into the neck. */
  bottom: number;
  /** Outward push at the fullest point, world units. */
  bulge: number;
  /** Angle from the front of the face where the lobe is fullest, degrees. */
  angle: number;
  /** Angular half-width of the lobe, degrees; less than `angle`, so the middle of the face stays as it is. */
  spread: number;
}

/** Mantle silhouette: a superellipse dome above `waist`, a narrower neck below, and cheeks. */
export interface HeadShape {
  centerX: number;
  halfWidth: number;
  waist: number;
  top: number;
  bottom: number;
  topPower: number;
  bottomPower: number;
  /** z radius as a fraction of the half-width. */
  depth: number;
  /** Head-local origin of the face canvas, in world units. */
  faceOrigin: Point2;
  cheeks: CheekShape;
}

/** The warm core under the face and the colour ramp it paints onto the mantle. */
export interface GlowShape {
  center: readonly [number, number, number];
  spreadX: number;
  reachUp: number;
  reachDown: number;
  /** Mantle colour by glow strength (0 = unlit, 1 = core), sRGB hex. */
  ramp: readonly (readonly [number, string])[];
}

export interface Palette {
  cheek: string;
  headEdge: string;
  rimTop: string;
  rimLow: string;
  sky: string;
  speck: string;
  armShadow: string;
  armMid: string;
  armLit: string;
  armGlow: string;
  belly: string;
  suckerEdge: string;
  suckerBody: string;
  suckerHot: string;
}

/** One eye's drawing, traced from the reference; the two eyes mirror each other except for the light. */
export interface EyeLayout {
  rx: number;
  ry: number;
  centers: [Point2, Point2];
  /** Iris radii as fractions of the eye radii; `inset` shifts it toward the nose, as a fraction of rx. */
  iris: { rx: number; ry: number; inset: number };
  /** Pupil radii as fractions of the iris radii; `drop` lowers it below the iris centre, as a fraction of the iris ry. */
  pupil: { rx: number; ry: number; drop: number };
  /**
   * Catchlights relative to the iris centre, in iris radii (+y up), larger first. They are
   * not mirrored between the eyes: the light comes from the same side for both.
   */
  catchlights: { x: number; y: number; r: number }[];
  /** Upper lid line width at its inner end and at the outer corner, world units. */
  lid: { inner: number; outer: number };
  /** Width of the light rim along the lower edge, world units. */
  rim: number;
  /** Lashes at the outer corner: where they leave the lid (0 = top, 1 = outer corner), length (world units), angle above horizontal (degrees). */
  lashes: { at: number; length: number; angle: number }[];
}

/** Face feature placement in head-local world units (origin = HeadShape.faceOrigin). */
export interface FaceLayout {
  eye: EyeLayout;
  /** Right brow as a quadratic curve from its inner end to its outer end; the left brow mirrors it. */
  brow: { inner: Point2; control: Point2; outer: Point2; thickness: number };
  mouth: { center: Point2; halfWidth: number };
  blush: { centers: [Point2, Point2]; rx: number; ry: number };
}

export interface FacePalette {
  /** Top (shadowed by the lid), middle and bottom. */
  sclera: [string, string, string];
  /** Top, middle and bottom: dark above, glowing red below. */
  iris: [string, string, string];
  /** Warm glow pooled in the lower iris: its bright centre and its red edge. */
  irisPool: string;
  irisPoolEdge: string;
  pupil: string;
  catchlight: string;
  lid: string;
  /** Thin light rim along the lower edge of the eye. */
  outline: string;
  brow: string;
  mouth: string;
  blush: string;
}

export interface ArmSpec {
  id: ArmId;
  depth: 'rear' | 'middle' | 'front';
  rootRadius: number;
  /** Root z and tip z: rear arms pass behind the mantle, front arms in front. */
  z: readonly [number, number];
  /**
   * Side that carries the suckers when traced from the reference instead of read
   * from the tip curl: 1 = left of the root-to-tip direction, -1 = right.
   */
  suckerSide?: 1 | -1;
  /** Arc fraction where the sucker row begins, when traced from the reference (default 0.14). */
  suckerStart?: number;
}

export interface Personality {
  /** Seconds between ordinary blinks. */
  blinkInterval: [number, number];
  doubleBlinkChance: number;
  gazeOmega: number;
  headOmega: number;
  sway: number;
  curl: number;
  float: { amplitude: number; period: number };
  breathPeriod: number;
}

export interface CharacterConfig {
  id: string;
  head: HeadShape;
  glow: GlowShape;
  palette: Palette;
  face: FaceLayout;
  facePalette: FacePalette;
  arms: readonly ArmSpec[];
  tipRadius: number;
  taperPower: number;
  suckers: { sizeRatio: number; spacing: number; tilt: number };
  personality: Personality;
}
