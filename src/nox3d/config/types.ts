// Everything that makes one octopus look and behave like itself. The renderer
// reads only these values; a new character is a new config, not new code.
// Units are world units (1 unit = 100 storyboard panel px, +y up).

export const ARM_IDS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'] as const;
export type ArmId = (typeof ARM_IDS)[number];
export type Point2 = readonly [number, number];
export type StageId = 'entering' | 'intro' | 'overview' | 'techFocus' | 'detail';

/** Mantle silhouette: a superellipse dome above `waist`, fuller cheeks below. */
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

/** Face feature placement in head-local world units (origin = HeadShape.faceOrigin). */
export interface FaceLayout {
  eye: { rx: number; ry: number; centers: [Point2, Point2] };
  brow: { centers: [Point2, Point2]; width: number; thickness: number };
  mouth: { center: Point2; halfWidth: number };
  blush: { centers: [Point2, Point2]; rx: number; ry: number };
}

export interface FacePalette {
  sclera: [string, string, string];
  iris: [string, string, string];
  irisPool: string;
  pupil: string;
  lid: string;
  /** Thin lower outline of the eye. */
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
