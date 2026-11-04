import type { ArmSpec, CharacterConfig } from '../../engine/config/types';
import type { StageLighting } from '../../engine/config/lighting';

// Flux, "the Pipeline Runner" (spec 7.1, 7.2, 7.3, 7.8), traced against Flux panel 2 (P2, 511 x 510
// native px; 1 unit = 100 px, origin at the panel's centre, +y up). This is the first pass (Task 2):
// the head's size, the face's place, the arms' anatomy, the blue-violet-pink palette and the eager
// personality. Task 3 gives the body its jelly look and the cups their style; Task 4 the face its
// layers and expressions. Until the engine lands the jelly surfaces (`SurfaceLook`), both surfaces
// read the engine's `skin` block.

// Arms fan out in depth from the body as Nox's do (rear arms behind the head, side arms in front),
// a touch thicker at the root than a slimmer octopus, and they taper steadily to the tip.
const rear = (id: 'T1' | 'T8'): ArmSpec => ({ id, depth: 'rear', rootRadius: 0.175, z: [-0.3, -0.62] });
const middle = (id: 'T2' | 'T7'): ArmSpec => ({ id, depth: 'middle', rootRadius: 0.19, z: [0.05, -0.32] });
const side = (id: 'T3' | 'T6'): ArmSpec => ({ id, depth: 'front', rootRadius: 0.19, z: [0.0, 0.3] });
// The two centre arms show their cups along the V between them, inside their tip curls.
const lower = (id: 'T4' | 'T5', suckerSide: 1 | -1): ArmSpec => ({ id, depth: 'front', rootRadius: 0.19, z: [0.22, 0.5], suckerSide, suckerStart: 0.23 });

/**
 * Flux's own lighting: a cool key from the upper left, a violet-pink glow from below (his face and
 * cups light his own undersides), blue bounce from the water, and navy haze.
 */
const FLUX_LIGHTING: StageLighting = {
  key: { direction: [-0.3, 0.95, 0.1], color: '#e4ecff', intensity: 1.0, wrap: 0.18 },
  underglow: { color: '#c070f0', intensity: 0.42, wrap: 0.6 },
  ambient: { sky: '#2a40d8', ground: '#5a2ca8', intensity: 0.2 },
  haze: { color: '#04102e', near: 0.15, far: 0.9, strength: 0.4 },
};

