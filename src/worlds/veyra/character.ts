import type { StageLighting } from '../../engine/config/lighting';
import type { ArmSpec, CharacterConfig } from '../../engine/config/types';

// Veyra, the Keeper of Files: a calm guardian of glassy teal jelly with a warm cream face glow and
// cream-gold cups (spec 7.1 to 7.3, 7.8). Every value here is a first fit to the native P2 panel
// (src/worlds/veyra/review/targets.json: the measured samples are colour truth, ruling R-V7), the
// start of the look, not the look: the jelly material, the face, the cups and the world's light
// are tuned against P2 in the tasks that follow. There is no red anywhere in her.

/**
 * How the stage lights her: a cool white key from above left, a soft cream glow from below (the
 * cups and the face glow, not Nox's red underglow), teal bounce from the water, and a teal-green
 * haze that blends her far parts into the water.
 */
export const VEYRA_LIGHTING: StageLighting = {
  key: { direction: [-0.3, 0.95, 0.1], color: '#e6fff8', intensity: 0.85, wrap: 0.2 },
  underglow: { color: '#f2eaa0', intensity: 0.4, wrap: 0.6 },
  ambient: { sky: '#1a9ab8', ground: '#0e5a58', intensity: 0.25 },
  haze: { color: '#06303c', near: 0.15, far: 0.9, strength: 0.4 },
};

// They fan out in depth as Nox's do: the top arms behind the head, the middle ones level, the lower
// ones in front, the centre pair forward, so the stage camera still sees the trace. Each arm's root
// thickness is P2's own (Task 7, measured across each arm against the P2 mask): P2's head turns a
// little to the viewer's right, so its left arms (T1, T2) read thick, cone-like from the body, and
// its right arms (T6, T7) slimmer. Spec 7.1 asks for roots slightly slimmer than Nox's (0.165 to
// 0.18): the painting wins where they differ (T1, T2, T5 are thicker).
const rear = (id: 'T1' | 'T8', rootRadius: number): ArmSpec => ({ id, depth: 'rear', rootRadius, z: [-0.3, -0.62] });
const middle = (id: 'T2' | 'T7', rootRadius: number): ArmSpec => ({ id, depth: 'middle', rootRadius, z: [0.05, -0.32] });
const side = (id: 'T3' | 'T6', rootRadius: number): ArmSpec => ({ id, depth: 'front', rootRadius, z: [0.0, 0.3] });
// The two arms that hang down the centre (P2): their cups show along the outer edge of their curls.
const lower = (id: 'T4' | 'T5', suckerSide: 1 | -1, rootRadius: number): ArmSpec => ({ id, depth: 'front', rootRadius, z: [0.22, 0.5], suckerSide, suckerStart: 0.23 });

