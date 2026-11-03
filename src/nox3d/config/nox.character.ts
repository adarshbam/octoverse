import type { ArmSpec, CharacterConfig } from './types';

// Nox, measured against Nox.jpeg panel 2 in the 3D spike (commit 58cf458).
// These are the baseline to upgrade component by component, not the final look.

// Arms fan out in depth from the body: centre arms forward, side arms level, upper arms back,
// top arms behind the head. The intro curves are flattened so the stage camera still sees the trace.
const rear = (id: 'T1' | 'T8'): ArmSpec => ({ id, depth: 'rear', rootRadius: 0.165, z: [-0.3, -0.62] });
const middle = (id: 'T2' | 'T7'): ArmSpec => ({ id, depth: 'middle', rootRadius: 0.18, z: [0.05, -0.32] });
const side = (id: 'T3' | 'T6'): ArmSpec => ({ id, depth: 'front', rootRadius: 0.18, z: [0.0, 0.3] });
// The centre arms show their suckers along the V between them, outside their tip curls,
// starting where the V opens below the web.
const lower = (id: 'T4' | 'T5', suckerSide: 1 | -1): ArmSpec => ({ id, depth: 'front', rootRadius: 0.18, z: [0.22, 0.5], suckerSide, suckerStart: 0.23 });

