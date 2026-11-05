// Everything that makes one octopus look and behave like itself. The renderer
// reads only these values; a new character is a new config, not new code.
// Units are world units (1 unit = 100 storyboard panel px, +y up).

import type { AppearId, SelectId } from '../artifacts/strategies';
import type { Shell } from '../artifacts/bubbleOrbits';
import type { ExpressionId, ExpressionParams } from '../behavior/expressions';
import type { HeadEffectId } from '../character/headEffects';
import type { StageLighting } from './lighting';

import { ARM_IDS, type ArmId } from './arms';

export { ARM_IDS, type ArmId, type HeadEffectId };
export type Point2 = readonly [number, number];

/** Every stage, in the order a first visit meets them: the one stage vocabulary (spec 7). */
export const STAGE_IDS = ['entering', 'intro', 'overview', 'techFocus', 'detail'] as const;
export type StageId = (typeof STAGE_IDS)[number];

/**
 * The stages that can offer a choice of artifact, and that artifacts are framed and sized for: the
 * intro and the overview. The others never do (the entrance, the detail), and a technology focus is
 * a choice already made in one of these. The one list the stage machine, the artifact strategies and
 * the blow read.
 */
export const CHOOSING_STAGES = ['intro', 'overview'] as const satisfies readonly StageId[];
export type ChoosingStage = (typeof CHOOSING_STAGES)[number];
/** Whether `stage` is one of CHOOSING_STAGES. */
export const isChoosingStage = (stage: StageId): stage is ChoosingStage => (CHOOSING_STAGES as readonly StageId[]).includes(stage);

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
  /** The glow card behind the face: the sRGB hex colour of its warm core. */
  core: string;
  /** The face glow's point light in a world, and the particles' tint taken from it. */
  light: GlowLightSettings;
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

/** The face glow's light: sRGB hex colour, intensity, reach (world units, nothing at or past it) and decay. */
export interface GlowLightSettings {
  color: string;
  intensity: number;
  distance: number;
  decay: number;
}

/**
 * The aura: a soft glow in the water round Nox, drawn behind him and added to what is there.
 * `inner` at and above the body's middle, turning to `low` below it (sRGB hex); `radius` is how
 * far it reaches from the body's middle (world units), `strength` its brightness, 0 to 1.
 */
export interface AuraSettings {
  inner: string;
  low: string;
  /** The aura is all `low` this far below the body's middle, as a share of `radius`. */
  belowStart: number;
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
  /** The hot ring a technology's orb glows with while it is in focus. */
  orbFocus: string;
  /**
   * The colours the skin's and the dome's shaders compile in, as linear light (`color(srgb-linear
   * r g b)`, or `#rrggbb`; world/colour.ts): `rimHot` the white-hot line right at the skin's rim
   * (head and arms), `domeRimHot` the dome's glowing reveal front, `suckerSpecular` the tint of the
   * cups' wet highlight.
   */
  rimHot: string;
  domeRimHot: string;
  suckerSpecular: string;
  /** What a technology orb's glass picks up round its edge (orbMaterial.ts), as linear light like `rimHot`. */
  orbGlass: OrbGlass;
  /** The head effect's strokes (a soft halo, the stroke, a hot core): CSS colours, as the canvas takes them. */
  effect: EffectColours;
}

/**
 * The surroundings an orb's glass edge picks up: `below` from under it (Nox: the lava's orange),
 * `above` from over it (violet), `side` from its left (blue), mostly overlaid by the logo's own
 * colour; and `base`, the faint colour its dark centre never falls below.
 */
export interface OrbGlass {
  below: string;
  above: string;
  side: string;
  base: string;
}

