import type { ExpressionId } from '../../engine/behavior/expressions';
import type { StageLighting } from '../../engine/config/lighting';
import type { ArmSpec, CharacterConfig } from '../../engine/config/types';

// The host, OctoVerse's own octopus (platform spec 7.1 to 7.5), measured against P2
// (public/octoverse/ref/p2.png: origin (256, 254), 100 px a unit, +y up). Task 2 set its shape,
// face layout and personality; Task 3 its look: jelly glass on the mantle and the arms with sparkle
// specks, peach-amber frill cups round a violet hollow, and the face's four presets (spec 7.2, 7.3),
// tuned on frozen intro stills against spec 2.1's samples (scripts/host_delta_e.py).

/**
 * The host's four face presets (spec 7.3) as the engine's existing expression ids they override
 * (amendment A1 G1: no new ids). `welcome` is the intro face and the rest face: the engine's
 * settling face (`gentle`) is overridden to the same open smile, so the face never closes to a
 * small smile between the entrance and the intro.
 */
export const HOST_FACES = {
  welcome: 'happy',
  presenting: 'attentive',
  delighted: 'focused',
  restful: 'restful',
} as const satisfies Record<string, ExpressionId>;

/** The wide open smile (P2): dark plum inside, coral tongue, brows a little raised, warm blush. */
const WELCOME = { lidRest: 0, lidBottom: 0.05, browLift: 0.15, browTilt: 0, mouthCurve: 0.9, mouthOpen: 1, blush: 0.5 } as const;

/**
 * The host's light: the shared key from above-left, a peach underglow (its warm core, spec 7.2)
 * in place of Nox's red, blue-violet bounce from the surface, and indigo haze.
 */
const HOST_LIGHTING: StageLighting = {
  key: { direction: [-0.3, 0.95, 0.1], color: '#efe8ff', intensity: 1.0, wrap: 0.22 },
  underglow: { color: '#ffa890', intensity: 0.4, wrap: 0.6 },
  ambient: { sky: '#3040c0', ground: '#a05078', intensity: 0.22 },
  haze: { color: '#140c40', near: 0.15, far: 0.9, strength: 0.35 },
};

// Arms fan out in depth from the body as Nox's do (the shared rig): the rising pair behind the
// head, the shoulder pair level, the low and centre pairs in front. Long and full at the root
// (spec 7.1): P2's arms, glowing rims and frills included, are about 0.45 across near the body and
// about 0.3 mid-arm, so every root is 0.22 (Task 3, fitted to the P2 mask's silhouette).
const rear = (id: 'T1' | 'T8'): ArmSpec => ({ id, depth: 'rear', rootRadius: 0.22, z: [-0.3, -0.62] });
const middle = (id: 'T2' | 'T7'): ArmSpec => ({ id, depth: 'middle', rootRadius: 0.22, z: [0.05, -0.32] });
const side = (id: 'T3' | 'T6'): ArmSpec => ({ id, depth: 'front', rootRadius: 0.22, z: [0.0, 0.3] });
const lower = (id: 'T4' | 'T5'): ArmSpec => ({ id, depth: 'front', rootRadius: 0.22, z: [0.22, 0.5] });

/**
 * How much nearer the camera the face is drawn than the stage plane: the face canvas lies on the
 * head's front (z = depth x half-width, about 0.71), so it shows 12 / (12 - 0.71), about 1.05
 * times larger. Face positions below are P2's, divided by this, less the face origin.
 */
const FACE_DEPTH = 1.05;
/** P2 stage units to face-canvas units about the face origin. */
const face = (x: number, y: number, origin: readonly [number, number]) => [x / FACE_DEPTH - origin[0], y / FACE_DEPTH - origin[1]] as const;

/**
 * The face origin: the face anchor (`faceAnchor`, 0.1 below it) lands on P2's eye line, y -0.56
 * (spec 2.2), with the body at the stage's centre.
 */
const FACE_ORIGIN = [0, -0.46] as const;

