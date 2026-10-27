import type { CharacterConfig, Palette } from './types';

// A proposed palette for Nox in the world, for the owner's component review (Task 5, ruling R22).
// It is not approved: the app shows it only with `?palette=candidate` while developing, so the
// owner can compare it live with the approved palette. Without the switch, Nox keeps the approved
// palette in nox.character.ts exactly. It changes as little as it can, in one direction: less
// green in the arm body, the head's edge colour and the glow ramp's middle stops (the cheek colour
// was tried too and moved nothing, so it stays). The arm body is also a little darker, as the arm
// tops are in panel 2. The face, the neon rim colours, the halo and the sucker emitters are never
// touched. Measured against panel 2 in docs/superpowers/reviews/nox-world.md (Task 5).

/** The colours the candidate may change: the arm body, the head's edge colour and the cheeks. */
export type CandidateColour = 'armBody' | 'headEdge' | 'cheek';

/** The palette colours the candidate changes (approved: armBody #640a90, headEdge #5c2a8c). */
export const PALETTE_CANDIDATE: Partial<Pick<Palette, CandidateColour>> = {
  armBody: '#56067c',
  headEdge: '#5c148c',
};

/**
 * The glow ramp's middle stops the candidate changes, by position: each keeps its red and blue.
 * The dim stops (0.07 to 0.49) keep 0.4 of their green; toward the core it eases back (0.6, 0.75,
 * 0.9), so the face glow keeps its coral heart (at 0.4 throughout it turned crimson). The ramp's
 * ends (the dark dome and the white-hot core) stay as approved.
 */
export const RAMP_CANDIDATE: Readonly<Record<number, string>> = {
  0.07: '#1e0530',
  0.17: '#45083e',
  0.27: '#640842',
  0.37: '#890c45',
  0.49: '#b90f4b',
  0.61: '#e8204d',
  0.74: '#fb3e54',
  0.94: '#fd705b',
};

/** `config` with the candidate's colours in place of its own. */
export function withPaletteCandidate(config: CharacterConfig): CharacterConfig {
  return {
    ...config,
    palette: { ...config.palette, ...PALETTE_CANDIDATE },
    glow: { ...config.glow, ramp: config.glow.ramp.map(([at, colour]) => [at, RAMP_CANDIDATE[at] ?? colour] as const) },
  };
}