/** A head effect's three colours: the wide soft halo, the stroke, and the thin hot core. */
export interface EffectColours {
  halo: string;
  stroke: string;
  core: string;
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

/**
 * The shared micro-animations' timings (seconds) and strengths (design 9.7): read by
 * behavior/ambient.ts, behavior/attention.ts and motion/micro.ts. Gaze units are the face's
 * normalised gaze (-1 to 1); lifts are world units; arm swings are radians at the tip.
 */
export interface MicroMotion {
  /** One blink's length, and the gap before the second of a double blink. */
  blink: { seconds: number; doubleGap: number };
  /** Seconds the eyes keep following a pointer after it stops moving. */
  tracking: number;
  /**
   * Idle glances: the first comes `first` s into an idle spell, each next one `wait` s later (a
   * range). Each looks up to x / 2 to either side, and y / 2 above or below `lift`.
   */
  glance: { first: number; wait: [number, number]; x: number; y: number; lift: number };
  /** Tiny eye movements between glances: the first after `first` s, then every `wait` s (a range), up to x / 2 and y / 2. */
  saccade: { first: number; wait: [number, number]; x: number; y: number };
  /**
   * The small startle when the pointer darts to the face: it lasts `duration`; the body lifts by
   * `lift`, the arms draw in by `armsIn` and the brows jump by `eyes`. It plays when the pointer
   * comes within `near` (attention.ts nearFace, 0 to 1) at `speed` NDC per second or more, at most
   * once every `cooldown` s.
   */
  startle: { duration: number; lift: number; armsIn: number; eyes: number; speed: number; near: number; cooldown: number };
  /** The overshoot as a stage move lands: `amount` past the pose along the move, `cycles` swings, over `duration`. */
  settle: { duration: number; amount: number; cycles: number };
  /** The happy wiggle on arrival (the 'arrival' sheet): stretched to `duration`; body roll and arm fan at their peaks. */
  arrival: { duration: number; roll: number; armWave: number };
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
  /** The shared micro-animations (design 9.7). */
  micro: MicroMotion;
  /**
   * 0 to 1: a scale on the approved landing overshoots, the settle of a stage move
   * (`micro.settle`) and the entrance arms' run past the intro pose (swimArms.settleWeight).
   * Unset: 1, Nox's (engine contract 14.1; Veyra's 0.6 lands at 60% of it).
   */
  settle?: number;
  /** Above 0: a scale on the stroke's glide (`swim.glide`), motion/stroke.ts strokeTiming. Unset: 1, Nox's. */
  glideBias?: number;
  /**
   * 0 or more: idle flourishes per minute, nominal (behavior/flourish.ts, gap G4; the waits are
   * drawn from 0.8 to 4/3 of 60 / rate s, so about 0.94 of it plays): one arm slowly unrolls its tip
   * curl and rolls it back. Unset: 0, none (Nox).
   */
  flourishRate?: number;
}

/** What `Personality.settle`, `glideBias` and `flourishRate` read when unset: Nox's values, today's behaviour. */
export const PERSONALITY_VARIANT_DEFAULTS = { settle: 1, glideBias: 1, flourishRate: 0 } as const;

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
  /**
   * How the mantle and the arms are drawn, each on its own (amendment A1, spec 18.2: Aether's arms
   * are translucent, Flux reuses the mantle's mode). Absent, both are `'skin'` with no sparkle: Nox.
   */
  surfaces?: { mantle: SurfaceLook; arms: SurfaceLook };
}

/** The material modes a skin surface can take: a closed table in the engine (skinMaterial.ts). */
export const SKIN_MODES = ['skin', 'jelly'] as const;
export type SkinMode = (typeof SKIN_MODES)[number];

/**
 * One skin surface's look: Nox's living `'skin'`, or `'jelly'` glass (Veyra), and fine twinkling
 * specks over it, `sparkle` per square unit of the surface (0 is none).
 */
export interface SurfaceLook {
  mode: SkinMode;
  /** The jelly's colours and shape; read only in `'jelly'` mode (absent there: the character's own palette). */
  jelly?: JellySettings;
  sparkle: number;
}

/**
 * The jelly glass (spec 7.2): a bright fresnel rim, a lighter crown cap, a darker thicker centre
 * facing the viewer, and a warm core glowing inside. Every colour is config read into a uniform,
 * never a shader constant (A1 F6, A6).
 */
export interface JellySettings {
  /** The silhouette's fresnel edge colour, and its falloff: (1 - n·v)^rimPower (higher is thinner). */
  rim: string;
  rimPower: number;
  /** The cap's colour, and where it starts: the surface normal's up component, 0 to 1 (on a round dome, the height as a fraction of its radius). */
  crown: string;
  crownHeight: number;
  /** The thick middle's colour, and how far the surface facing the viewer takes it (0 to 1). */
  depth: string;
  depthStrength: number;
  /** The warm core inside: its colour, its centre relative to the face glow's (`glow.center`) in the head's own space (it turns, tilts and scales with the head), and its strength (0 to 2). */
  core: string;
  coreCenter: readonly [number, number, number];
  coreWarmth: number;
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
  /**
   * The cups' frill style (Veyra; Aether reuses it in pink-white, amendment A1): raised cups whose
   * outer edges stand proud of the arm's silhouette as a scalloped frill. Absent: Nox's shallow
   * sunk discs with a slit hollow, exactly as approved.
   */
  style?: SuckerStyle;
}

/**
 * A frill cup: a raised glowing rim round a round hollow, on a short wall that lifts it off the
 * skin. Every colour is config read into a uniform (A1, A7); the numbers shape the cup.
 */