export const VEYRA: CharacterConfig = {
  id: 'veyra',
  lighting: VEYRA_LIGHTING,
  // A tall round dome, wider and higher than Nox's (half-width 0.88, top 0.5: Task 7's fit to P2, within spec 2.2's 0.88 to 0.96 and 0.44 to 0.52), over small
  // cheek lobes that carry the blush. The dome's axis (centerX) is also the neck the head tilts
  // about: the intro leans the head about 10 degrees (poses.ts), which carries the crown from the
  // axis to P2's x 0.06. The eyes land at y -0.50 (faceOrigin y -0.40 plus the eyes' -0.10).
  head: {
    centerX: 0.19, halfWidth: 0.88, waist: -0.42, top: 0.5, bottom: -1.15, topPower: 2, bottomPower: 1.8, depth: 0.82, faceOrigin: [0.3, -0.4],
    cheeks: { y: -0.8, distance: 0.55, angle: 72, radius: 0.1, blend: 0.08 },
  },
  glow: {
    center: [0.27, -0.66, 0.6],
    // The warm core under the face: cream-yellow at its heart, green-cream at its edge, fading into
    // teal by the eyes' top line (spec 7.2). Its light in a world is the same cream-green.
    core: '#f0eca0',
    light: { color: '#d8ee98', intensity: 4, distance: 5, decay: 2 },
    spreadX: 0.52,
    reachUp: 0.4,
    reachDown: 0.3,
    ramp: [
      [0, '#0678a4'], [0.15, '#0a8478'], [0.22, '#1f987f'], [0.31, '#3eaf8a'], [0.42, '#65c290'], [0.55, '#8ccf93'], [0.68, '#b1db95'], [0.8, '#d1e197'], [0.9, '#ebe293'], [1, '#f8e497'],
    ],
    cheekWarmth: 0.7,
    // No red oral band (spec 7.1): the undersides take a soft cream glow from the cups.
    underside: 1.1,
    // A cyan-teal outline round the head and arm tops, mint over the crown, a green-teal glow below the arms.
    halo: { headWidth: 0.03, armWidth: 0.022, color: '#2fdcd8', crown: '#6af2ff', band: '#3adcaa', strength: 0.75, bandStrength: 0.6 },
    // In a world (spec 7.2): teal near her and deep blue-green below, and the water within about
    // 3 units darker and bluer than the brighter, greener water round the plants.
    aura: { inner: '#06475a', low: '#083a40', belowStart: 0.75, radius: 3.6, strength: 0.4 },
    grade: { color: '#020e16', radius: 4, strength: 0.9 },
  },
  // Start values from the measured P2 samples: head crown (5, 171, 188), head side (7, 124, 154),
  // arm top (25, 185, 162), arm body (11, 180, 170), chin (49, 156, 126), cup rim (240, 234, 172).
  palette: {
    cheek: '#3aa890',
    headEdge: '#14b0cc',
    rimTop: '#62eaff',
    rimLow: '#2cd2b4',
    sky: '#18a6c4',
    blotch: '#0a5a66',
    tintCool: '#12bccc',
    tintWarm: '#42d29e',
    wet: '#7cf0ff',
    armBody: '#18c4b8',
    terminator: '#3ccfa4',
    armGlow: '#c2f0a2',
    belly: '#d8f0a4',
    suckerEdge: '#d8c878',
    suckerBody: '#f0e8ac',
    suckerHot: '#fff4c4',
    suckerHollow: '#8cc8a0',
    suckerShadow: '#0a3a38',
    domeTint: '#1a9eb4',
    domeRim: '#5af0ff',
    domeRimTop: '#a8fcff',
    domeSheen: '#8af4ff',
    orbFocus: '#3fe0c5',
    effect: { halo: 'rgba(63,224,197,0.5)', stroke: '#3fe0c5', core: '#d8fff4' },
    // The tints the shaders compile in, as linear light: a white-cyan rim line, the dome's reveal
    // front, the cups' warm cream highlight, and what an orb's glass picks up: green plants'
    // gold-green light from below, cyan from above, blue from the left.
    rimHot: 'color(srgb-linear 0.8 1 1)',
    domeRimHot: 'color(srgb-linear 0.8 1 1)',
    suckerSpecular: 'color(srgb-linear 1 0.95 0.75)',
    orbGlass: {
      below: 'color(srgb-linear 0.5 1 0.3)',
      above: 'color(srgb-linear 0.3 0.85 1)',
      side: 'color(srgb-linear 0.3 0.6 1)',
      base: 'color(srgb-linear 0.001 0.003 0.004)',
    },
  },
  face: {
    // Large round eyes, a little bigger than Nox's, set wide on the lower dome (P2: about 0.75
    // apart); the layers follow Nox's parametric canvas at Veyra's own layout (spec 7.3).
    eye: {
      rx: 0.17,
      ry: 0.19,
      centers: [[-0.375, -0.1], [0.375, -0.1]],
      // A dark line all round the eye (P2), heavy along the lid and on the outer side.
      border: { outer: 0.026, upperOuter: 0.036, top: 0.036, upperInner: 0.026, inner: 0.011, lowerInner: 0.012, bottom: 0.012, lowerOuter: 0.016 },
      // The iris sits toward the nose and leaves a pale crescent of sclera on the outer side; the
      // pupil is large and black, nearly filling the dark upper iris (P2 at 3x).
      iris: { rx: 0.82, ry: 0.93, inset: 0.2, rim: 0.1 },
      pupil: { rx: 0.74, ry: 0.74, drop: -0.08, inner: { dx: -0.12, dy: 0.08, rx: 0.6, ry: 0.75 } },
      // A large catchlight at the upper left and a small one high on the right (P2's right eye).
      catchlights: [{ x: -0.58, y: 0.36, r: 0.18 }, { x: 0.34, y: 0.54, r: 0.1 }],
      // The green glows low in the iris only: its upper part stays near black round the pupil.
      glows: [
        { x: -0.6, y: -0.5, rx: 0.3, ry: 0.32, strength: 0.6 },
        { x: 0.62, y: -0.48, rx: 0.28, ry: 0.3, strength: 0.5 },
        { x: 0, y: -0.76, rx: 0.6, ry: 0.24, strength: 0.85 },
      ],
      spot: { x: 0.08, y: -0.8, rx: 0.3, ry: 0.14 },
      lid: { inner: 0.012, outer: 0.02 },
      rim: 0.01,
      fold: { width: 0.008, band: 0.016, from: -0.7, to: 0.7 },
      // Two short lashes flick up at each outer corner.
      lashes: [
        { at: 0.62, length: 0.05, width: 0.018, angle: 70 },
        { at: 0.84, length: 0.056, width: 0.02, angle: 42 },
      ],
    },
    // Thin dark arcs set high over each eye (P2: a clear gap of about an eye's radius above the lid)
    // and slightly raised: a friendly, open default.
    brow: { inner: [0.3, 0.235], control: [0.385, 0.33], outer: [0.49, 0.215], thickness: 0.02 },
    // A small closed smile with tiny dimples; the blush is a soft oval under each outer eye.
    mouth: { center: [0.02, -0.255], halfWidth: 0.105, depth: 0.06, thickness: 0.017, dimple: 0.0105 },
    blush: { centers: [[-0.49, -0.285], [0.49, -0.285]], rx: 0.125, ry: 0.062 },
  },
  facePalette: {
    // Warm white eyes (P2's crescent: 252, 228, 187); a near-black green iris round the pupil,
    // rising to a bright green-gold crescent at the bottom.
    sclera: ['#8a6c60', '#fff2dc', '#fbe4c4', '#d8b090'],
    iris: ['#05241a', '#083a24', '#5cc848'],
    irisRim: ['#020e08', '#2a7a3a'],
    irisGlow: '#86dc6c',
    irisPool: '#d2ec84',
    irisPoolEdge: '#58c848',
    pupil: ['#020a08', '#06201a'],
    pupilRing: '#010503',
    catchlight: '#ffffff',
    lid: '#04181a',
    border: ['#04181a', '#0a3634', '#18705e'],
    lidFold: '#0e3a36',
    lidSkin: '#2aa492',
    outline: '#f6e8c4',
    // Dark teal, as P2's brows (0, 39, 47).
    brow: '#022a2e',
    // A dark teal-brown smile; an open one is dark maroon inside with a pink tongue, as P3 paints it
    // (the spec text says warm pink inside; the painting wins, ruling R-V8).
    mouth: '#221a12',
    mouthInside: '#7a3a40',
    tongue: '#f08a8e',
    // Peach-pink (P2's blush sample 249, 190, 138), a little warmer at the halo.
    blush: '#ffc092',
    blushGlow: '#ffa886',
  },
  // Her tech-focus face is an interested look (spec 7.3): brows up, eyes a little wider and a small
  // smile, in place of Nox's narrowed, open "focused grin". Every other face is the engine's.
  expressions: {
    focused: { browTilt: 0.1, browLift: 0.55, lidRest: -0.05, mouthCurve: 0.5, mouthOpen: 0.12, blush: 0.25 },
  },
  arms: [rear('T1', 0.22), middle('T2', 0.24), side('T3', 0.165), lower('T4', 1, 0.175), lower('T5', -1, 0.19), side('T6', 0.15), middle('T7', 0.165), rear('T8', 0.165)],
  // The root radii are per arm (above: thick upper arms, as P2 paints them); the taper comes late
  // (taperPower 0.9) so the arms stay thick almost to the curl, as P2's do, and end in a fine tip.
  tipRadius: 0.036,
  taperPower: 0.9,
  armBend: 0.2,
  armFlatten: 0.86,
  // Cream-gold cups, larger against the arm than Nox's and packed into a scalloped frill (spec 7.1):
  // raised cups whose rims stand proud of the arm's outline, cream from the P2 cup sample
  // (224, 220, 156), a brighter glowing rim and a darker teal-cream hollow. Bigger than Nox's and
  // packed nearly touching (spacing 1.85; the layout keeps a 5% gap), turned less toward the
  // viewer (tilt 12) so the row reads as a frill along the edge, with a light contact shadow.
  suckers: {
    size: 0.34, sizePower: 0.7, spacing: 1.85, elongation: 1.18, tilt: 12, curlTilt: 64, twist: 18, rowAngle: 36, rowRadius: 0.08, shadow: 0.3,
    style: { rimWidth: 0.22, scallop: 0.6, edge: '#ece4a4', rim: '#fcf4c4', hollow: '#5e8a6c', glow: 1.5 },
  },
  // The overview's wide translucent capsule (P3): a start from the same shape as Nox's, wider than the head.
  dome: { center: [0.05, 0.3], halfWidth: 1.5, halfHeight: 0.65, depth: 0.6, power: 3.2, mantleTop: -0.32 },
  // The head swell's effect: none until the vault dial (spec 7.6).
  headEffect: 'none',
  // Jelly glass on the mantle and the arms (spec 7.2), with fine bright sparkles over both and no
  // blotchy skin (spec 2.3): the skin detail underneath is turned down to a faint drift and droplets.
  skin: {
    speckDensity: 0.35,
    speckSize: [0.1, 0.3],
    speckScale: 12,
    blotchDensity: 0,
    blotchScale: 3,
    tint: 0.25,
    translucency: 0.6,
    wetness: 1.5,
    gloss: 140,
    streakScale: 1,
    streakStrength: 0.15,
    // Start values from the measured P2 samples (Task 7 tunes them against the panel): the dome's
    // crown (4, 170, 188) and its darker see-through middle (1, 95, 103), a white-cyan rim, the
    // warm cream core sitting inside behind the face; the arms mint-aqua with a brighter cyan top
    // edge and only a little depth. Sparkles per square unit: at P2's size well over the 40 the
    // close-up checklist asks for on the front of the head.
    surfaces: {
      mantle: {
        mode: 'jelly',
        jelly: { rim: '#28e2f2', rimPower: 4, crown: '#04b4c8', crownHeight: 0.5, depth: '#015f67', depthStrength: 1, core: '#f0eca0', coreCenter: [0, 0.12, -0.35], coreWarmth: 0.35 },
        sparkle: 50,
      },
      arms: {
        mode: 'jelly',
        jelly: { rim: '#46e8ec', rimPower: 4, crown: '#3ae0d4', crownHeight: 0.5, depth: '#0a9c98', depthStrength: 0.35, core: '#f0eca0', coreCenter: [0, 0.12, -0.35], coreWarmth: 0.3 },
        sparkle: 35,
      },
    },
  },
  // The calm guardian (spec 7.8): blinks less often, glances softly, sways little, rolls tight
  // coils, floats slowly, breathes slowly and swims in long glides.
  personality: {
    blinkInterval: [3.5, 8.5],
    doubleBlinkChance: 0.12,
    gazeOmega: 10,
    headOmega: 2.4,
    sway: 0.4,
    curl: 1.4,
    float: { amplitude: 0.06, period: 7.5 },
    breathPeriod: 5.4,
    swim: { recovery: 0.65, power: 0.26, glide: 1.0, fill: 0.04, squeeze: 0.06 },
    micro: {
      blink: { seconds: 0.17, doubleGap: 0.12 },
      tracking: 3.5,
      glance: { first: 2, wait: [2.0, 4.5], x: 0.45, y: 0.3, lift: 0.05 },
      saccade: { first: 0.4, wait: [0.35, 1.25], x: 0.07, y: 0.05 },
      startle: { duration: 0.6, lift: 0.05, armsIn: 0.12, eyes: 0.5, speed: 3.5, near: 0.55, cooldown: 3 },
      // Settles at 60% of Nox's overshoot (spec 7.8) and arrives with a smaller, slower wiggle.
      settle: { duration: 0.9, amount: 0.018, cycles: 1.5 },
      arrival: { duration: 2.0, roll: 0.06, armWave: 0.1 },
    },
  },
};
