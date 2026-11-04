import type { ArmSpec, CharacterConfig } from '../../engine/config/types';
import type { StageLighting } from '../../engine/config/lighting';

// Flux, "the Pipeline Runner" (spec 7.1, 7.2, 7.3, 7.8), traced against Flux panel 2 (P2, 511 x 510
// native px; 1 unit = 100 px, origin at the panel's centre, +y up). This is the first pass (Task 2):
// the head's size, the face's place, the arms' anatomy, the blue-violet-pink palette and the eager
// personality. Task 3 gives the body its jelly look, its sparkles and the cups their style (start
// values, Task 6 tunes them); Task 4 the face's layers, colours and expressions (traced from the 3x P2).

// Arms fan out in depth from the body as Nox's do (rear arms behind the head, side arms in front),
// a touch thicker at the root than a slimmer octopus, and they taper steadily to the tip. Task 6 set the
// thickness against the P2 mask: the middle and side arms are as thick as P2's (about 0.3 across at
// mid-arm), the rear arms beside the head slimmer.
const rear = (id: 'T1' | 'T8'): ArmSpec => ({ id, depth: 'rear', rootRadius: 0.17, z: [-0.3, -0.62] });
const middle = (id: 'T2' | 'T7'): ArmSpec => ({ id, depth: 'middle', rootRadius: 0.22, z: [0.05, -0.32] });
const side = (id: 'T3' | 'T6'): ArmSpec => ({ id, depth: 'front', rootRadius: 0.225, z: [0.0, 0.3] });
// The two centre arms show their cups along the V between them, inside their tip curls.
const lower = (id: 'T4' | 'T5', suckerSide: 1 | -1): ArmSpec => ({ id, depth: 'front', rootRadius: 0.21, z: [0.22, 0.5], suckerSide, suckerStart: 0.23 });

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
  // Dome, cheeks and the face's origin traced from P2: soft cheek lobes at eye level (radius about
  // 0.08), the face in the lower half with its eyes at y -0.54. Task 6 fitted the dome to the P2 mask's
  // rows (less the mask's 1 to 2 px of rim glow): half width 0.76, top 0.29, a fuller upper dome
  // (topPower 2.2), so the head is as round and wide above the eyes as P2's.
  head: {
    centerX: 0, halfWidth: 0.76, waist: -0.5, top: 0.29, bottom: -1.2, topPower: 2.2, bottomPower: 1.8, depth: 0.82, faceOrigin: [0, -0.44],
    cheeks: { y: -0.58, distance: 0.66, angle: 72, radius: 0.08, blend: 0.08 },
  },
  glow: {
    // The face glow sits low in the face (spec 2.2: about y -0.70), pink-white at its core.
    center: [0, -0.7, 0.6],
    core: '#feabcf',
    light: { color: '#d070ff', intensity: 5, distance: 6, decay: 2 },
    spreadX: 0.6,
    reachUp: 0.5,
    // Reaching down to the chin (Task 6: 0.3 left the chin violet-blue), so the glow washes it pink-violet.
    reachDown: 0.4,
    // The mantle by glow strength: electric blue crown (48, 68, 239), the violet middle (156, 87, 239),
    // the chin's violet-pink (214, 125, 243), the pink-white face glow (254, 171, 207). The two top stops
    // are pinker and less blue than the face sample (Task 6): bloom and the jelly core add blue-white
    // over them, and the face renders at about (255, 166, 201).
    ramp: [[0, '#3044ef'], [0.2, '#3a50ef'], [0.4, '#9c57ef'], [0.65, '#d67df3'], [0.85, '#f896b4'], [1, '#ff98a8']],
    cheekWarmth: 0.7,
    underside: 1.5,
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
    // The overview dome (P3, Task 11): a deep navy-blue glass body (P3's inside runs from 7, 63, 178
    // under the crown to 13, 21, 81 at the bottom; one tint over the world's water lands between
    // them), an electric-blue rim turning blue-white over the crown (P3's top rim peaks at 200, 253, 255).
    domeTint: '#02188e',
    domeRim: '#4a9cff',
    domeRimTop: '#b0f0ff',
    domeSheen: '#80c8ff',
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
    // A dark plum rim and inside (P2: 62, 22, 74), set darker than the sample; a pink tongue (239, 90,
    // 119). The jelly core used to lift them (about 108, 71, 94); since Task 6 placed the core at the
    // face glow the darkest mouth pixels render about 48, 27, 43 and the pupils about 21, 18, 26.
    mouth: '#120216',
    mouthInside: '#140418',
    tongue: '#f45a7a',
    // Pink blush, stronger than Veyra's peach (P2: 250, 155, 205); Task 6 lightened it (at #ff8cc4 it
    // rendered 247, 137, 201, too deep).
    blush: '#ffa6d4',
    blushGlow: '#ff86c4',
  },
  // The intro and overview faces are the big open smile (P2), with a stronger blush; the tech-focus
  // face is the eager one (spec 7.3): eyes wider, brows up, mouth a little open.
  expressions: {
    happy: { mouthOpen: 1, blush: 0.6 },
    focused: { lidRest: -0.06, browLift: 0.5, browTilt: 0.1, mouthCurve: 0.7, mouthOpen: 0.3, blush: 0.45 },
  },
  arms: [rear('T1'), middle('T2'), side('T3'), lower('T4', 1), lower('T5', -1), side('T6'), middle('T7'), rear('T8')],
  tipRadius: 0.05,
  taperPower: 2.0,
  armBend: 0.2,
  armFlatten: 0.86,
  // Separate glowing pink ovals (spec 7.2), not a frill: each cup sits flat on the arm with a clear gap
  // to the next (spacing 2.3) and its rim stands barely proud (scallop 0.1). The cup edge and rim are
  // P2's cup glow (243, 175, 239); the hollow is a deeper violet-pink. Task 6 made them P2's size
  // (size 0.27, sizePower 0.8: they shrink toward the tip) and set them near the arm's lower edge
  // (tilt 20), so they read as P2's glowing scallops along the underside, not coins on the arm's face
  // (tilt 12 hid the root cups, and their pulse, edge-on); a lighter rim and glow 2 make them glow
  // pink-white like P2's. At glow 2.5 or more the resting curl cups already reach 254 and the bloom
  // hazes the water; at 1.8 the T1 arm body sample falls out of tolerance.
  suckers: {
    size: 0.27, sizePower: 0.8, spacing: 2.3, elongation: 1.15, tilt: 20, curlTilt: 64, twist: 18, rowAngle: 36, rowRadius: 0.08, shadow: 0.6,
    style: { rimWidth: 0.18, scallop: 0.1, edge: '#f6bcf2', rim: '#f6bcf2', hollow: '#b860d8', glow: 2 },
    // The cup pulse (spec 2.4, 7.5): root to tip in 0.75 s (speed 1.33), lighting 3 to 5 cups at once
    // (wavelength 0.17); the leading cups electric cyan, the middle lavender, the tail a warmer pink.
    // Task 6: at strength 0.6 the head read grey-cyan and the lavender and pink stages did not part
    // from the resting pink cup; strength 0.85 with a deeper cyan, a bluer violet and a hotter pink
    // makes each stage read. The 2.4 cap holds at P2 size (brightest pulsed cup 3x3: T2 @0.6
    // 152, 116, 246; T7 @0.6 151, 124, 250): the pulse shifts the hue at the cup's own peak.
    pulse: { speed: 1.33, wavelength: 0.17, strength: 0.85, colours: ['#20e0ff', '#9a78ff', '#ff8ce0'] },
  },
  // The overview's dome (P3), in the space the head is authored in: Task 11 fitted a superellipse to
  // P3's outer rim line (rms 0.012 units; review/p3_targets.json): in the stage it is centred at
  // (0.02, 0.53), 1.5 by 0.96 half-axes, rounder at the corners than Nox's (power 2.6). The rendered
  // rim line peaks about 0.015 inside the dome's outline, so the dome is 0.015 larger each way than
  // the painted rim line (1.52 by 0.975, its stage centre at 0.535). Less the overview body (0.02,
  // 0.13), its centre here is (0, 0.405). Its bottom (stage y -0.44) runs behind the face at eye
  // level (P3's irises at -0.415), so only its rim either side of the head shows, at about y -0.28 by
  // x +-1, as painted. The mantle sinks to -0.32 (stage -0.19), where P3's head top shows under the
  // glass (-0.2).
  dome: { center: [0, 0.405], halfWidth: 1.52, halfHeight: 0.975, depth: 0.6, power: 2.6, mantleTop: -0.32 },
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
    // Jelly glass on the mantle and the arms (spec 7.2) with fine sparkles over both, denser than
    // Veyra's (70 and 50 against her 50 and 35; spec 7.2). Colours from the P2 samples, tuned in Task 6.
    // Mantle: electric blue (48, 68, 239) at the crown, violet (156, 87, 239) in the thick middle, a
    // blue rim (61, 116, 233) and a warm pink-white core (254, 171, 207) at the mouth. The crown cap
    // starts low (crownHeight 0.35) and the depth is half strength, so only the middle facing the camera
    // is violet and the sides stay blue. The core sits at the mouth: coreCenter is an offset from the
    // face glow's centre in head space, here 0.12 below it, at warmth 1. The shader takes the core's
    // ramp colour with max() over the skin's, so a core weaker than the face glow (as when it sat lower,
    // at the chin) pulls the ramp's violet blue into the face and lifts the pupils and the mouth.
    // Arms: bluer, a deep blue body (55, 74, 241) with a pale periwinkle cap along the top (crown
    // #7f8cf8 from N.y 0.5; P2's top is 110, 126, 247) and only a violet hint of core. Lower caps paled
    // the body and pulled its saturation below P2's band.
    surfaces: {
      mantle: {
        mode: 'jelly',
        jelly: { rim: '#3d74e9', rimPower: 2.5, crown: '#3044ef', crownHeight: 0.35, depth: '#9c57ef', depthStrength: 0.5, core: '#feabcf', coreCenter: [0, -0.12, -0.35], coreWarmth: 1 },
        sparkle: 70,
      },
      arms: {
        mode: 'jelly',
        jelly: { rim: '#6d7df6', rimPower: 4, crown: '#7f8cf8', crownHeight: 0.5, depth: '#3e5af5', depthStrength: 0.5, core: '#c070f0', coreCenter: [0, -0.2, -0.35], coreWarmth: 0.3 },
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
