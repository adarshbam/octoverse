import type { UiTheme } from '../../engine/ui/theme';

/**
 * Aether's UI: lavender-violet accents sampled from her storyboard at build time (the colours are
 * 3 x 3 means of panel 3's View Project button, left to right, and panel 5's Live Demo button;
 * see docs/superpowers/reviews/aether.md), deep indigo glass surfaces (panel 5's panel is about
 * #081132 to #0e1333), a cyan-lavender focus ring, and her ringed planet beside the title.
 *
 * The title icon is `flame` for now: the engine's table of title icons (ui/titleIcons.ts) has only
 * Nox's flame, and `ringedPlanet` is an engine entry that does not exist yet (spec 7.10). Her
 * intro shows Nox's red flame until the engine gains it; nothing in this world may reach for red.
 */
export const AETHER_THEME: UiTheme = {
  // View Project's mean, top row (#b79bf8, #a68ff8, #8f73fb, #7b62f7): a lavender-violet.
  accent: '#9a80f8',
  accentHot: '#c4a8ff',
  surface: 'rgba(10, 16, 48, 0.92)',
  surfaceEdge: 'rgba(120, 130, 220, 0.6)',
  // The button runs lavender (left) to violet (right) in P3; P5's Live Demo is the same pair, a touch bluer.
  buttonFrom: '#b79bf8',
  buttonTo: '#7b62f7',
  focusRing: '#b8d8ff',
  titleIcon: 'flame',
  // Replaced by a capture of her intro (a still of P2's composition) when the poster is made (Task 21).
  poster: { src: 'aether/poster-intro.webp', alt: 'Aether, the curious octopus guide to AI Playground, in the indigo water of her drowned observatory', width: 1536, height: 1024 },
  pageTitle: 'Aether · AI Playground',
  // The nameplate's second line, "The Curious Mind" (content/aether.ts `epithet`), is drawn in this colour.
  nameplateLabel: '#d8d0f8',
  glow: 'rgb(120, 100, 255)',
  glowInner: 'rgb(140, 120, 255)',
  accentGlow: 'rgb(150, 120, 255)',
  markGlow: 'rgb(140, 110, 255)',
  buttonGlow: 'rgb(160, 130, 255)',
  titleAccent: '#e9defe',
  titleGlow: 'rgb(150, 120, 255)',
  plateGlow: 'rgb(130, 110, 255)',
  plateGlowInner: 'rgb(150, 130, 255)',
  line: 'rgb(150, 150, 255)',
  linePale: 'rgb(190, 185, 255)',
  lineHover: 'rgb(215, 210, 255)',
  // Live Demo (P5), left to right: #b89ffb to #826cf9.
  liveFrom: '#b89ffb',
  liveTo: '#826cf9',
  ink: '#120a38',
  markRing: '#14104a',
  selected: 'rgba(60, 50, 140, 0.85)',
};
