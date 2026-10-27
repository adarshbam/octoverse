import { expect, test } from 'vitest';
import { NOX } from './nox.character';

// Guard (ruling R25). The owner approved the R23 palette as Nox's own and kept these exactly as
// they were before it: the face (its palette and canvas, the blush, the eyes), the glow ramp's
// end stops and stop positions (the face glow), the sucker colours and the halo's widths and
// strengths. They are written out here as literals, so an edit to nox.character.ts cannot change
// them without this test failing.

test('the face palette is the one the owner kept', () => {
  expect(NOX.facePalette).toEqual({
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
  });
  // The cheek lobes' colour belongs to the face too.
  expect(NOX.palette.cheek).toBe('#7a1078');
});

test('the face canvas and the eyes are the ones the owner kept', () => {
  expect(NOX.face).toEqual({
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
      lashes: [
        { at: 0.52, length: 0.042, width: 0.016, angle: 82 },
        { at: 0.72, length: 0.052, width: 0.019, angle: 58 },
        { at: 0.89, length: 0.046, width: 0.017, angle: 32 },
      ],
    },
    brow: { inner: [0.311, 0.167], control: [0.415, 0.173], outer: [0.4645, 0.111], thickness: 0.028 },
    mouth: { center: [0.023, -0.42], halfWidth: 0.106, depth: 0.048, thickness: 0.015, dimple: 0.0095 },
    blush: { centers: [[-0.51, -0.406], [0.51, -0.406]], rx: 0.105, ry: 0.055 },
  });
});

test('the glow ramp keeps its end stops and its stop positions', () => {
  const ramp = NOX.glow.ramp;
  expect(ramp.map(([at]) => at)).toEqual([0, 0.07, 0.17, 0.27, 0.37, 0.49, 0.61, 0.74, 0.94, 1]);
  // The dark dome and the face glow's coral heart.
  expect(ramp[0]).toEqual([0, '#0a0d2c']);
  expect(ramp[ramp.length - 1]).toEqual([1, '#ff8765']);
});

test('the sucker colours are the ones the owner kept', () => {
  const { suckerEdge, suckerBody, suckerHot, suckerHollow, suckerShadow } = NOX.palette;
  expect({ suckerEdge, suckerBody, suckerHot, suckerHollow, suckerShadow }).toEqual({
    suckerEdge: '#c8102c',
    suckerBody: '#fb7350',
    suckerHot: '#fd8a60',
    suckerHollow: '#e2232f',
    suckerShadow: '#2a0212',
  });
});

test('the halo keeps its widths and strengths', () => {
  const { headWidth, armWidth, strength, bandStrength } = NOX.glow.halo;
  expect({ headWidth, armWidth, strength, bandStrength }).toEqual({ headWidth: 0.05, armWidth: 0.035, strength: 0.75, bandStrength: 0.9 });
});

test('Nox has exactly eight arms, T1 to T8', () => {
  expect(NOX.arms.map(arm => arm.id)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']);
});