export interface SuckerStyle {
  /** The rim's width, as a fraction of the cup radius (0.05 to 0.5): the ring between the hollow and the outer edge. */
  rimWidth: number;
  /** How far each cup's rim stands proud of the skin under it, in cup radii (0 to 1): the frill's scallops. */
  scallop: number;
  /** The wall below the rim, where the cup rises out of the skin. */
  edge: string;
  /** The raised glowing rim. */
  rim: string;
  /** The round hollow inside the rim. */
  hollow: string;
  /** How brightly the cups glow on their own (0 to 3): they are emitters the world never dims. */
  glow: number;
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

// The head effect a character's swell carries (design 9.9) is named by `HeadEffectId`, derived from
// the engine's HEAD_EFFECTS table (character/headEffects): `'none'` draws the dome alone, as
// approved; Nox's is `'glyphs'`, glowing red runes.

/** A glass orb hangs on a short tether from the arm at arc fraction `at` (0 root, 1 tip); `order` is the technology's rank for the slot (0 first). */
export interface PendantSlot {
  arm: ArmId;
  at: number;
  order: number;
}

/**
 * The thread a pendant hangs from and the cap where it meets the orb (artifacts/tether.ts). Colours
 * are config, never engine literals. `length` is the thread's own length from the arm to the cap, in
 * world units, and may be 0 (a cap only); `width` is its diameter; `sag` is how far it bows sideways
 * at its middle, as a fraction of its length.
 */
export interface TetherStyle {
  length: number;
  color: string;
  width: number;
  sag: number;
  cap: string;
}

/** How far a pendant swings (artifacts/pendant.ts): the largest angle from vertical (radians) and the seconds the swing takes to settle once its arm stops. */
export interface SwingLimits {
  maxAngle: number;
  settle: number;
}

/** When pendants appear (seconds): the first one's start, how long one takes, and the delay between pendants in `order`. */
export interface PendantReveal {
  start: number;
  span: number;
  step: number;
}

/** Where the artifacts sit: a closed union, one member per placement in the engine's PLACEMENTS table. */
export type PlacementConfig = {
  kind: 'orbit';
  /** The rings the artifacts circle on (artifacts/bubbleOrbits.ts). */
  shells: readonly Shell[];
  /** An artifact's radius in each stage's framing (the intro frames the character smaller, and its artifacts are smaller with it). */
  sizes: Record<ChoosingStage, number>;
  /** Where the rings are centred, in body space, and the height they show. */
  centreY: number;
  halfHeight: number;
  /** How square the rings are: 2 is an ellipse, more is a rounder rectangle. */
  squareness: number;
  /** How far a full swell pushes the rings out, as a fraction of their size. */
  swellPush: number;
} | {
  kind: 'pendant';
  /** Each stage's slots, on the arms (at most `maxPerArm` an arm), in the stage pose's arm space. */
  slots: Record<ChoosingStage, readonly PendantSlot[]>;
  maxPerArm: 2;
  /** An orb's radius in each stage's framing. */
  sizes: Record<ChoosingStage, number>;
  tether: TetherStyle;
  /** The swing's limits; absent, 25 degrees and 1.2 s (Veyra's). */
  swing?: SwingLimits;
  /** The appear's timing; absent, the appear keeps its own (Veyra's bloom: 1.2 s in all). */
  reveal?: PendantReveal;
};

/** The orbit placement's settings. */
export type OrbitPlacement = Extract<PlacementConfig, { kind: 'orbit' }>;

/** The pendant placement's settings. */
export type PendantPlacement = Extract<PlacementConfig, { kind: 'pendant' }>;

/**
 * How a world's artifacts (its technologies' orbs) are placed, appear and are chosen: three
 * independent strategies, each a kind from a closed table in the engine (artifacts/strategies.ts),
 * and the stages in which one can be chosen. `appear` and `select` are objects so a later kind can
 * carry parameters.
 */
export interface ArtifactConfig {
  placement: PlacementConfig;
  appear: { kind: AppearId };
  select: { kind: SelectId };
  /** The stages in which an artifact can be chosen; the reducer ignores a choice in any other, and the buttons and the tray are not drawn there. */
  choosableIn: readonly ChoosingStage[];
}

export interface CharacterConfig {
  id: string;
  /** How the stage lights the character. */
  lighting: StageLighting;
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
  /** The head swell's special effect; null draws none, as `'none'` does. */
  headEffect: HeadEffectId | null;
  skin: SkinDetail;
  personality: Personality;
  /** Per-character changes to the engine's base faces, merged over it by `resolveExpressions` (a missing id or key is the base). */
  expressions?: Partial<Record<ExpressionId, Partial<ExpressionParams>>>;
}
