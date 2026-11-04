import type { ArmSpec, CharacterConfig } from '../../engine/config/types';
import type { StageLighting } from '../../engine/config/lighting';

// Flux, "the Pipeline Runner" (spec 7.1, 7.2, 7.3, 7.8), traced against Flux panel 2 (P2, 511 x 510
// native px; 1 unit = 100 px, origin at the panel's centre, +y up). This is the first pass (Task 2):
// the head's size, the face's place, the arms' anatomy, the blue-violet-pink palette and the eager
// personality. Task 3 gives the body its jelly look, its sparkles and the cups their style (start
// values, Task 6 tunes them); Task 4 the face's layers, colours and expressions (traced from the 3x P2).

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
    // Eyes large and round at about x +-0.37, y -0.54 in the stage (the face origin is at y -0.44),
    // traced from the 3x P2 panel (spec 2.3, 7.3).
    eye: {
      rx: 0.165,
      ry: 0.175,
      centers: [[-0.37, -0.1], [0.37, -0.1]],
      // A heavy dark lash line along the top, thin beside the nose and along the bottom.
      border: { outer: 0.024, upperOuter: 0.034, top: 0.034, upperInner: 0.024, inner: 0.008, lowerInner: 0.008, bottom: 0.008, lowerOuter: 0.012 },
      // A big iris set a little toward the nose, leaving a white crescent on the outer side; the
      // black pupil nearly fills its dark upper part.
      iris: { rx: 0.84, ry: 0.92, inset: 0.18, rim: 0.1 },
      pupil: { rx: 0.64, ry: 0.68, drop: -0.02, inner: { dx: -0.12, dy: 0.06, rx: 0.65, ry: 0.8 } },
      // Two white catchlights high in the iris: a large one upper left, a smaller one upper right.
      catchlights: [{ x: -0.42, y: 0.5, r: 0.18 }, { x: 0.42, y: 0.56, r: 0.12 }],
      // The violet-lavender light low in the iris only.
      glows: [
        { x: -0.55, y: -0.45, rx: 0.32, ry: 0.36, strength: 0.75 },
        { x: 0.55, y: -0.43, rx: 0.3, ry: 0.34, strength: 0.65 },
        { x: 0, y: -0.74, rx: 0.6, ry: 0.24, strength: 0.85 },
      ],
      spot: { x: 0.05, y: -0.78, rx: 0.28, ry: 0.13 },
      lid: { inner: 0.012, outer: 0.018 },
      rim: 0.01,
      fold: { width: 0.008, band: 0.016, from: -0.7, to: 0.7 },
      // Two short lashes flicking out at each outer corner.
      lashes: [
        { at: 0.78, length: 0.046, width: 0.018, angle: 52 },
        { at: 0.93, length: 0.048, width: 0.018, angle: 24 },
      ],
    },
    // Short, thick, dark navy arcs set high (P2: about 0.2 above the lid), arched, the outer end
    // hooking down; thicker than Nox's.
    brow: { inner: [0.31, 0.26], control: [0.4, 0.33], outer: [0.47, 0.2], thickness: 0.034 },
    // A wide open "D" smile: a nearly flat top and a deep round bottom (P2: corners at y -0.72, the
    // bottom at -0.89); closed it is a wide, shallow upturned line. The blush under the outer eye corners.
    mouth: { center: [0.01, -0.28], halfWidth: 0.14, depth: 0.026, thickness: 0.018, dimple: 0.014 },
    blush: { centers: [[-0.52, -0.31], [0.52, -0.31]], rx: 0.12, ry: 0.075 },
  },
  facePalette: {
    // Navy-black irises (P2's upper iris: 7, 0, 65) turning violet-lavender at the bottom (188, 128,
    // 255 to 222, 170, 245); a white sclera with a faint lavender edge (248, 208, 255).
    sclera: ['#7a70c0', '#fcf8ff', '#f6dcff', '#c8a8f0'],
    iris: ['#06043a', '#2a1c98', '#c890ff'],
    irisRim: ['#04031c', '#5a3cc8'],
    irisGlow: '#a070ff',
    irisPool: '#e4b4ff',
    irisPoolEdge: '#8a50f0',
    pupil: ['#000010', '#02021a'],
    pupilRing: '#000008',
    catchlight: '#ffffff',
    lid: '#0a0228',
    border: ['#0a0228', '#14104a', '#7a6ad0'],
    lidFold: '#1a1860',
    lidSkin: '#6a58e8',
    outline: '#f0e4ff',
    // Deep navy-blue brows (P2's darkest brow pixels: 8, 10, 147).
    brow: '#060880',
    // A dark plum rim and inside (P2: 62, 22, 74), set darker than the sample because the face glow
    // lifts it in the render (about 108, 71, 94 at this value); a pink tongue (239, 90, 119).
    mouth: '#120216',
    mouthInside: '#140418',
    tongue: '#f45a7a',
    // Pink blush, stronger than Veyra's peach (P2: 250, 155, 205).
    blush: '#ff8cc4',
    blushGlow: '#ff6ab4',
  },
  // The intro and overview faces are the big open smile (P2), with a stronger blush; the tech-focus
  // face is the eager one (spec 7.3): eyes wider, brows up, mouth a little open.
  expressions: {
    happy: { mouthOpen: 1, blush: 0.6 },
    focused: { lidRest: -0.06, browLift: 0.5, browTilt: 0.1, mouthCurve: 0.7, mouthOpen: 0.3, blush: 0.45 },
  },
  arms: [rear('T1'), middle('T2'), side('T3'), lower('T4', 1), lower('T5', -1), side('T6'), middle('T7'), rear('T8')],
  tipRadius: 0.045,
  taperPower: 2.0,
  armBend: 0.2,
  armFlatten: 0.86,
  // Separate glowing pink ovals (spec 7.2), not a frill: each cup sits flat on the arm with a clear gap
  // to the next (spacing 2.6) and its rim stands barely proud (scallop 0.1). The cup edge and rim are
  // P2's cup glow (243, 175, 239); the hollow is a deeper violet-pink. The cups shrink faster than the
  // arm toward the tip (sizePower 0.9), and glow 1.2 keeps them lit in the dark water.
  suckers: {
    size: 0.22, sizePower: 0.9, spacing: 2.6, elongation: 1.15, tilt: 26, curlTilt: 64, twist: 18, rowAngle: 36, rowRadius: 0.08, shadow: 0.6,
    style: { rimWidth: 0.18, scallop: 0.1, edge: '#f3afef', rim: '#f3afef', hollow: '#a850c8', glow: 1.2 },
    // The cup pulse (spec 2.4, 7.5): root to tip in 0.75 s (speed 1.33), lighting 3 to 5 cups at once
    // (wavelength 0.17); the leading cups electric cyan, the middle lavender, the tail the cup pink.
    // Strength is a starting value: Task 6 tunes it against the 2.4 brightness cap.
    pulse: { speed: 1.33, wavelength: 0.17, strength: 0.6, colours: ['#30e8ff', '#b8a0ff', '#f3afef'] },
  },
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
    // Jelly glass on the mantle and the arms (spec 7.2) with fine sparkles over both, denser than Veyra's (70 and 50 against her 50 and 35; spec 7.2). Start values from
    // the P2 samples (Task 6 tunes them): the mantle goes electric blue (48, 68, 239) at the crown to
    // violet (156, 87, 239) in the thick middle, with a blue rim (61, 116, 233) and a warm pink-white
    // core (254, 171, 207) sitting just below the mouth. The arms are bluer: a pale periwinkle rim
    // (110, 126, 247), a deep blue body (55, 74, 241) and only a violet hint of core.
    surfaces: {
      mantle: {
        mode: 'jelly',
        jelly: { rim: '#3d74e9', rimPower: 4, crown: '#3044ef', crownHeight: 0.5, depth: '#9c57ef', depthStrength: 1, core: '#feabcf', coreCenter: [0, -0.2, -0.35], coreWarmth: 1.4 },
        sparkle: 70,
      },
      arms: {
        mode: 'jelly',
        jelly: { rim: '#6d7df6', rimPower: 4, crown: '#4658f3', crownHeight: 0.5, depth: '#374af1', depthStrength: 0.5, core: '#c070f0', coreCenter: [0, -0.2, -0.35], coreWarmth: 0.3 },
        sparkle: 50,
      },
    },
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
