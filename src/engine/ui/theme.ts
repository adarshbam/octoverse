import * as THREE from 'three';
import type { TITLE_ICONS } from './titleIcons';

// A world's UI tokens (spec 6.2, `WorldBundle.theme`): the accents, surfaces, buttons, glows,
// lines, focus ring and nameplate colours of the HTML layer, and the icon its title carries. The
// host writes the colours as CSS custom properties on its root (`themeVars`); the stylesheets read
// `var(--oct-*, <Nox's value>)`, so Nox's theme reproduces today's styling exactly (ui/theme.test.ts
// parses the stylesheets to hold the two together). A token a stylesheet uses at an alpha of its
// own (a glow at 0.35 here and 0.55 there) is written as its channels, `--oct-glow-rgb: 255, 40,
// 90`, which the stylesheet hands to rgba() with that alpha: `rgba(var(--oct-glow-rgb, 255, 40,
// 90), 0.35)` is, once substituted, the very `rgba(255, 40, 90, 0.35)` it replaced, pixel for pixel.

/** The icons a title can carry: the keys of the engine's table (ui/titleIcons.tsx). */
export type TitleIconId = keyof typeof TITLE_ICONS;

export interface UiTheme {
  /** The accent: the detail's headings, active marks and outlines. */
  accent: string;
  /** The hot accent: the intro's kicker and the tooltip's marker. */
  accentHot: string;
  /** The panels' cards (the detail's facts and sections). */
  surface: string;
  /** The panels' glowing edge (the detail, the overview sheet and the tooltip). */
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
  /** The panels' outer glow (the detail, the overview sheet, the tooltip). */
  glow: string;
  /** The panels' inner glow (the detail, the tooltip). */
  glowInner: string;
  /** The glow round the detail's section marks and its Live Demo button. */
  accentGlow: string;
  /** The glow round the detail's heading mark. */
  markGlow: string;
  /** The glow round the overview's main button, and the nameplate's border. */
  buttonGlow: string;
  /** The intro title's lit word. */
  titleAccent: string;
  /** The glow round the intro title's icon. */
  titleGlow: string;
  /** The nameplate's outer and inner glow. */
  plateGlow: string;
  plateGlowInner: string;
  /** Thin lines: round the overview's second button; round the tray's items and the skip control; the skip control's under the pointer. */
  line: string;
  linePale: string;
  lineHover: string;
  /** The detail's Live Demo button's gradient, top to bottom. */
  liveFrom: string;
  liveTo: string;
  /** Text and outlines drawn on the bright buttons (the overview's View Project, the skip link). */
  ink: string;
  /** The ring between the detail's current section mark and its outline. */
  markRing: string;
  /** A chosen tray item's fill. */
  selected: string;
}

/** The colour tokens of a theme (every field but the icon). */
export type ThemeColour = Exclude<keyof UiTheme, 'titleIcon'>;

/** The colour tokens a stylesheet reads as a colour, and the CSS custom property each is written as. */
export const THEME_VARS = {
  accent: '--oct-accent',
  accentHot: '--oct-accent-hot',
  surface: '--oct-surface',
  surfaceEdge: '--oct-surface-edge',
  buttonFrom: '--oct-button-from',
  buttonTo: '--oct-button-to',
  focusRing: '--oct-focus-ring',
  nameplateLabel: '--oct-nameplate-label',
  titleAccent: '--oct-title-accent',
  liveFrom: '--oct-live-from',
  liveTo: '--oct-live-to',
  ink: '--oct-ink',
  markRing: '--oct-mark-ring',
  selected: '--oct-selected',
} as const satisfies Partial<Record<ThemeColour, `--oct-${string}`>>;

/**
 * The colour tokens a stylesheet reads as channels (`r, g, b`, for rgba() with an alpha of its
 * own), and the property each is written as. `accent` and `surfaceEdge` are written both ways.
 */
export const THEME_CHANNEL_VARS = {
  accent: '--oct-accent-rgb',
  surfaceEdge: '--oct-surface-edge-rgb',
  glow: '--oct-glow-rgb',
  glowInner: '--oct-glow-inner-rgb',
  accentGlow: '--oct-accent-glow-rgb',
  markGlow: '--oct-mark-glow-rgb',
  buttonGlow: '--oct-button-glow-rgb',
  titleGlow: '--oct-title-glow-rgb',
  plateGlow: '--oct-plate-glow-rgb',
  plateGlowInner: '--oct-plate-glow-inner-rgb',
  line: '--oct-line-rgb',
  linePale: '--oct-line-pale-rgb',
  lineHover: '--oct-line-hover-rgb',
} as const satisfies Partial<Record<ThemeColour, `--oct-${string}-rgb`>>;

/** Every colour token of a theme, each written as a colour, as channels, or both. */
export const THEME_COLOURS = [...new Set([...Object.keys(THEME_VARS), ...Object.keys(THEME_CHANNEL_VARS)])] as ThemeColour[];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/;

/**
 * A colour's red, green and blue as CSS channels, `r, g, b` (0 to 255), for a stylesheet's rgba():
 * `#rgb`, `#rrggbb` and `rgb()`/`rgba()` with whole numbers are read exactly as written (an alpha
 * is dropped: the stylesheet gives its own); any other colour three reads (hsl(), a name) as its
 * 8-bit sRGB channels.
 */
export function colourChannels(colour: string): string {
  const hex = HEX.exec(colour);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map(d => d + d) : [hex[1].slice(0, 2), hex[1].slice(2, 4), hex[1].slice(4, 6)];
    return digits.map(d => parseInt(d, 16)).join(', ');
  }
  const rgb = RGB.exec(colour);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].join(', ');
  const hexOf = new THREE.Color(colour).getHex(THREE.SRGBColorSpace);
  return [(hexOf >> 16) & 255, (hexOf >> 8) & 255, hexOf & 255].join(', ');
}

/** The theme's colours as CSS custom properties (`--oct-accent`, `--oct-glow-rgb`, ...), for the host root's style. */
export function themeVars(theme: UiTheme): Record<string, string> {
  return {
    ...Object.fromEntries(Object.entries(THEME_VARS).map(([key, property]) => [property, theme[key as ThemeColour]])),
    ...Object.fromEntries(Object.entries(THEME_CHANNEL_VARS).map(([key, property]) => [property, colourChannels(theme[key as ThemeColour])])),
  };
}