const EYE_LEFT = face(-0.39, -0.56, FACE_ORIGIN);
const EYE_RIGHT = face(0.39, -0.56, FACE_ORIGIN);
// P2's open mouth: corners at y -0.76, the top of the opening -0.80, the lip's bottom -0.94, so the
// dark plum inside covers P2's sample at -0.84 and the tongue (the opening's bottom third, -0.89 down)
// covers its sample at -0.91; the opening's middle is -0.85 (spec 2.2: -0.86 ± 0.04). The engine's
// shape at full opening fixes the bowl's depth at 3 times the smile line's dip, so the line sits at
// -0.778 with a shallow `depth`: P2's flat-topped D.
const MOUTH = face(0, -0.778, FACE_ORIGIN);
// Blush under the outer eye corners (spec 2.3; the eyes' outer corners are at ±0.55), as P2's ovals
// sit (native x 190 to 214 and 306 to 330): spec 2.1's blush sample, native (210, 332), is the left
// oval's inner part, and the face glow beside the mouth, native (300, 335), stays clear of the right.
const BLUSH_LEFT = face(-0.55, -0.79, FACE_ORIGIN);
const BLUSH_RIGHT = face(0.55, -0.79, FACE_ORIGIN);
// The right brow, traced from P2 (thin, dark, set high): inner end, control, outer end.
const BROW_INNER = face(0.3, -0.25, FACE_ORIGIN);
const BROW_CONTROL = face(0.4, -0.19, FACE_ORIGIN);
const BROW_OUTER = face(0.52, -0.23, FACE_ORIGIN);

