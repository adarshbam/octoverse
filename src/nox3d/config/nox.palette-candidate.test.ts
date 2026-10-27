import * as THREE from 'three';
import { expect, test } from 'vitest';
import { NOX } from './nox.character';
import { PALETTE_CANDIDATE, RAMP_CANDIDATE, withPaletteCandidate } from './nox.palette-candidate';

const green = (hex: string) => new THREE.Color(hex).g;
const CANDIDATE_COLOURS = ['armBody', 'headEdge', 'cheek'];

test('the candidate changes only the arm body, the head edge, the cheeks and the glow ramp’s middle stops', () => {
  const candidate = withPaletteCandidate(NOX);
  const { palette, glow, ...rest } = candidate;
  const { palette: approvedPalette, glow: approvedGlow, ...approvedRest } = NOX;
  // The face, its palette, the arms, the suckers' shape and everything else are the approved ones.
  expect(rest).toEqual(approvedRest);
  // The neon rim colours, the sucker emitters, the dome and every other palette colour are untouched.
  expect(Object.keys(PALETTE_CANDIDATE).every(key => CANDIDATE_COLOURS.includes(key))).toBe(true);
  for (const key of Object.keys(approvedPalette) as (keyof typeof approvedPalette)[]) {
    expect(palette[key], key).toBe(CANDIDATE_COLOURS.includes(key) ? (PALETTE_CANDIDATE[key as keyof typeof PALETTE_CANDIDATE] ?? approvedPalette[key]) : approvedPalette[key]);
  }
  // The halo, the aura, the grade and the glow's shape are untouched; only the ramp's colours move.
  const { ramp, ...glowRest } = glow;
  const { ramp: approvedRamp, ...approvedGlowRest } = approvedGlow;
  expect(glowRest).toEqual(approvedGlowRest);
  expect(ramp.map(([at]) => at)).toEqual(approvedRamp.map(([at]) => at));
  // Every changed stop is one of the ramp's; its ends (the dark dome and the white-hot core) stay.
  const stops = approvedRamp.map(([at]) => at);
  expect(Object.keys(RAMP_CANDIDATE).map(Number).every(at => stops.includes(at))).toBe(true);
  expect(ramp[0]).toEqual(approvedRamp[0]);
  expect(ramp[ramp.length - 1]).toEqual(approvedRamp[approvedRamp.length - 1]);
});

test('every colour the candidate changes has less green than the approved one', () => {
  const candidate = withPaletteCandidate(NOX);
  const changed: [string, string][] = [];
  for (const key of CANDIDATE_COLOURS as (keyof typeof NOX.palette)[]) if (candidate.palette[key] !== NOX.palette[key]) changed.push([candidate.palette[key], NOX.palette[key]]);
  candidate.glow.ramp.forEach(([, colour], i) => {
    if (colour !== NOX.glow.ramp[i][1]) changed.push([colour, NOX.glow.ramp[i][1]]);
  });
  expect(changed.length).toBeGreaterThan(0);
  for (const [next, approved] of changed) expect(green(next), `${approved} -> ${next}`).toBeLessThan(green(approved));
});

test('the approved character is left as it is', () => {
  const before = JSON.stringify(NOX);
  withPaletteCandidate(NOX);
  expect(JSON.stringify(NOX)).toBe(before);
});
