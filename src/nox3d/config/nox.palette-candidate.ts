import type { CharacterConfig, HaloSettings, Palette } from './types';

// A proposed palette for Nox in the world, for the owner's component review (Task 5, rulings R22
// and R23). It is not approved: the app shows it only with `?palette=candidate` while developing,
// so the owner can compare it live with the approved palette. Without the switch, Nox keeps the
// approved palette in nox.character.ts exactly.
//
// R23 widened it to Nox's own rim, halo and underside band colours, aimed at panel 2: violet
// tops, red undersides, a red-pink rim. It may change the rim (rimTop, rimLow), the halo's
// colours (not its widths or strengths), the underside band (armGlow, belly, terminator and the
// band's strength), the arm tops (armBody, headEdge, wet, tintCool, tintWarm, sky) and the glow
// ramp's middle stops. The face palette and canvas (the cheek colour, the blush), the eyes, the
// ramp's ends (the face glow), the sucker colours, the dome and every shape stay as approved.
// Measured against panel 2 in docs/superpowers/reviews/nox-world.md (Task 5, wider candidate).

/** The palette colours the candidate may change. */
export type CandidateColour =
  | 'rimTop' | 'rimLow'
  | 'armGlow' | 'belly' | 'terminator'
  | 'armBody' | 'headEdge' | 'wet' | 'tintCool' | 'tintWarm' | 'sky';

/**
 * The palette colours the candidate changes (approved in brackets). The arm tops turn a deep
 * blue-violet; the top rim becomes a thin blue-violet line with a blue-violet wet sheen under it,
 * as in panel 2, instead of a broad pink-white one; the underside band is a brighter, redder red.
 */
export const PALETTE_CANDIDATE: Partial<Pick<Palette, CandidateColour>> = {
  // Arm tops: deep violet, darker and bluer (#640a90); the head's edge with less green (#5c2a8c).
  armBody: '#3a0864',
  headEdge: '#5c148c',
  // The thin neon line along the tops, blue-violet (#9480ff); the undersides' rim, a dark red-pink
  // (#ff4cc0), so the band's red, not a pink line, reads below.
  rimTop: '#6a38ff',
  rimLow: '#a00838',
  // Wet highlights, droplets and the broad edge line: blue-violet, not pink-white (#f6d0ff).
  wet: '#5030e0',
  // The skin's cool and warm drift: a bluer cool (#5a6ad8), a violet warm in place of pink (#c84a8a).
  tintCool: '#3040ff',
  tintWarm: '#8c3090',
  // The red oral band: a red terminator in place of magenta (#a8085a), a deeper red core (#ff1745).
  terminator: '#d80848',
  belly: '#ff0428',
};

/**
 * The halo colours the candidate changes; its widths and strengths stay. Redder and less lavender:
 * a magenta-pink round the head and along the tops (#e83cf0), a deeper violet over the crown
 * (#a27df5), a deeper red below (#ff1a3c).
 */
export const HALO_CANDIDATE: Partial<Pick<HaloSettings, 'color' | 'crown' | 'band'>> = {
  color: '#d82090',
  crown: '#7a28c0',
  band: '#e80a24',
};

/** How brightly the arms' red underside band glows (approved 0.95). */
export const UNDERSIDE_CANDIDATE = 1.6;

/**
 * The glow ramp's middle stops the candidate changes, by position (approved in brackets). The dim
 * stops go toward navy, as the head's middle is in panel 2: 0.07 #040a30 (#1e0c30), 0.17 #3a0a40
 * (#45133e). 0.27 and 0.37 keep the R22 values, with less green: #640842 (#641542), #890c45
 * (#891d45). Toward the core the stops are a little redder and dimmer, as the glow round the face
 * is in panel 2: 0.49 #b00c46 (#b9254b), 0.61 #d8143a (#e8364d), 0.74 #ec2442 (#fb5254), 0.94
 * #ec4a46 (#fd7c5b). The ramp's ends (the dark dome and the face glow's coral heart) stay.
 */
export const RAMP_CANDIDATE: Readonly<Record<number, string>> = {
  0.07: '#040a30',
  0.17: '#3a0a40',
  0.27: '#640842',
  0.37: '#890c45',
  0.49: '#b00c46',
  0.61: '#d8143a',
  0.74: '#ec2442',
  0.94: '#ec4a46',
};

/** `config` with the candidate's colours in place of its own. */
export function withPaletteCandidate(config: CharacterConfig): CharacterConfig {
  return {
    ...config,
    palette: { ...config.palette, ...PALETTE_CANDIDATE },
    glow: {
      ...config.glow,
      underside: UNDERSIDE_CANDIDATE,
      halo: { ...config.glow.halo, ...HALO_CANDIDATE },
      ramp: config.glow.ramp.map(([at, colour]) => [at, RAMP_CANDIDATE[at] ?? colour] as const),
    },
  };
}