export const NOX: CharacterConfig = {
  id: 'nox',
  // Dome, notch and cheeks traced from the panel 2 rim line (junction v2).
  head: {
    centerX: 0.01, halfWidth: 0.752, waist: -0.44, top: 0.255, bottom: -1.2, topPower: 2, bottomPower: 1.8, depth: 0.82, faceOrigin: [0.035, -0.42],
    cheeks: { y: -0.835, distance: 0.678, angle: 72, radius: 0.115, blend: 0.08 },
  },
  glow: {
    center: [0.05, -0.97, 0.6],
    spreadX: 0.58,
    reachUp: 0.45,
    reachDown: 0.2,
    // The face glow. The approved ramp from before the Task 5 palette: the owner restored every
    // stop (ruling R26, 2026-10-27) after the R23 middle stops turned the glow between the eyes
    // crimson. The R23 body colours below stay.
    ramp: [
      [0, '#0a0d2c'], [0.07, '#1e0c30'], [0.17, '#45133e'], [0.27, '#641542'], [0.37, '#891d45'],
      [0.49, '#b9254b'], [0.61, '#e8364d'], [0.74, '#fb5254'], [0.94, '#fd7c5b'], [1, '#ff8765'],
    ],
    // Traced from the high-quality panel 2: the face glow warms the cheeks, and a magenta glow
    // fades about 0.2 out from the outline, red below the cup bands.
    cheekWarmth: 0.75,
    // The arms' red oral band. It was a constant 0.95 in the skin shader; moved here (ruling R23)
    // and raised to 1.6 with the Task 5 palette, so the undersides glow red as in panel 2.
    underside: 1.6,
    // Halo colours from the Task 5 palette: a magenta-pink outline round the head and along the
    // arm tops, a deep violet over the crown, deep red below. Widths and strengths unchanged.
    halo: { headWidth: 0.05, armWidth: 0.035, color: '#d82090', crown: '#7a28c0', band: '#e80a24', strength: 0.75, bandStrength: 0.9 },
    // In a world (panel 2): a magenta-violet glow in the water round him, deep red below, and
    // the water near him darker and warmer than the far blue. Tuned in Task 5 against the water
    // 10 to 60 px round him in panel 2: dark violet above, red below.
    aura: { inner: '#1c0628', low: '#ff0a18', radius: 3.6, strength: 1 },
    grade: { color: '#1c0612', radius: 4, strength: 1 },
  },
  // The Task 5 palette (R23), measured against panel 2 in the world and approved by the owner as
  // Nox's palette in every stage (2026-10-27, R25): deep blue-violet arm tops, a thin blue-violet
  // top rim over a blue-violet wet sheen, and red undersides. The cheek, the blotches, the sucker
  // colours and the dome are the earlier ones (see nox.character.test.ts).
  palette: {
    cheek: '#7a1078',
    headEdge: '#5c148c',
    rimTop: '#6a38ff',
    rimLow: '#a00838',
    sky: '#3a48c8',
    blotch: '#0c0a3a',
    tintCool: '#3040ff',
    tintWarm: '#8c3090',
    wet: '#5030e0',
    armBody: '#3a0864',
    terminator: '#d80848',
    armGlow: '#ff4a5a',
    belly: '#ff0428',
    suckerEdge: '#c8102c',
    suckerBody: '#fb7350',
    suckerHot: '#fd8a60',
    suckerHollow: '#e2232f',
    suckerShadow: '#2a0212',
    domeTint: '#0c0720',
    domeRim: '#ff3a78',
    domeRimTop: '#ff86c4',
    domeSheen: '#ff8fc8',
  },
  face: {
    // Placed and sized from panel 2; border, lid and iris layers traced from the
    // high-quality face reference (docs/design/references/Nox-face-hq.png).
    eye: {
      rx: 0.155,
      ry: 0.16,
      centers: [[-0.366, -0.197], [0.366, -0.197]],
      border: { outer: 0.023, upperOuter: 0.031, top: 0.032, upperInner: 0.022, inner: 0.008, lowerInner: 0.008, bottom: 0.0075, lowerOuter: 0.011 },
      iris: { rx: 0.8, ry: 0.96, inset: 0.23, rim: 0.12 },
      pupil: { rx: 0.55, ry: 0.6, drop: 0.11, inner: { dx: -0.15, dy: 0.05, rx: 0.7, ry: 0.85 } },
      catchlights: [{ x: -0.51, y: 0.47, r: 0.185 }, { x: 0.47, y: 0.5, r: 0.125 }],
      glows: [
        { x: -0.62, y: -0.38, rx: 0.34, ry: 0.4, strength: 0.9 },
        { x: 0.66, y: -0.36, rx: 0.3, ry: 0.36, strength: 0.75 },
        { x: 0, y: -0.72, rx: 0.55, ry: 0.26, strength: 0.8 },
      ],
      spot: { x: 0.05, y: -0.76, rx: 0.24, ry: 0.13 },
      lid: { inner: 0.012, outer: 0.016 },
      rim: 0.01,
      fold: { width: 0.008, band: 0.016, from: -0.7, to: 0.7 },
      // Three clear lashes curling out from the outer top corner (owner: lashes were too small).
      lashes: [
        { at: 0.52, length: 0.042, width: 0.016, angle: 82 },
        { at: 0.72, length: 0.052, width: 0.019, angle: 58 },
        { at: 0.89, length: 0.046, width: 0.017, angle: 32 },
      ],
    },
    // Traced from panel 2 (both brows averaged, then scaled by 1/1.044 for the face's depth
    // in the perspective camera): a flat inner run, then the outer end hooks down.
    brow: { inner: [0.311, 0.167], control: [0.415, 0.173], outer: [0.4645, 0.111], thickness: 0.028 },
    // Mouth and blush traced from panel 2 (mouth task), placed for the face's depth in the camera.
    mouth: { center: [0.023, -0.42], halfWidth: 0.106, depth: 0.048, thickness: 0.015, dimple: 0.0095 },
    blush: { centers: [[-0.51, -0.406], [0.51, -0.406]], rx: 0.105, ry: 0.055 },
  },
  facePalette: {
    sclera: ['#7a1f62', '#fdf2f0', '#f2a2c2', '#b04479'],
    iris: ['#1c0003', '#5c010f', '#f5241c'],
    irisRim: ['#16000a', '#a00c16'],
    irisGlow: '#ff3424',
    irisPool: '#fdab76',
    irisPoolEdge: '#ff5a3c',
    pupil: ['#180104', '#3a0108'],
    pupilRing: '#120000',
    catchlight: '#fff7f5',
    lid: '#0b0008',
    border: ['#0b0008', '#22030f', '#a01c42'],
    lidFold: '#22001c',
    lidSkin: '#7a2276',
    outline: '#fbd3d6',
    brow: '#030016',
    mouth: '#3a0600',
    mouthInside: '#3a0a1c',
    tongue: '#ff6a7a',
    blush: '#ff5a5e',
    blushGlow: '#e8344c',
  },
  arms: [rear('T1'), middle('T2'), side('T3'), lower('T4', 1), lower('T5', -1), side('T6'), middle('T7'), rear('T8')],
  // Arm thickness traced from the high-quality panel 2: full through the middle, tapering into the curls.
  tipRadius: 0.042,
  taperPower: 2.2,
  // Owner: arms should bend at several points along their whole length, not only curl at the tips.
  armBend: 0.2,
  armFlatten: 0.86,
  // Cups traced from the high-quality panel 2: ~0.1 across mid-arm, oval as they turn toward the viewer.
  // Traced from the high-quality panel 3 (scripts/hq3.py): the dome spans x -1.38..1.51 and
  // y 0.0..1.25 in world units, over the body placed at (0.03, 0.353).
  dome: { center: [0.035, 0.272], halfWidth: 1.445, halfHeight: 0.625, depth: 0.6, power: 3.2, mantleTop: -0.32 },
  // The owner's choice for the head swell (ledger R57): "Glowing red glyphs", runes like the world's glyph panels.
  headEffect: 'glyphs',
  suckers: { size: 0.235, sizePower: 0.7, spacing: 2.35, elongation: 1.18, tilt: 26, curlTilt: 64, twist: 18, rowAngle: 36, rowRadius: 0.08, shadow: 0.85 },
  // Skin detail traced from the high-quality panel 2: droplet bumps 0.01 to 0.035 across, dark
  // blotches, bluish and reddish drift, sharp wet highlights and warm light through the underside.
  skin: {
    speckDensity: 0.5,
    speckSize: [0.14, 0.42],
    speckScale: 12,
    blotchDensity: 0.15,
    blotchScale: 3,
    tint: 0.6,
    translucency: 0.6,
    wetness: 1.5,
    gloss: 140,
    streakScale: 1,
    streakStrength: 0.35,
  },
  personality: {
    blinkInterval: [2.6, 7.0],
    doubleBlinkChance: 0.2,
    gazeOmega: 16,
    headOmega: 3.2,
    sway: 0.5,
    curl: 1.1,
    float: { amplitude: 0.045, period: 6.2 },
    breathPeriod: 4.6,
    // Spec 9.5: a slow opening, a fast sweep back, then a glide; the mantle fills 4% and squeezes 6%.
    swim: { recovery: 0.52, power: 0.21, glide: 0.6, fill: 0.04, squeeze: 0.06 },
    // Design 9.7. Blink, tracking, glance and saccade values are the ones ambient.ts and
    // attention.ts had in code (unchanged); startle, settle and arrival are new (Task 25).
    micro: {
      blink: { seconds: 0.17, doubleGap: 0.12 },
      tracking: 3.5,
      glance: { first: 2, wait: [2.0, 4.5], x: 0.45, y: 0.3, lift: 0.05 },
      saccade: { first: 0.4, wait: [0.35, 1.25], x: 0.07, y: 0.05 },
      startle: { duration: 0.6, lift: 0.05, armsIn: 0.12, eyes: 0.5, speed: 3.5, near: 0.55, cooldown: 3 },
      settle: { duration: 0.9, amount: 0.03, cycles: 1.5 },
      arrival: { duration: 1.4, roll: 0.09, armWave: 0.14 },
    },
  },
};
