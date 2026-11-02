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
  /** How strongly the face glow warms the cheek lobes, 0 to 1. */
  cheekWarmth: number;
  /** How brightly the red oral band glows along each arm's underside, 0 to 2. */
  underside: number;
  halo: HaloSettings;
  /** In a world: the soft glow in the water round him. */
  aura: AuraSettings;
  /** In a world: the water near him, darker and warmer than the far water. */
  grade: GradeSettings;
}

/**
 * The aura: a soft glow in the water round Nox, drawn behind him and added to what is there.
 * `inner` at and above the body's middle, turning to `low` below it (sRGB hex); `radius` is how
 * far it reaches from the body's middle (world units), `strength` its brightness, 0 to 1.
 */
export interface AuraSettings {
  inner: string;
  low: string;
  radius: number;
  strength: number;
}

/**
 * The local grade: the water behind Nox, within `radius` world units of him, mixed toward
 * `color` (sRGB hex) by up to `strength` (0 to 1) at his middle, fading out by the radius.
 */
export interface GradeSettings {
  color: string;
  radius: number;
  strength: number;
}

/**
 * The soft glow round the silhouette: magenta round the head and arms, red below the arms'
 * cup bands. Reach in world units; strengths are the glow's brightness at the silhouette.
 */
export interface HaloSettings {
  headWidth: number;
  armWidth: number;
  color: string;
  /** Colour along the crown of the head, where the outline faces up. */
  crown: string;
  band: string;
  strength: number;
  bandStrength: number;
}

export interface Palette {
  cheek: string;
  headEdge: string;
  rimTop: string;
  rimLow: string;
  sky: string;
  /** Skin detail: dark blotches, the cool and warm tints, and the wet highlight. */
  blotch: string;
  tintCool: string;
  tintWarm: string;
  wet: string;
  /** The arms' own colour (lit by the stage's key light, bounce and underglow). */
  armBody: string;
  /** Light scattered through the flesh where the key fades, and where the red band glows up into the body. */
  terminator: string;
  armGlow: string;
  belly: string;
  /** Sucker cup: its edge where it meets the skin, its face, its glowing rim, and the slit of the hollow. */
  suckerEdge: string;
  suckerBody: string;
  suckerHot: string;
  suckerHollow: string;
  /** The soft contact shadow each cup casts onto the band round it. */
  suckerShadow: string;
  /** The overview dome's glass body, its rim (hot pink, lavender over the crown) and inner sheen. */
  domeTint: string;
  domeRim: string;
  domeRimTop: string;
  domeSheen: string;
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

/**
 * One swim stroke (spec 9.5): the seconds each phase lasts, a slow recovery (the arms open), a fast
 * power stroke (they sweep back) and a glide (they trail), and how far the mantle fills in recovery
 * and squeezes in the power stroke, as fractions of its size.
 */
export interface StrokeTiming {
  recovery: number;
  power: number;
  glide: number;
  fill: number;
  squeeze: number;
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
  /** The swim stroke's pace and mantle beat (motion/stroke.ts). */
  swim: StrokeTiming;
}

/**
 * Living skin detail: droplet bumps, dark blotches, cool and warm tints, wet gloss and light
 * glowing through. Sizes are in world units unless noted; strengths run from 0 to 1.
 */
export interface SkinDetail {
  /** Droplet bumps: fraction of cells holding one, radius range as fractions of a cell, cells per unit. */
  speckDensity: number;
  speckSize: [number, number];
  speckScale: number;
  /** Darker blotches: fraction of cells holding one, cells per unit. */
  blotchDensity: number;
  blotchScale: number;
  /** How strongly the skin drifts between its cool (bluish) and warm (reddish) tints. */
  tint: number;
  /** Warm light glowing through the arms from their red underside, and through thin edges. */
  translucency: number;
  /** Wet gloss: strength (0 to 2) and sharpness (Blinn exponent). */
  wetness: number;
  gloss: number;
  /** Fine wet streaks along the arms: how stretched they are, and how deep. */
  streakScale: number;
  streakStrength: number;
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
  /** How far the oral side rolls toward and away from the viewer along the middle of the arm. */
  twist: number;
  /** Where the arm radius exceeds `rowRadius`, two staggered rows run this far apart round the arm, either side of the oral midline. */
  rowAngle: number;
  rowRadius: number;
  /** Strength of the soft contact shadow each cup casts onto the skin round it (0-1). */
  shadow: number;
}

/**
 * The glass dome the head opens into in the overview (panel 3), in the space the head is authored
 * in: a capsule with rounded-square corners round `center`.
 */
export interface DomeShape {
  center: Point2;
  halfWidth: number;
  halfHeight: number;
  /** z radius toward the viewer. */
  depth: number;
  /** Corner squareness: 2 is an ellipse, higher is squarer. */
  power: number;
  /** Where the mantle's top sinks to, beneath the dome, when it is fully open. */
  mantleTop: number;
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
  /** Rest bend: how much the arms undulate along their length when still (radians of turn). */
  armBend: number;
  /** The arms' sucker side is flattened to this fraction of the radius; their backs stay round. */
  armFlatten: number;
  suckers: SuckerSettings;
  dome: DomeShape;
  skin: SkinDetail;
  personality: Personality;
}