export const FLUX: CharacterConfig = {
  id: 'flux',
  lighting: FLUX_LIGHTING,
  // Dome, cheeks and the face's origin traced from P2: dome half width 0.74, top 0.26, soft cheek
  // lobes at eye level (radius about 0.08), the face in the lower half with its eyes at y -0.54.
  head: {
    centerX: 0, halfWidth: 0.74, waist: -0.5, top: 0.26, bottom: -1.2, topPower: 2, bottomPower: 1.8, depth: 0.82, faceOrigin: [0, -0.44],
    cheeks: { y: -0.58, distance: 0.66, angle: 72, radius: 0.08, blend: 0.08 },
  },
  glow: {
    // The face glow sits low in the face (spec 2.2: about y -0.70), pink-white at its core.
    center: [0, -0.7, 0.6],
    core: '#feabcf',
    light: { color: '#d070ff', intensity: 5, distance: 6, decay: 2 },
    spreadX: 0.6,
    reachUp: 0.5,
    reachDown: 0.3,
    // The mantle by glow strength: electric blue crown (48, 68, 239), the violet middle (156, 87, 239),
    // the chin's violet-pink (214, 125, 243), the pink-white face glow (254, 171, 207).
    ramp: [[0, '#3044ef'], [0.2, '#3a50ef'], [0.4, '#9c57ef'], [0.65, '#d67df3'], [0.85, '#f59ae0'], [1, '#feabcf']],
    cheekWarmth: 0.7,
    underside: 1.0,
    // A soft blue glow round the silhouette, turning violet below the arms.
    halo: { headWidth: 0.05, armWidth: 0.035, color: '#4a8cff', crown: '#5a78ff', band: '#a050e8', strength: 0.75, bandStrength: 0.8 },
    // In the water: deep blue near him (the aura target, 0, 24, 80), violet below; the water within
    // about 3 units darker and bluer than the lit water near the shaft.
    aura: { inner: '#001850', low: '#34189a', belowStart: 0.75, radius: 3.6, strength: 1 },
    grade: { color: '#000c30', radius: 3, strength: 1 },
  },
  palette: {
    cheek: '#8a5cf0',
    headEdge: '#3d74e9',
    rimTop: '#6aa0ff',
    rimLow: '#8a50f0',
    sky: '#3a60f0',
    blotch: '#2030c0',
    tintCool: '#3044ef',
    tintWarm: '#9c57ef',
    wet: '#7aa0ff',
    armBody: '#374af1',
    terminator: '#9c5af0',
    armGlow: '#c070f0',
    belly: '#d080f0',
    suckerEdge: '#f3afef',
    suckerBody: '#f6b8f2',
    suckerHot: '#fbc8f6',
    suckerHollow: '#b060e0',
    suckerShadow: '#10104a',
    domeTint: '#0a1a60',
    domeRim: '#4a8cff',
    domeRimTop: '#7ab0ff',
    domeSheen: '#a0c8ff',
    orbFocus: '#4ac8ff',
    effect: { halo: 'rgba(74,166,208,0.5)', stroke: '#4aa6d0', core: '#d0f0ff' },
    rimHot: 'color(srgb-linear 0.85 0.9 1)',
    domeRimHot: 'color(srgb-linear 0.8 0.9 1)',
    suckerSpecular: 'color(srgb-linear 1 0.9 1)',
    orbGlass: {
      below: 'color(srgb-linear 0.5 0.2 1)',
      above: 'color(srgb-linear 0.3 0.6 1)',
      side: 'color(srgb-linear 0.25 0.55 1)',
      base: 'color(srgb-linear 0.002 0.0015 0.004)',
    },
  },
  face: {
    // Eyes large and round at about x +-0.37, y -0.54 in the stage (the face origin is at y -0.44);
    // two short lashes at each outer corner (spec 7.3); Task 4 draws the layers to the reference.
    eye: {
      rx: 0.165,
      ry: 0.175,
      centers: [[-0.37, -0.1], [0.37, -0.1]],
      border: { outer: 0.022, upperOuter: 0.03, top: 0.03, upperInner: 0.022, inner: 0.008, lowerInner: 0.008, bottom: 0.0075, lowerOuter: 0.011 },
      iris: { rx: 0.84, ry: 0.92, inset: 0.16, rim: 0.1 },
      pupil: { rx: 0.55, ry: 0.6, drop: 0.08, inner: { dx: -0.15, dy: 0.05, rx: 0.7, ry: 0.85 } },
      catchlights: [{ x: -0.4, y: 0.45, r: 0.19 }, { x: 0.4, y: 0.25, r: 0.1 }],
      glows: [
        { x: -0.55, y: -0.4, rx: 0.34, ry: 0.4, strength: 0.8 },
        { x: 0.55, y: -0.38, rx: 0.3, ry: 0.36, strength: 0.7 },
        { x: 0, y: -0.7, rx: 0.55, ry: 0.26, strength: 0.8 },
      ],
      spot: { x: 0.05, y: -0.74, rx: 0.24, ry: 0.13 },
      lid: { inner: 0.012, outer: 0.016 },
      rim: 0.01,
      fold: { width: 0.008, band: 0.016, from: -0.7, to: 0.7 },
      lashes: [
        { at: 0.66, length: 0.04, width: 0.016, angle: 70 },
        { at: 0.86, length: 0.04, width: 0.016, angle: 40 },
      ],
    },
    // Short, thick, dark arcs set high (P2: abs y about -0.2); thicker than a slimmer face's.
    brow: { inner: [0.29, 0.25], control: [0.37, 0.28], outer: [0.45, 0.22], thickness: 0.034 },
    // A wide open smile at y -0.81 (the face origin is at -0.44); the blush under the outer eye corners.
    mouth: { center: [0, -0.37], halfWidth: 0.14, depth: 0.06, thickness: 0.016, dimple: 0.01 },
    blush: { centers: [[-0.54, -0.3], [0.54, -0.3]], rx: 0.105, ry: 0.06 },
  },
  facePalette: {
    // Navy-black irises turning violet-lavender below, a white sclera with a faint lavender edge.
    sclera: ['#8a84c8', '#ffffff', '#ece6ff', '#b0a4e8'],
    iris: ['#0a0c3a', '#3a30b0', '#b8a0ff'],
    irisRim: ['#060824', '#4a3ca8'],
    irisGlow: '#8a78ff',
    irisPool: '#c8b4ff',
    irisPoolEdge: '#7a60e8',
    pupil: ['#04041a', '#10104a'],
    pupilRing: '#02020e',
    catchlight: '#ffffff',
    lid: '#050620',
    border: ['#050620', '#10124a', '#7a6ad0'],
    lidFold: '#1a1860',
    lidSkin: '#6a58e8',
    outline: '#e8e0ff',
    brow: '#0a0c40',
    mouth: '#3a0a40',
    mouthInside: '#5a1a60',
    tongue: '#f6607f',
    blush: '#f99ccf',
    blushGlow: '#ff7ac0',
  },
  arms: [rear('T1'), middle('T2'), side('T3'), lower('T4', 1), lower('T5', -1), side('T6'), middle('T7'), rear('T8')],
  tipRadius: 0.045,
  taperPower: 2.0,
  armBend: 0.2,
  armFlatten: 0.86,
  suckers: { size: 0.22, sizePower: 0.7, spacing: 2.4, elongation: 1.15, tilt: 26, curlTilt: 64, twist: 18, rowAngle: 36, rowRadius: 0.08, shadow: 0.6 },
  // The overview's dome (P3): a wide capsule; Milestone 3 traces it.
  dome: { center: [0.1, 0.3], halfWidth: 1.6, halfHeight: 0.65, depth: 0.6, power: 3.2, mantleTop: -0.32 },
  // The head swell's own effect (`pipelineRun`, spec 7.6) comes with its task; until then the dome alone.
  headEffect: 'none',
  skin: {
    speckDensity: 0.5,
    speckSize: [0.14, 0.42],
    speckScale: 12,
    blotchDensity: 0.1,
    blotchScale: 3,
    tint: 0.6,
    translucency: 0.6,
    wetness: 1.3,
    gloss: 100,
    streakScale: 1,
    streakStrength: 0.3,
  },
  // The eager runner (spec 7.8): quicker, livelier, bouncier than the slimmer guides.
  personality: {
    blinkInterval: [2.0, 5.0],
    doubleBlinkChance: 0.3,
    gazeOmega: 22,
    headOmega: 4.2,
    sway: 0.6,
    curl: 0.9,
    float: { amplitude: 0.05, period: 4.8 },
    breathPeriod: 3.6,
    // Many short strokes: 0.38 + 0.16 + 0.32 = 0.86 s.
    swim: { recovery: 0.38, power: 0.16, glide: 0.32, fill: 0.04, squeeze: 0.06 },
    micro: {
      blink: { seconds: 0.17, doubleGap: 0.12 },
      tracking: 3.5,
      glance: { first: 2, wait: [2.0, 4.5], x: 0.45, y: 0.3, lift: 0.05 },
      saccade: { first: 0.4, wait: [0.35, 1.25], x: 0.07, y: 0.05 },
      startle: { duration: 0.6, lift: 0.05, armsIn: 0.12, eyes: 0.5, speed: 3.5, near: 0.55, cooldown: 3 },
      // Springy arrivals: 140% of the base overshoot (0.03), and a bigger happy bounce.
      settle: { duration: 0.9, amount: 0.042, cycles: 1.5 },
      arrival: { duration: 1.4, roll: 0.11, armWave: 0.18 },
    },
  },
};
