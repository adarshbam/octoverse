// Everything that makes one octopus look and behave like itself. The renderer
// reads only these values; a new character is a new config, not new code.
// Units are world units (1 unit = 100 storyboard panel px, +y up).

export const ARM_IDS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'] as const;
export type ArmId = (typeof ARM_IDS)[number];
export type Point2 = readonly [number, number];
export type StageId = 'entering' | 'intro' | 'overview' | 'techFocus' | 'detail';

/**
 * The lower face's side lobes: round cheeks that stick out below the dome, hold the
 * blush, and carry the head's outline down into the neck and arms. Each is a sphere
 * merged smoothly into the mantle.
 */
export interface CheekShape {
  /** Height (world y) of the cheek's centre. */
  y: number;
  /** Distance of the centre from the head's axis, and its angle from the front of the face (degrees). */
  distance: number;
  angle: number;
  /** Radius: how big and round the cheek is. */
  radius: number;
  /** Width of the smooth join into the dome and the neck; small keeps a clear notch. */
  blend: number;
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
  /** Sucker cup: outer wall, inner wall, glowing rim, and the slit of the hollow centre. */
  suckerEdge: string;
  suckerBody: string;
  suckerHot: string;
  suckerHollow: string;
}

/**
 * One eye's drawing, traced from the reference: an opening (`rx`, `ry`) framed by a dark
 * border all the way round, with a lit eyelid and crease above it. The two eyes mirror
 * each other except for the light, which comes from the upper left for both, so the
 * catchlights, reflections and pupil ring are not mirrored. World units unless noted.
 */
export interface EyeLayout {
  rx: number;
  ry: number;
  centers: [Point2, Point2];
  /**
   * Border width outside the opening at eight directions, named for the right eye and
   * mirrored for the left: heaviest along the top (the lash line), thick on the outer side,
   * thin beside the nose (where the iris's own rim meets it) and along the bottom.
   */
  border: {
    outer: number;
    upperOuter: number;
    top: number;
    upperInner: number;
    inner: number;
    lowerInner: number;
    bottom: number;
    lowerOuter: number;
  };
  /**
   * Iris radii as fractions of the eye radii; `inset` shifts it toward the nose, as a
   * fraction of rx; `rim` is its dark outer ring, as a fraction of the iris rx.
   */
  iris: { rx: number; ry: number; inset: number; rim: number };
  /**
   * Pupil radii as fractions of the iris radii; `drop` moves it below the iris centre
   * (negative raises it), as a fraction of the iris ry. Its lighter inside is an ellipse
   * offset within it (fractions of the pupil radii, +y up), leaving a dark ring that is
   * heavier on the side away from the light.
   */
  pupil: { rx: number; ry: number; drop: number; inner: { dx: number; dy: number; rx: number; ry: number } };
  /** Catchlights relative to the iris centre, in iris radii (+y up), larger first. */
  catchlights: { x: number; y: number; r: number }[];
  /** Soft reflected glows in the lower iris, relative to the iris centre, in iris radii (+y up). */
  glows: { x: number; y: number; rx: number; ry: number; strength: number }[];
  /** The warm reflection at the bottom of the iris, below the pupil, in iris radii (+y up). */
  spot: { x: number; y: number; rx: number; ry: number };
  /** Lash line drawn over the top of the opening, so the lid overhangs the eye: its width at the inner end and at the outer corner. */
  lid: { inner: number; outer: number };
  /** Width of the light rim just inside the lower edge. */
  rim: number;
  /**
   * Eyelid above the border: a lit lid band of width `band` on the border, then a soft
   * crease of width `width` above it, spanning x/rx from `from` (negative = nose side) to `to`.
   */
  fold: { width: number; band: number; from: number; to: number };
  /**
   * Lashes at the outer corner: where they leave the lid (0 = top, 1 = outer corner), length
   * and base width, and angle above horizontal (degrees).
   */
  lashes: { at: number; length: number; width: number; angle: number }[];
}

/** Face feature placement in head-local world units (origin = HeadShape.faceOrigin). */
export interface FaceLayout {
  eye: EyeLayout;
  /** Right brow as a quadratic curve from its inner end to its outer end; the left brow mirrors it. */
  brow: { inner: Point2; control: Point2; outer: Point2; thickness: number };
  /** Smile line: half-width and dip at no smile, line thickness, and the round dimples at its ends (radius). */
  mouth: { center: Point2; halfWidth: number; depth: number; thickness: number; dimple: number };
  blush: { centers: [Point2, Point2]; rx: number; ry: number };
}

export interface FacePalette {
  /** White of the eye: lid shadow across the top, bright beside the iris, pink toward the outer edge, edge. */
  sclera: [string, string, string, string];
  /** Iris body from top to bottom: dark above, glowing red below. */
  iris: [string, string, string];
  /** The iris's dark outer ring, top and bottom. */
  irisRim: [string, string];
  /** Soft reflected glow in the lower iris. */
  irisGlow: string;
  /** Warm reflection at the bottom of the iris: its bright centre and its red edge. */
  irisPool: string;
  irisPoolEdge: string;
  /** Pupil inside, top and bottom, and its dark outline. */
  pupil: [string, string];
  pupilRing: string;
  catchlight: string;
  /** Lash line. */
  lid: string;
  /** Border round the eye: top, middle and bottom (lit by the face glow). */
  border: [string, string, string];
  /** Eyelid crease and the lit lid band below it. */
  lidFold: string;
  lidSkin: string;
  /** Light rim just inside the lower edge of the eye. */
  outline: string;
  brow: string;
  mouth: string;
  /** Inside of an open smile, and the tongue at its bottom. */
  mouthInside: string;
  tongue: string;
  blush: string;
  /** Soft warm halo around each blush. */
  blushGlow: string;
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

/** Sucker cups along each arm's oral side. Lengths in world units, angles in degrees. */
export interface SuckerSettings {
  /** Cup radius = size * armRadius^sizePower, so cups shrink toward the tip more slowly than the arm. */
  size: number;
  sizePower: number;
  /** Centre spacing along a row, in cup radii. */
  spacing: number;
  /** Cups are this much longer along the arm than across it. */
  elongation: number;
  /** How far the oral side turns from the arm's edge toward the viewer, along the arm and in the curls. */
  tilt: number;
  curlTilt: number;
  /** Where the arm radius exceeds `rowRadius`, two staggered rows run this far apart round the arm, either side of the oral midline. */
  rowAngle: number;
  rowRadius: number;
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
  /** Arm taper: radius falls as 1 - u^taperPower along the arm, so larger values keep arms thick for longer. */
  taperPower: number;
  suckers: SuckerSettings;
  personality: Personality;
}
