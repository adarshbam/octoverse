import type { StageLighting } from '../../engine/config/lighting';
import type { ArmSpec, CharacterConfig } from '../../engine/config/types';

// Aether, the Curious Mind (spec 7.1 to 7.3, 7.8): a small, round, lavender jelly creature with a
// pink-white glow in her face and big violet eyes. Everything here is a START value, measured
// against panel 2 of her storyboard (public/aether/ref/p2.png, 100 px to a world unit, origin at
// the panel's centre, +y up) and the colour samples in review/targets.json; the colours are tuned
// in Task 3 (character look) and Task 6, the face and moments in Task 4 and Task 16. There is no
// red anywhere in her: her light is lavender, pink-white and blue.

// Her arms leave the body at the same depths as Nox's slots: the upper side pair behind the head,
// the second pair level, the third in front, the centre pair hanging down the front. Slightly
// thinner roots than Nox's: they read as jelly ribbons (spec 7.1).
const rear = (id: 'T1' | 'T8'): ArmSpec => ({ id, depth: 'rear', rootRadius: 0.15, z: [-0.3, -0.62] });
const middle = (id: 'T2' | 'T7'): ArmSpec => ({ id, depth: 'middle', rootRadius: 0.165, z: [0.05, -0.32] });
const side = (id: 'T3' | 'T6'): ArmSpec => ({ id, depth: 'front', rootRadius: 0.17, z: [0.0, 0.3] });
// The centre pair shows its cups along the outer edges (panel 2: the left arm's on its left, the
// right arm's on its right), the opposite of Nox's V, starting where they clear the chin.
const lower = (id: 'T4' | 'T5', suckerSide: 1 | -1): ArmSpec => ({ id, depth: 'front', rootRadius: 0.17, z: [0.22, 0.5], suckerSide, suckerStart: 0.23 });

/**
 * How the stage lights her: Nox's key, but the warm underglow is lavender, not red, and the bounce
 * and the haze are indigo (INTRO_LIGHTING's ground bounce is the ruin's red, which she never has).
 */
export const AETHER_LIGHTING: StageLighting = {
  key: { direction: [-0.3, 0.95, 0.1], color: '#efe4ff', intensity: 1.0, wrap: 0.18 },
  underglow: { color: '#c890ff', intensity: 0.42, wrap: 0.6 },
  ambient: { sky: '#26309a', ground: '#4a2e9a', intensity: 0.2 },
  haze: { color: '#0a1040', near: 0.15, far: 0.9, strength: 0.4 },
};

