import type { TITLE_ICONS } from './titleIcons';

// A world's UI tokens (spec 6.2, `WorldBundle.theme`): the accents, surfaces, button, focus ring
// and nameplate colours of the HTML layer, and the icon its title carries. The host writes the
// colours as CSS custom properties on its root (`themeVars`); the stylesheets read
// `var(--oct-*, <Nox's value>)`, so Nox's theme reproduces today's styling exactly (ui/theme.test.ts
// parses the stylesheets to hold the two together).

/** The icons a title can carry: the keys of the engine's table (ui/titleIcons.tsx). */
export type TitleIconId = keyof typeof TITLE_ICONS;

export interface UiTheme {
  /** The accent: the detail's headings, active marks and outlines. */
  accent: string;
  /** The hot accent: the intro's kicker and the tooltip's marker. */
  accentHot: string;
  /** The panels' cards (the detail's facts and sections). */
  surface: string;
  /** The panels' glowing edge (the detail and the overview sheet). */
  surfaceEdge: string;
  /** The main button's gradient (the overview's View Project), top to bottom. */
  buttonFrom: string;
  buttonTo: string;
  /** The keyboard focus ring (and the skip link, which only shows focused). */
  focusRing: string;
  /** The intro title's icon (a key of TITLE_ICONS). */
  titleIcon: TitleIconId;
  /** The nameplate's second line (the character's epithet). */
  nameplateLabel: string;
}

/** The colour tokens and the CSS custom property each is written as. */
export const THEME_VARS = {
  accent: '--oct-accent',
  accentHot: '--oct-accent-hot',
  surface: '--oct-surface',
  surfaceEdge: '--oct-surface-edge',
  buttonFrom: '--oct-button-from',
  buttonTo: '--oct-button-to',
  focusRing: '--oct-focus-ring',
  nameplateLabel: '--oct-nameplate-label',
} as const satisfies Record<Exclude<keyof UiTheme, 'titleIcon'>, `--oct-${string}`>;

/** The colour tokens of a theme (every field but the icon). */
export type ThemeColour = keyof typeof THEME_VARS;
export const THEME_COLOURS = Object.keys(THEME_VARS) as ThemeColour[];

/** The theme's colours as CSS custom properties (`--oct-accent`, ...), for the host root's style. */
export function themeVars(theme: UiTheme): Record<string, string> {
  return Object.fromEntries(THEME_COLOURS.map(key => [THEME_VARS[key], theme[key]]));
}
