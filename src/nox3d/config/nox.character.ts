import type { ArmSpec, CharacterConfig } from './types';

// Nox, measured against Nox.jpeg panel 2 in the 3D spike (commit 58cf458).
// These are the baseline to upgrade component by component, not the final look.

const rear = (id: 'T1' | 'T8'): ArmSpec => ({ id, depth: 'rear', rootRadius: 0.15, z: [-0.3, -0.42] });
const middle = (id: 'T2' | 'T7'): ArmSpec => ({ id, depth: 'middle', rootRadius: 0.17, z: [0.05, -0.22] });
const side = (id: 'T3' | 'T6'): ArmSpec => ({ id, depth: 'front', rootRadius: 0.165, z: [0.0, 0.06] });
// The centre arms show their suckers along the V between them, outside their tip curls,
// starting where the V opens below the web.
const lower = (id: 'T4' | 'T5', suckerSide: 1 | -1): ArmSpec => ({ id, depth: 'front', rootRadius: 0.158, z: [0.22, 0.25], suckerSide, suckerStart: 0.2 });

export const NOX: CharacterConfig = {
  id: 'nox',
  // Dome, notch and cheeks traced from the panel 2 rim line (junction v2).
  head: {
    centerX: 0.01, halfWidth: 0.752, waist: -0.44, top: 0.27, bottom: -1.2, topPower: 2, bottomPower: 1.8, depth: 0.82, faceOrigin: [0.035, -0.42],
    cheeks: { top: -0.7, y: -0.82, bottom: -1.1, bulge: 0.168, angle: 72, spread: 48 },
  },
  glow: {
    center: [0.05, -0.97, 0.6],
    spreadX: 0.58,
    reachUp: 0.45,
    reachDown: 0.2,
    ramp: [
      [0, '#0a0d2c'], [0.07, '#1e0c30'], [0.17, '#45133e'], [0.27, '#641542'], [0.37, '#891d45'],
      [0.49, '#b9254b'], [0.61, '#e8364d'], [0.74, '#fb5254'], [0.94, '#fd7c5b'], [1, '#ff8765'],
    ],
  },
  palette: {
    cheek: '#7c2066',
    headEdge: '#5c2a8c',
    rimTop: '#b46ad0',
    rimLow: '#e04a96',
    sky: '#3a48c8',
    speck: '#b9a6f2',
    armShadow: '#1c0628',
    armMid: '#2c0f48',
    armLit: '#4c2a7e',
    armGlow: '#ff4a5a',
    belly: '#d0244e',
    suckerEdge: '#b0183a',
    suckerBody: '#ff4a46',
    suckerHot: '#ff9a7a',
  },
  face: {
    // Traced from panel 2 (eyes task), sized and placed for the face's depth in the camera.
    eye: {
      rx: 0.155,
      ry: 0.16,
      centers: [[-0.366, -0.197], [0.366, -0.197]],
      iris: { rx: 0.8, ry: 0.97, inset: 0.2 },
      pupil: { rx: 0.52, ry: 0.62, drop: 0.04 },
      catchlights: [{ x: -0.5, y: 0.36, r: 0.19 }, { x: 0.53, y: 0.4, r: 0.145 }],
      lid: { inner: 0.012, outer: 0.03 },
      rim: 0.006,
      lashes: [{ at: 0.6, length: 0.024, angle: 70 }, { at: 0.75, length: 0.028, angle: 50 }, { at: 0.88, length: 0.026, angle: 30 }],
    },
    // Traced from panel 2 (both brows averaged, then scaled by 1/1.044 for the face's depth
    // in the perspective camera): a flat inner run, then the outer end hooks down.
    brow: { inner: [0.311, 0.167], control: [0.415, 0.173], outer: [0.4645, 0.111], thickness: 0.028 },
    // Mouth and blush traced from panel 2 (mouth task), placed for the face's depth in the camera.
    mouth: { center: [0.023, -0.42], halfWidth: 0.106, depth: 0.048, thickness: 0.015, dimple: 0.0095 },
    blush: { centers: [[-0.51, -0.406], [0.51, -0.406]], rx: 0.105, ry: 0.055 },
  },
  facePalette: {
    sclera: ['#8b3668', '#ffccec', '#fcd2dc'],
    iris: ['#110101', '#3a0d11', '#be0f27'],
    irisPool: '#fd8372',
    irisPoolEdge: '#fb3538',
    pupil: '#190003',
    catchlight: '#fff7f5',
    lid: '#0b0008',
    outline: '#f7b4c0',
    brow: '#030016',
    mouth: '#3a0600',
    mouthInside: '#3a0a1c',
    tongue: '#ff6a7a',
    blush: '#ff5a5e',
    blushGlow: '#e8344c',
  },
  arms: [rear('T1'), middle('T2'), side('T3'), lower('T4', 1), lower('T5', -1), side('T6'), middle('T7'), rear('T8')],
  tipRadius: 0.035,
  taperPower: 0.75,
  suckers: { sizeRatio: 0.6, spacing: 2.2, tilt: 12 },
  personality: {
    blinkInterval: [2.6, 7.0],
    doubleBlinkChance: 0.2,
    gazeOmega: 16,
    headOmega: 3.2,
    sway: 0.5,
    curl: 1.1,
    float: { amplitude: 0.045, period: 6.2 },
    breathPeriod: 4.6,
  },
};