export const HOST: CharacterConfig = {
  id: 'octoverse',
  lighting: HOST_LIGHTING,
  // A broad, slightly flattened jelly dome (spec 7.1), traced from the P2 mask's rim (row half-widths
  // 0.31 at y 0.29, 0.52 at 0.19, 0.69 at 0.04, 0.80 at -0.06, 0.84 at -0.11): widest at the waist,
  // a generous forehead, the face low; the neck runs full to the chin (P2 chin sample y -1.11).
  // Task 3 round 2: a taller, rounder dome (top 0.35, topPower 1.7 gives half-widths 0.30, 0.51, 0.70
  // and 0.78 at those rows, closer than round 1's 0.29, 0.54, 0.73 and 0.80) and softer lower sides
  // (bottomPower 2.45), so the head no longer reads square at the shoulders and cheeks.
  // No cheek lobes (spec 7.1): the smallest cheeks the shape takes, sunk well inside the mantle,
  // so the outline never leaves the dome line (blend > 0 is the shape's one requirement).
  head: {
    centerX: 0,
    halfWidth: 0.84,
    waist: -0.22,
    top: 0.35,
    bottom: -1.25,
    topPower: 1.7,
    bottomPower: 2.45,
    depth: 0.85,
    faceOrigin: [FACE_ORIGIN[0], FACE_ORIGIN[1]],
    cheeks: { y: -0.8, distance: 0.3, angle: 70, radius: 0.01, blend: 0.01 },
  },
  glow: {
    // The warm core under the face, centred just below the eyes (spec 7.2), filling the lower face
    // and chin.
    center: [0, -0.72, 0.6],
    core: '#ffb0a8',
    light: { color: '#ffa890', intensity: 3, distance: 5, decay: 2 },
    spreadX: 0.75,
    reachUp: 0.5,
    reachDown: 0.65,
    // Mantle colour by glow: blue-violet at the dome's sides, violet upper dome (128, 78, 230; the
    // jelly depth carries most of it), pink-violet forehead (224, 129, 208), peach face glow
    // (254, 175, 181) at the core (spec 2.1). Tuned on the render (Task 3): the top end sits more
    // orange than the target because the bloom round the bright face lifts green and blue, and the
    // spread reaches down past the chin so the lower face and chin stay peach, never lavender.
    ramp: [
      [0, '#3848d8'], [0.15, '#5a64f0'], [0.27, '#8070f4'], [0.4, '#d078d0'], [0.55, '#ec8cc8'],
      [0.7, '#fca6ac'], [0.85, '#fc9a98'], [1, '#ff9480'],
    ],
    cheekWarmth: 0.6,
    underside: 2,
    // A lavender glow round the silhouette, the blue crown light over the top, peach below the cups.
    halo: { headWidth: 0.05, armWidth: 0.035, color: '#b49cff', crown: '#5565fc', band: '#ffb0a0', strength: 0.7, bandStrength: 0.6 },
    // In the reef: a soft lavender aura, peach below; the water just outside the head stays deep
    // indigo (2, 22, 72; spec 7.2).
    aura: { inner: '#020a28', low: '#ff9a80', belowStart: 0.75, radius: 3.2, strength: 0.3 },
    grade: { color: '#021648', radius: 4, strength: 1 },
  },
  palette: {
    // The lower face below the glow's reach (the chin and the face's sides) takes this: peach, set a
    // little deeper than the chin sample (253, 181, 183) for the bloom's lift (Task 3).
    cheek: '#fc8a7c',
    headEdge: '#7a5ce8',
    rimTop: '#5565fc',
    rimLow: '#c48cff',
    sky: '#5a70ff',
    blotch: '#3a2c9c',
    tintCool: '#5060ff',
    tintWarm: '#e080c8',
    wet: '#b0a8ff',
    // Arm undersides a peach-pink glow (245, 175, 186; spec 2.1): the underside band runs from
    // peach-pink to amber toward the cups, at the engine's full strength. The lit arm is violet, lighter
    // than spec 2.1's blue-violet arm sample (58, 55, 213), which P2 takes in the shaded root beside
    // the head: there the head blocks the key light and the arm jelly's blue depth carries it.
    armBody: '#5c48e4',
    terminator: '#ffbcb4',
    armGlow: '#f5afba',
    belly: '#ffd4c0',
    // Peach-amber cup rims (248, 197, 159) round a darker violet hollow (spec 7.1).
    suckerEdge: '#e09070',
    suckerBody: '#f8c59f',
    suckerHot: '#ffd8b0',
    suckerHollow: '#6a3cb0',
    suckerShadow: '#2a1660',
    // The dome is never shown (the host never opens its head); kept in the host's lavender.
    domeTint: '#140c30',
    domeRim: '#b49cff',
    domeRimTop: '#d8c8ff',
    domeSheen: '#e0d0ff',
    orbFocus: '#c8a8ff',
    effect: { halo: 'rgba(180,156,255,0.5)', stroke: '#b49cff', core: '#f0e8ff' },
    rimHot: 'color(srgb-linear 0.85 0.8 1)',
    domeRimHot: 'color(srgb-linear 0.85 0.8 1)',
    suckerSpecular: 'color(srgb-linear 1 0.9 0.8)',
    orbGlass: {
      below: 'color(srgb-linear 1 0.6 0.4)',
      above: 'color(srgb-linear 0.6 0.5 1)',
      side: 'color(srgb-linear 0.3 0.4 1)',
      base: 'color(srgb-linear 0.002 0.002 0.006)',
    },
  },
  face: {
    // Large round eyes (spec 7.3) at P2's eye centres, (±0.39, -0.56); the opening is about 0.33
    // across in P2 inside its lash line.
    eye: {
      rx: 0.155,
      ry: 0.155,
      centers: [[EYE_LEFT[0], EYE_LEFT[1]], [EYE_RIGHT[0], EYE_RIGHT[1]]],
      border: { outer: 0.02, upperOuter: 0.028, top: 0.03, upperInner: 0.02, inner: 0.008, lowerInner: 0.008, bottom: 0.0075, lowerOuter: 0.01 },
      iris: { rx: 0.78, ry: 0.92, inset: 0.18, rim: 0.12 },
      pupil: { rx: 0.7, ry: 0.75, drop: 0.08, inner: { dx: -0.15, dy: 0.05, rx: 0.7, ry: 0.85 } },
      // Two white catchlights: large upper left, small lower right (spec 2.3).
      catchlights: [{ x: -0.45, y: 0.45, r: 0.2 }, { x: 0.42, y: -0.3, r: 0.1 }],
      glows: [
        { x: -0.6, y: -0.4, rx: 0.34, ry: 0.4, strength: 0.7 },
        { x: 0.62, y: -0.38, rx: 0.3, ry: 0.36, strength: 0.6 },
        { x: 0, y: -0.72, rx: 0.55, ry: 0.26, strength: 0.8 },
      ],
      spot: { x: 0.05, y: -0.76, rx: 0.24, ry: 0.13 },
      lid: { inner: 0.012, outer: 0.016 },
      rim: 0.01,
      fold: { width: 0.008, band: 0.014, from: -0.7, to: 0.7 },
      // Two short lashes flicking up at each outer corner (spec 7.3).
      lashes: [
        { at: 0.74, length: 0.04, width: 0.016, angle: 55 },
        { at: 0.9, length: 0.034, width: 0.014, angle: 30 },
      ],
    },
    brow: { inner: [BROW_INNER[0], BROW_INNER[1]], control: [BROW_CONTROL[0], BROW_CONTROL[1]], outer: [BROW_OUTER[0], BROW_OUTER[1]], thickness: 0.02 },
    // A wide smile; the intro's open mouth is the expression's.
    mouth: { center: [MOUTH[0], MOUTH[1]], halfWidth: 0.16, depth: 0.03, thickness: 0.016, dimple: 0.011 },
    blush: { centers: [[BLUSH_LEFT[0], BLUSH_LEFT[1]], [BLUSH_RIGHT[0], BLUSH_RIGHT[1]]], rx: 0.12, ry: 0.06 },
  },
  facePalette: {
    // Warm white sclera; plum-violet iris, dark at the top and lit pink at the bottom (spec 7.3).
    sclera: ['#5a3080', '#fff4f0', '#f8d0e0', '#8a5aa8'],
    iris: ['#2a0a40', '#6a2a90', '#e070c0'],
    irisRim: ['#1a0628', '#7a3aa0'],
    irisGlow: '#f080d0',
    irisPool: '#ffb0d0',
    irisPoolEdge: '#e070c0',
    pupil: ['#0a0410', '#1a0828'],
    pupilRing: '#06020a',
    catchlight: '#ffffff',
    lid: '#0a0614',
    border: ['#0a0614', '#2a1430', '#a05a90'],
    lidFold: '#3a1a50',
    lidSkin: '#d890c8',
    outline: '#ffd8e0',
    brow: '#1a0a28',
    mouth: '#4a0a20',
    // P2's open mouth (129, 28, 52) and tongue (250, 123, 109); blush (241, 172, 195). The inside is
    // set darker than its target: the bloom from the face round it lifts it to about (129, 45, 52).
    mouthInside: '#700018',
    tongue: '#fa7b6d',
    blush: '#f1acc3',
    // The halo round each blush oval: peach, so the face glow beside the mouth stays peach (spec 2.1).
    blushGlow: '#fca890',
  },
  expressions: {
    gentle: WELCOME,
    [HOST_FACES.welcome]: WELCOME,
    // How It Works: the open smile, brows up, eyes a little wider (the look toward the card is attend's).
    [HOST_FACES.presenting]: { lidRest: -0.08, lidBottom: 0, browLift: 0.5, browTilt: 0.1, mouthCurve: 0.9, mouthOpen: 0.85, blush: 0.45 },
    // The arrival beat: eyes squeezed into happy arcs for a moment, the mouth wide.
    [HOST_FACES.delighted]: { lidRest: 0.42, lidBottom: 0.8, browLift: 0.35, browTilt: 0.15, mouthCurve: 1, mouthOpen: 1, blush: 0.75 },
    // The idle layer's soft closed smile, never a rest face.
    [HOST_FACES.restful]: { lidRest: 0.35, lidBottom: 0.05, browLift: 0, browTilt: 0, mouthCurve: 0.45, mouthOpen: 0, blush: 0.35 },
  },
  arms: [rear('T1'), middle('T2'), side('T3'), lower('T4'), lower('T5'), side('T6'), middle('T7'), rear('T8')],
  // Rolled spiral tips (spec 7.1): thin at the very end.
  tipRadius: 0.03,
  taperPower: 2.2,
  armBend: 0.15,
  armFlatten: 0.86,
  // Large round cups packed into a scalloped frill on each underside, shrinking toward the tip
  // (spec 7.1), in Veyra's frill style: glowing peach-amber rims (248, 197, 159; spec 2.1) on a
  // saturated amber-orange wall (round 2: P2's cups read amber, not cream), round a darker violet
  // hollow. The warmest light on the character after the
  // face (spec 7.2): brighter than any world's cups. Turned only a little toward the viewer (tilt
  // 14) and packed (spacing 2.1), so they read as P2's frill along the edge with the underside glow
  // band above them (Task 3); a stronger glow blooms them to cream and lifts the water.
  suckers: {
    size: 0.3, sizePower: 0.7, spacing: 2.1, elongation: 1.08, tilt: 14, curlTilt: 64, twist: 18, rowAngle: 36, rowRadius: 0.08, shadow: 0.5,
    style: { rimWidth: 0.45, scallop: 0.8, edge: '#ffa868', rim: '#f8c59f', hollow: '#6a3cb0', glow: 1.4 },
  },
  // Required by the type; never drawn (no stage opens the head).
  dome: { center: [0, 0.2], halfWidth: 1.2, halfHeight: 0.6, depth: 0.6, power: 3, mantleTop: -0.3 },
  // No head effect, no dome (spec 7.2): the host never opens its head.
  headEffect: null,
  // Glassy jelly over a smooth skin: no blotches, a gentle tint drift, light through the flesh, one
  // soft wet highlight from above-left (spec 7.2).
  skin: {
    speckDensity: 0.35,
    speckSize: [0.1, 0.3],
    speckScale: 14,
    blotchDensity: 0,
    blotchScale: 3,
    tint: 0.3,
    translucency: 0.8,
    wetness: 1.2,
    gloss: 120,
    streakScale: 1,
    streakStrength: 0.15,
    // Jelly glass on both surfaces (spec 7.2). The mantle: a cool blue crown light (85, 101, 252), a
    // violet depth in the upper dome (128, 78, 230), the peach core (254, 175, 181) glowing through
    // the lower face just below the eyes, and a bright lavender rim all round. The arms: the same
    // glass, a lavender crown over their tops and a blue depth facing the viewer (round 2: P2's arms
    // read violet-lavender on top, not cobalt), the peach-pink underside glow (245, 175, 186) from the
    // cups warming the roots (a strong arm core). Sparkle specks per square unit: at P2 size the
    // render shows about 110 on the front of the head and several hundred across the arms (spec 2.3
    // asks at least 30 and 50); denser reads as snow, not P2's fine sparkle. The rim is kept thin
    // (rimPower 6) so it never washes the crown or the chin lavender.
    // Task 6: the crown cap starts higher (crownHeight 0.45 to 0.58). P3 (How It Works) is violet
    // (141, 78, 212) 0.23 below the top of its smaller head, where the 0.45 cap still read blue
    // (delta E 15.1); at 0.58 it reads 9.4, while P2's crown keeps B - R 140.2 (the floor is 140;
    // 0.6 broke it at 137.8) and P2's crown and upper head samples stay within 10 (5.3 and 8.3).
    surfaces: {
      mantle: {
        mode: 'jelly',
        jelly: { rim: '#b8b0ff', rimPower: 6, crown: '#5565fc', crownHeight: 0.58, depth: '#804ee6', depthStrength: 0.8, core: '#feafb5', coreCenter: [0, -0.1, -0.3], coreWarmth: 0.9 },
        sparkle: 40,
      },
      arms: {
        mode: 'jelly',
        jelly: { rim: '#c8b8ff', rimPower: 6, crown: '#8a7cff', crownHeight: 0.4, depth: '#3c44f0', depthStrength: 0.48, core: '#f5afba', coreCenter: [0, 0, -0.3], coreWarmth: 1.2 },
        sparkle: 35,
      },
    },
  },
  // Spec 7.5, the Host (start) column: attentive and friendly, buoyant, calm, graceful; warm,
  // attentive, not fidgety (Task 11, provisional until the owner's live review).
  personality: {
    blinkInterval: [3.0, 7.5],
    doubleBlinkChance: 0.18,
    gazeOmega: 14,
    headOmega: 2.8,
    sway: 0.45,
    curl: 1.1,
    float: { amplitude: 0.05, period: 6.8 },
    breathPeriod: 5.0,
    swim: { recovery: 0.58, power: 0.24, glide: 0.8, fill: 0.04, squeeze: 0.06 },
    micro: {
      blink: { seconds: 0.17, doubleGap: 0.12 },
      tracking: 3.5,
      glance: { first: 2, wait: [2.0, 4.5], x: 0.45, y: 0.3, lift: 0.05 },
      saccade: { first: 0.4, wait: [0.35, 1.25], x: 0.07, y: 0.05 },
      startle: { duration: 0.6, lift: 0.05, armsIn: 0.12, eyes: 0.5, speed: 3.5, near: 0.55, cooldown: 3 },
      // Nox's approved overshoot: `settle` 0.8 (below) lands the host at 80% of it, 0.024 (a happy landing).
      settle: { duration: 0.9, amount: 0.03, cycles: 1.5 },
      // The arrival sheet (sequences/defaults.ts) at its own 1.4 s: the wiggle's lean and arm fan at
      // their peaks; T1's two waves and the delighted face are the sheet's own props (moments.ts).
      arrival: { duration: 1.4, roll: 0.09, armWave: 0.14 },
    },
    // The host's motion personality (spec 7.5, engine contract 14.1): it lands at 80% of the
    // approved overshoot; about 3.4 times a minute (waits of 14.1 to 23.5 s, mean about 18.8 s:
    // flourish.ts draws 0.8 to 4/3 of 60 / rate) one arm gives an idle flourish (the engine picks
    // the arm and unrolls its tip; spec 7.5's upper-arm wave waits on an engine hook, moments.ts);
    // and every 9 s the head leans 0.03 rad, listening (behavior/idleTilt.ts: 4.6 s each).
    settle: 0.8,
    flourishRate: 3.4,
    idleTilt: { amplitude: 0.03, period: [9, 9] },
  },
};