export const AETHER: CharacterConfig = {
  id: 'aether',
  lighting: AETHER_LIGHTING,
  // A round ball, slightly wider than its height to the chin, the dome 0.73 out to either side and
  // topping out at y +0.18 (P2 mask: widest 0.755 at y -0.4, top +0.19, centre x +0.065). The face
  // sits low: its origin is where the eyes' centre line (y -0.68 in world) meets x +0.12. Small cheek
  // lobes at the face sides, no more than 0.06 outside the dome line (spec 2.2).
  head: {
    centerX: 0.07, halfWidth: 0.73, waist: -0.42, top: 0.18, bottom: -1.2, topPower: 2, bottomPower: 1.8, depth: 0.82, faceOrigin: [0.12, -0.58],
    cheeks: { y: -0.88, distance: 0.52, angle: 72, radius: 0.06, blend: 0.08 },
  },
  glow: {
    // The pink-white core sits just below the mouth (mouth y -0.90, glow centre about -0.95).
    center: [0.13, -0.95, 0.6],
    core: '#ffc8ec',
    light: { color: '#d8a0ff', intensity: 5, distance: 6, decay: 2 },
    spreadX: 0.58,
    reachUp: 0.5,
    reachDown: 0.2,
    // Deep indigo above, blue-violet, violet, then near-white pink in the lower face: the P2
    // samples (upper dome 91,78,243; forehead 155,108,247; between the eyes 250,184,242; below the
    // eyes 253,212,232). Start values, fitted in Task 3.
    ramp: [
      [0, '#0a0d2c'], [0.1, '#2a1f8a'], [0.25, '#5b4ef3'], [0.4, '#9b6cf7'], [0.55, '#c690f7'],
      [0.7, '#fab8f2'], [0.88, '#fdd4e8'], [1, '#fee3f2'],
    ],
    cheekWarmth: 0.6,
    // No red underside band (spec 7.1): her undersides glow lavender-pink from the arms' jelly core
    // and the pink-white cups, never from Nox's oral band.
    underside: 0,
    // A soft violet-blue halo round the silhouette, pinker under the face (spec 7.2).
    halo: { headWidth: 0.05, armWidth: 0.035, color: '#8f7cff', crown: '#7aa0ff', band: '#d890ff', strength: 0.75, bandStrength: 0.6 },
    // In the water: an indigo-violet aura round her, pink-violet below, and the water near her
    // a little darker and bluer than the lit water at the top.
    aura: { inner: '#201a8a', low: '#8a3ad0', belowStart: 0.75, radius: 3.6, strength: 1 },
    grade: { color: '#050a3a', radius: 3, strength: 0.7 },
  },
  palette: {
    cheek: '#c88af0',
    headEdge: '#8a70f0',
    rimTop: '#c4d4ff',
    rimLow: '#d8b4ff',
    sky: '#6f7cff',
    blotch: '#2a2a9a',
    tintCool: '#4a6cf0',
    tintWarm: '#a878f0',
    wet: '#9ab0ff',
    armBody: '#4a60e0',
    terminator: '#9a78f0',
    armGlow: '#f0b8fa',
    belly: '#f4c0f8',
    suckerEdge: '#d4a0f8',
    suckerBody: '#fadcff',
    suckerHot: '#fff2ff',
    suckerHollow: '#a688e8',
    suckerShadow: '#1e1470',
    // The overview dome: blue-violet glass, a lavender-blue rim, a blue-white sheen (P3 samples).
    domeTint: '#2a44c8',
    domeRim: '#7a9aff',
    domeRimTop: '#c4dcff',
    domeSheen: '#a4caff',
    // The in-focus orb's lavender-white rim (P4: 228,217,248).
    orbFocus: '#e4d9f8',
    // The head swell's strokes: cyan-lavender light, not Nox's red runes.
    effect: { halo: 'rgba(120,160,255,0.5)', stroke: '#9ac0ff', core: '#e8f0ff' },
    rimHot: 'color(srgb-linear 0.85 0.85 1)',
    domeRimHot: 'color(srgb-linear 0.8 0.85 1)',
    suckerSpecular: 'color(srgb-linear 1 0.9 1)',
    orbGlass: {
      below: 'color(srgb-linear 0.8 0.4 0.9)',
      above: 'color(srgb-linear 0.5 0.7 1)',
      side: 'color(srgb-linear 0.3 0.5 1)',
      base: 'color(srgb-linear 0.002 0.002 0.006)',
    },
  },
  face: {
    // Large round eyes at y -0.68 (rel. y -0.10 from the face origin), 0.345 either side of the face
    // (P2: left eye centre about (236, 320) px, right about (305, 318)). Violet irises, two catchlights
    // (large upper left, small lower right), a dark lash line and two short lashes at each outer corner.
    eye: {
      rx: 0.15,
      ry: 0.17,
      centers: [[-0.345, -0.1], [0.345, -0.1]],
      border: { outer: 0.023, upperOuter: 0.031, top: 0.032, upperInner: 0.022, inner: 0.008, lowerInner: 0.008, bottom: 0.0075, lowerOuter: 0.011 },
      iris: { rx: 0.84, ry: 0.97, inset: 0.18, rim: 0.1 },
      pupil: { rx: 0.5, ry: 0.55, drop: 0.12, inner: { dx: -0.15, dy: 0.05, rx: 0.7, ry: 0.85 } },
      catchlights: [{ x: -0.4, y: 0.42, r: 0.2 }, { x: 0.34, y: -0.3, r: 0.1 }],
      glows: [
        { x: -0.62, y: -0.38, rx: 0.34, ry: 0.4, strength: 0.9 },
        { x: 0.66, y: -0.36, rx: 0.3, ry: 0.36, strength: 0.75 },
        { x: 0, y: -0.72, rx: 0.55, ry: 0.26, strength: 0.8 },
      ],
      spot: { x: 0.05, y: -0.76, rx: 0.24, ry: 0.13 },
      lid: { inner: 0.012, outer: 0.016 },
      rim: 0.01,
      fold: { width: 0.008, band: 0.016, from: -0.7, to: 0.7 },
      lashes: [
        { at: 0.66, length: 0.04, width: 0.015, angle: 68 },
        { at: 0.84, length: 0.046, width: 0.016, angle: 38 },
      ],
    },
    // Thin dark arcs set high (P2: brows at y -0.29, rel. +0.29), a little raised: open and interested.
    brow: { inner: [0.31, 0.275], control: [0.4, 0.325], outer: [0.49, 0.265], thickness: 0.024 },
    // A small closed smile (P2: mouth at y -0.90, rel. -0.32, about 0.13 either side), and pink blush ovals under the outer corners.
    mouth: { center: [0.01, -0.32], halfWidth: 0.13, depth: 0.045, thickness: 0.014, dimple: 0.009 },
    blush: { centers: [[-0.48, -0.33], [0.48, -0.3]], rx: 0.1, ry: 0.05 },
  },
  facePalette: {
    sclera: ['#6a4aa8', '#fdf6fa', '#f6c8e0', '#a870c0'],
    iris: ['#1a0a3c', '#6a2ec8', '#d84ae0'],
    irisRim: ['#10082c', '#5a2aa8'],
    irisGlow: '#e060f0',
    irisPool: '#f8b0f4',
    irisPoolEdge: '#c050e8',
    pupil: ['#08041a', '#1a0a40'],
    pupilRing: '#06031a',
    catchlight: '#ffffff',
    lid: '#0a0420',
    border: ['#0a0420', '#20104a', '#8a60d8'],
    lidFold: '#24104a',
    lidSkin: '#a878e8',
    outline: '#f4e0fc',
    brow: '#14083a',
    mouth: '#2a0a44',
    // P4's open mouth: a dark plum inside (119,29,73) and a pink tongue (253,135,143).
    mouthInside: '#771d49',
    tongue: '#fd878f',
    blush: '#fab7ce',
    blushGlow: '#f090d0',
  },
  arms: [rear('T1'), middle('T2'), side('T3'), lower('T4', -1), lower('T5', 1), side('T6'), middle('T7'), rear('T8')],
  // Jelly ribbons: a soft, fairly even taper, a little thinner than Nox's, tips that roll loosely.
  tipRadius: 0.04,
  taperPower: 2,
  armBend: 0.16,
  armFlatten: 0.86,
  // Rounded scallop cups, packed so their edges read as a beaded frill, shrinking toward the tip.
  // Veyra's frill cups in pink-white (amendment A1): a lavender-white glowing rim (P2 cup sample
  // 222, 208, 245) over a pink wall (the underside glow, 238, 198, 250), round a dark mauve hollow
  // (inside a tip spiral, 90, 63, 144). Start values; Task 6 tunes them against P2.
  suckers: {
    size: 0.21, sizePower: 0.7, spacing: 2.15, elongation: 1.1, tilt: 26, curlTilt: 64, twist: 18, rowAngle: 36, rowRadius: 0.08, shadow: 0.6,
    style: { rimWidth: 0.22, scallop: 0.6, edge: '#eec6fa', rim: '#ded0f5', hollow: '#5a3f90', glow: 1.0 },
  },
  // The overview dome, a wide glossy capsule round the head (P3: half-width 1.38; refined in Task 11).
  dome: { center: [0.035, 0.272], halfWidth: 1.4, halfHeight: 0.62, depth: 0.6, power: 3.2, mantleTop: -0.32 },
  // The synapse effect arrives in Task 20; until then the dome swells alone.
  headEffect: 'none',
  // Jelly skin with fine star specks and a lavender-pink glow through it; tuned in Task 6.
  skin: {
    speckDensity: 0.35,
    speckSize: [0.1, 0.3],
    speckScale: 14,
    blotchDensity: 0.05,
    blotchScale: 3,
    tint: 0.5,
    translucency: 0.8,
    wetness: 1.3,
    gloss: 120,
    streakScale: 1,
    streakStrength: 0.2,
    // Veyra's jelly glass on both surfaces (spec 7.2), in Aether's colours from the P2 samples
    // (spec 2.1; start values, Task 6 tunes them to delta E 10 on the render). The mantle: a bright
    // lavender-white rim all round, a blue-white crown sheen (145, 168, 247), a deep blue-violet
    // middle where the dome faces the camera (91, 78, 243), and the pink-white core (253, 212, 232)
    // inside the lower face at the glow's own centre, just below the mouth (y -0.95), set back into
    // the jelly. The arms: the same glass set thinner, a lavender-white top rim (227, 211, 251), a
    // periwinkle body (94, 138, 228), a light blue cap along their tops and the lavender-pink
    // underside glow (238, 198, 250) warming the roots. Star specks per square unit: enough for at
    // least 15 on the front of the head and 60 across the arms at P2 size (spec 2.3).
    surfaces: {
      mantle: {
        mode: 'jelly',
        jelly: { rim: '#ebe2fb', rimPower: 3.5, crown: '#91a8f7', crownHeight: 0.55, depth: '#5b4ef3', depthStrength: 1, core: '#fdd4e8', coreCenter: [0, 0, -0.35], coreWarmth: 0.4 },
        sparkle: 30,
      },
      arms: {
        mode: 'jelly',
        jelly: { rim: '#e3d3fb', rimPower: 5, crown: '#8ab0f8', crownHeight: 0.5, depth: '#5e8ae4', depthStrength: 0.6, core: '#eec6fa', coreCenter: [0, 0, -0.35], coreWarmth: 0.35 },
        sparkle: 35,
      },
    },
  },
  // The curious mind (spec 7.8): bright and attentive, quick to notice, floaty, a jellyfish's pulse.
  personality: {
    blinkInterval: [2.8, 6.5],
    doubleBlinkChance: 0.25,
    gazeOmega: 14,
    headOmega: 2.8,
    sway: 0.55,
    curl: 1.25,
    float: { amplitude: 0.07, period: 6.8 },
    breathPeriod: 5.0,
    swim: { recovery: 0.6, power: 0.24, glide: 0.85, fill: 0.04, squeeze: 0.06 },
    micro: {
      blink: { seconds: 0.17, doubleGap: 0.12 },
      tracking: 3.5,
      glance: { first: 2, wait: [2.0, 4.5], x: 0.45, y: 0.3, lift: 0.05 },
      saccade: { first: 0.4, wait: [0.35, 1.25], x: 0.07, y: 0.05 },
      startle: { duration: 0.6, lift: 0.05, armsIn: 0.12, eyes: 0.5, speed: 3.5, near: 0.55, cooldown: 3 },
      // The settle overshoots 80% of Nox's 0.03; the arrival wiggle is Nox's size with softer timing.
      settle: { duration: 0.9, amount: 0.024, cycles: 1.5 },
      arrival: { duration: 1.6, roll: 0.09, armWave: 0.14 },
    },
  },
};
