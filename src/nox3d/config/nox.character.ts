import type { ArmSpec, CharacterConfig } from './types';

// Nox, measured against Nox.jpeg panel 2 in the 3D spike (commit 58cf458).
// These are the baseline to upgrade component by component, not the final look.

const rear = (id: 'T1' | 'T8'): ArmSpec => ({ id, depth: 'rear', rootRadius: 0.15, z: [-0.3, -0.42] });
const middle = (id: 'T2' | 'T7'): ArmSpec => ({ id, depth: 'middle', rootRadius: 0.17, z: [-0.1, -0.22] });
const side = (id: 'T3' | 'T6'): ArmSpec => ({ id, depth: 'front', rootRadius: 0.165, z: [0.15, 0.06] });
const lower = (id: 'T4' | 'T5'): ArmSpec => ({ id, depth: 'front', rootRadius: 0.158, z: [0.22, 0.25] });

export const NOX: CharacterConfig = {
  id: 'nox',
  head: { centerX: 0.01, halfWidth: 0.778, waist: -0.508, top: 0.27, bottom: -1.22, topPower: 2, bottomPower: 2.3, depth: 0.82, faceOrigin: [0.035, -0.42] },
  glow: {
    center: [0.05, -0.97, 0.6],
    spreadX: 0.42,
    reachUp: 0.45,
    reachDown: 0.2,
    ramp: [
      [0, '#0a0d2c'], [0.07, '#1e0c30'], [0.17, '#45133e'], [0.27, '#641542'], [0.37, '#891d45'],
      [0.49, '#b9254b'], [0.61, '#e8364d'], [0.74, '#fb5254'], [0.94, '#fd7c5b'], [1, '#ff8765'],
    ],
  },
  palette: {
    cheek: '#7b1d59',
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
    eye: { rx: 0.178, ry: 0.1875, centers: [[-0.358, -0.213], [0.358, -0.213]] },
    brow: { centers: [[-0.4, 0.13], [0.4, 0.13]], width: 0.169, thickness: 0.0125 },
    mouth: { center: [0.015, -0.432], halfWidth: 0.122 },
    blush: { centers: [[-0.535, -0.43], [0.535, -0.43]], rx: 0.103, ry: 0.05 },
  },
  facePalette: {
    sclera: ['#d9a6b6', '#f4d2da', '#e08ea2'],
    iris: ['#3e0714', '#951226', '#de2232'],
    irisPool: '#ff7856',
    pupil: '#100208',
    lid: '#120510',
    outline: '#2a0814',
    brow: '#12081a',
    mouth: '#26091a',
    blush: '#ff6286',
  },
  arms: [rear('T1'), middle('T2'), side('T3'), lower('T4'), lower('T5'), side('T6'), middle('T7'), rear('T8')],
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
