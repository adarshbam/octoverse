import type { UiTheme } from '../../engine/ui/theme';

/**
 * Flux's UI (spec 7.10): an electric cyan-sky accent (`#4aa6d0`) with a cyan-to-teal Live Demo
 * gradient (`#4aa6d0` to `#25ada8`), deep navy surfaces (`#031e3b`) and an electric cyan focus ring.
 * The values are sampled from the P3 and P5 panels; the stylesheets read them as `var(--oct-*)`.
 * The title icon is the engine's only one for now: spec 7.10 asks for a gear, which the engine's
 * table (ui/titleIcons.tsx) does not have yet.
 */
export const FLUX_THEME: UiTheme = {
  accent: '#4aa6d0',
  accentHot: '#3cc4f0',
  surface: '#031e3b',
  surfaceEdge: 'rgba(74, 166, 208, 0.7)',
  buttonFrom: '#6ad0f0',
  buttonTo: '#3aa8d8',
  focusRing: '#7ae8ff',
  titleIcon: 'flame',
  poster: { src: 'flux/poster-intro.webp', alt: 'Flux, the octopus guide to GitHub Pipeline Engine, in the deep blue water of his pipeline world', width: 1536, height: 1024 },
  pageTitle: 'Flux · GitHub Pipeline Engine',
  nameplateLabel: '#c8def0',
  glow: 'rgb(40, 150, 255)',
  glowInner: 'rgb(60, 170, 255)',
  accentGlow: 'rgb(60, 180, 230)',
  markGlow: 'rgb(50, 170, 230)',
  buttonGlow: 'rgb(70, 190, 240)',
  titleAccent: '#4ac0f0',
  titleGlow: 'rgb(50, 170, 240)',
  plateGlow: 'rgb(40, 150, 240)',
  plateGlowInner: 'rgb(50, 170, 245)',
  line: 'rgb(120, 200, 240)',
  linePale: 'rgb(160, 220, 245)',
  lineHover: 'rgb(190, 235, 250)',
  liveFrom: '#4aa6d0',
  liveTo: '#25ada8',
  ink: '#031a2e',
  markRing: '#06243a',
  selected: 'rgba(10, 50, 90, 0.85)',
};
