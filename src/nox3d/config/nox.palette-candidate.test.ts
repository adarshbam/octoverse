import { expect, test } from 'vitest';
import { NOX } from './nox.character';
import { HALO_CANDIDATE, PALETTE_CANDIDATE, RAMP_CANDIDATE, UNDERSIDE_CANDIDATE, withPaletteCandidate } from './nox.palette-candidate';

// Ruling R23: what the candidate may change. Written out here, not imported, so the test holds
// the line on its own: anything not listed (the face palette and canvas, the eyes, the suckers,
// the dome, the halo widths and strengths, the ramp's end stops, every shape) must stay approved.
const RIM = ['rimTop', 'rimLow'];
const UNDERSIDE = ['armGlow', 'belly', 'terminator'];
const ARM_TOPS = ['armBody', 'headEdge', 'wet', 'tintCool', 'tintWarm', 'sky'];
const ALLOWED_PALETTE = [...RIM, ...UNDERSIDE, ...ARM_TOPS];
const ALLOWED_HALO = ['color', 'crown', 'band'];

test('the candidate changes only the rim, halo, underside band and arm-top colours and the ramp’s middle stops', () => {
  const candidate = withPaletteCandidate(NOX);
  const { palette, glow, ...rest } = candidate;
  const { palette: approvedPalette, glow: approvedGlow, ...approvedRest } = NOX;
  // The face (its palette and canvas, the blush, the eyes), the arms' shapes and everything else.
  expect(rest).toEqual(approvedRest);
  expect(Object.keys(PALETTE_CANDIDATE).every(key => ALLOWED_PALETTE.includes(key))).toBe(true);
  for (const key of Object.keys(approvedPalette) as (keyof typeof approvedPalette)[]) {
    // The cheek, the blotches, the sucker colours and the dome stay exactly as approved.
    if (!ALLOWED_PALETTE.includes(key)) expect(palette[key], key).toBe(approvedPalette[key]);
    else expect(palette[key], key).toBe(PALETTE_CANDIDATE[key as keyof typeof PALETTE_CANDIDATE] ?? approvedPalette[key]);
  }
  // The halo keeps its widths and strengths; only its three colours may move.
  expect(Object.keys(HALO_CANDIDATE).every(key => ALLOWED_HALO.includes(key))).toBe(true);
  const { color, crown, band, ...haloRest } = glow.halo;
  const { color: c0, crown: r0, band: b0, ...approvedHaloRest } = approvedGlow.halo;
  expect(haloRest).toEqual(approvedHaloRest);
  expect([color, crown, band]).toEqual([HALO_CANDIDATE.color ?? c0, HALO_CANDIDATE.crown ?? r0, HALO_CANDIDATE.band ?? b0]);
  // The glow's shape, the cheek warmth, the aura and the grade are untouched.
  const { ramp, halo: _halo, underside, ...glowRest } = glow;
  const { ramp: approvedRamp, halo: _approvedHalo, underside: approvedUnderside, ...approvedGlowRest } = approvedGlow;
  expect(glowRest).toEqual(approvedGlowRest);
  expect(underside).toBe(UNDERSIDE_CANDIDATE ?? approvedUnderside);
  // Only the ramp's middle stops move; its ends (the dark dome and the face glow's core) stay.
  const stops = approvedRamp.map(([at]) => at);
  expect(ramp.map(([at]) => at)).toEqual(stops);
  expect(Object.keys(RAMP_CANDIDATE).map(Number).every(at => stops.slice(1, -1).includes(at))).toBe(true);
  expect(ramp[0]).toEqual(approvedRamp[0]);
  expect(ramp[ramp.length - 1]).toEqual(approvedRamp[approvedRamp.length - 1]);
});

test('the candidate proposes new rim, halo and underside band colours, as the owner asked', () => {
  const candidate = withPaletteCandidate(NOX);
  expect(RIM.some(key => candidate.palette[key as 'rimTop'] !== NOX.palette[key as 'rimTop'])).toBe(true);
  expect(ALLOWED_HALO.some(key => candidate.glow.halo[key as 'color'] !== NOX.glow.halo[key as 'color'])).toBe(true);
  expect(UNDERSIDE.some(key => candidate.palette[key as 'belly'] !== NOX.palette[key as 'belly'])).toBe(true);
});

test('the approved character is left as it is', () => {
  const before = JSON.stringify(NOX);
  withPaletteCandidate(NOX);
  expect(JSON.stringify(NOX)).toBe(before);
});
