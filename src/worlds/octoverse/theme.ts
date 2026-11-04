import type { UiTheme } from '../../engine/ui/theme';

// The host's UI tokens: lavender (the host's rim and halo, spec 7.2) where Nox's are red, with a
// peach warm accent from its face glow. Every engine panel the host can show reads these; the
// landing draws its own HTML around the host (ui: 'none'), so most only show in a dev page.

export const HOST_THEME: UiTheme = {
  accent: '#b49cff',
  accentHot: '#d6c0ff',
  surface: 'rgba(22, 18, 56, 0.92)',
  surfaceEdge: 'rgba(180, 156, 255, 0.7)',
  buttonFrom: '#c8b0ff',
  buttonTo: '#8f6cff',
  focusRing: '#d8c8ff',
  titleIcon: 'flame',
  // The no-WebGL still of the host's intro: made with the poster pass (platform Task 21); until
  // then the file is missing and the poster shows its alt text.
  poster: { src: 'octoverse/poster-intro.webp', alt: 'OctoVerse, the host octopus, arms spread in welcome in deep indigo water', width: 1536, height: 1024 },
  pageTitle: 'OctoVerse',
  nameplateLabel: '#e0d6ff',
  // The nameplate's fill: deep indigo glass over the water (the host has no plate in the references; the landing draws its own).
  plate: 'rgba(16, 12, 48, 0.82)',
  glow: 'rgb(150, 120, 255)',
  glowInner: 'rgb(170, 140, 255)',
  accentGlow: 'rgb(180, 156, 255)',
  markGlow: 'rgb(160, 130, 255)',
  buttonGlow: 'rgb(170, 140, 255)',
  titleAccent: '#c8b0ff',
  titleGlow: 'rgb(255, 176, 168)',
  plateGlow: 'rgb(150, 120, 255)',
  plateGlowInner: 'rgb(170, 140, 255)',
  line: 'rgb(190, 170, 255)',
  linePale: 'rgb(215, 200, 255)',
  lineHover: 'rgb(230, 220, 255)',
  liveFrom: '#c8b0ff',
  liveTo: '#8f6cff',
  ink: '#140c30',
  markRing: '#241a48',
  selected: 'rgba(60, 40, 120, 0.85)',
};
