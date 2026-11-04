import { HOST_THEME } from '../../worlds/octoverse/theme';

// The platform's look tokens (platform spec 7.10, 7.15): the title's gradient sampled from P2, the
// glass the platform's own panels are made of, and the focus ring in the host's lavender. The CSS
// (glass.css) holds the same values as custom properties on `.oct-root`; this is the one place the
// numbers are written, and glass.css is checked against it by the landing test's source reading.

/** P2's title, letter by letter: peach on the first O, pink, pink-violet, violet, blue from the V, blue-lavender, lavender on the last E. */
const TITLE_STOPS = ['#f9dad4', '#ffaaee', '#ffa3fa', '#ea8df5', '#67b3f0', '#82a6fd', '#9d99f3'] as const;

/** Where each stop sits along the wordmark (percent of its width): the stops fall on the letters O, C, T, O, V, R and E. */
const TITLE_AT = [5, 17, 28, 39, 52, 76, 95] as const;

export const PLATFORM_TOKENS = {
  titleGradient: {
    stops: TITLE_STOPS,
    at: TITLE_AT,
    css: `linear-gradient(90deg, ${TITLE_STOPS.map((stop, i) => `${stop} ${TITLE_AT[i]}%`).join(', ')})`,
  },
  glass: {
    /** Deep indigo glass over the reef's water. */
    surface: 'rgba(22, 18, 60, 0.58)',
    surfaceStrong: 'rgba(16, 12, 48, 0.82)',
    border: 'rgba(190, 172, 255, 0.5)',
    glow: '0 0 28px rgba(150, 120, 255, 0.3)',
  },
  /** The host's lavender, as its own theme has it. */
  focusRing: HOST_THEME.focusRing,
  ink: '#f4eeff',
  inkSoft: '#d9cfe8',
  /** Each card's border accent (spec 7.10): the world's own colour, written here because the platform never imports a world's bundle. */
  accents: {
    veyra: '#35e0c8',
    flux: '#5b9dff',
    nox: '#ff4a63',
    aether: '#b08dff',
    yours: '#ffc65a',
  },
} as const;
