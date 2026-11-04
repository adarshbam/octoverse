import type { UiTheme } from '../../engine/ui/theme';

/**
 * Veyra's UI (spec 7.10): a teal-mint accent, dark teal surfaces, a mint-to-cyan Live Demo button,
 * a cyan focus ring and a padlock beside the title. Each colour is the one her stylesheets' tokens
 * take in place of Nox's; there is no red or pink in any of them.
 */
export const VEYRA_THEME: UiTheme = {
  accent: '#3fe0c5',
  accentHot: '#5af0d8',
  surface: 'rgba(6, 30, 38, 0.92)',
  surfaceEdge: 'rgba(63, 224, 197, 0.6)',
  buttonFrom: '#7af5c8',
  buttonTo: '#3fd8f0',
  focusRing: '#8ff4ff',
  titleIcon: 'padlock',
  // The no-WebGL still of her intro: a capture of the stage backdrop for now (public/veyra/poster-intro.webp).
  poster: { src: 'veyra/poster-intro.webp', alt: 'Veyra, the Keeper of Files, a glowing teal octopus in the dark water of her vault', width: 1536, height: 1024 },
  pageTitle: 'Veyra · Vault OS',
  nameplateLabel: '#c8f0e8',
  // P2's plate: a dark teal glass over the water (sampled 0, 43, 49 to 12, 55, 62 inside it).
  plate: 'rgba(2, 44, 50, 0.82)',
  glow: 'rgb(40, 220, 200)',
  glowInner: 'rgb(60, 230, 210)',
  accentGlow: 'rgb(63, 224, 197)',
  markGlow: 'rgb(50, 220, 190)',
  buttonGlow: 'rgb(70, 230, 210)',
  titleAccent: '#5ff0d8',
  titleGlow: 'rgb(50, 230, 200)',
  plateGlow: 'rgb(40, 210, 190)',
  plateGlowInner: 'rgb(50, 220, 200)',
  line: 'rgb(100, 230, 210)',
  linePale: 'rgb(150, 240, 225)',
  lineHover: 'rgb(190, 250, 240)',
  liveFrom: '#7ff5b8',
  liveTo: '#2fe0d8',
  ink: '#06201c',
  markRing: '#0a2a2c',
  selected: 'rgba(10, 70, 70, 0.85)',
};
