import { NOX_ARTIFACTS } from './artifacts';
import { NOX } from './character';
import type { StageId } from '../../engine/config/types';
import { noxProject } from './content/noxProject';
import { noxTechnologies } from './content/noxTechnologies';
import { NOX_POSES } from './poses';
import { SWIM_POSES } from './swim';
import { ARM_HALF_SPAN, type EntranceGeometry, type Footprint, PILLAR_HALF } from '../../engine/sequences/entrance';
import { NOX_SEQUENCES } from './sequences/index';
import type { IntroTitleBox, StageFrame, StagePanels } from '../../engine/stage/framing';
import type { WorldBundle } from '../../engine/types/bundle';
import type { UiTheme } from '../../engine/ui/theme';
import { SECURITY_WORLD } from './place/config';

// Nox's world as one bundle (spec 6.2): the one file that gathers his character, poses, swim,
// artifacts, sequences, the security world, the stage's framing, his project and his theme. The
// engine reads them only through the bundle (host/WorldHost.tsx).

/**
 * What each stage frames, from its storyboard panel. Focusing a technology keeps the overview's
 * framing: re-framing would move every orb under the visitor's pointer as focus begins. The detail
 * frames the whole high-quality panel 5 (1672 x 941 px), registered on Nox's face at 200 px a unit.
 */
export const NOX_STAGE_FRAMES: Record<StageId, StageFrame> = {
  entering: { width: 5.1, height: 5.04 },
  intro: { width: 5.06, height: 5.04 },
  overview: { width: 5.15, height: 5.04 },
  techFocus: { width: 5.15, height: 5.04 },
  detail: { width: 8.36, height: 4.705 },
};

/**
 * Where Nox's HTML panels sit on his stage, in world units, traced from his high-quality panels:
 * the overview's project panel is the dome's inner rectangle (panel 3); the detail's is panel 5's
 * project panel, (722, 222) to (1637, 846) px at 200 px a unit.
 */
export const NOX_STAGE_PANELS: StagePanels = {
  overview: [-1.22, 1.14, 1.33, 0.06],
  detail: [-0.57, 1.2425, 4.005, -1.8775],
};

/** The intro's title lines, in world units: the widest line's half width, and the top of the kicker (stage % from intro.css). */
export const NOX_INTRO_TITLE: IntroTitleBox = { halfWidth: 1.4, top: 1.55 };

/** Nox's UI: the colours the stylesheets were written in (each reads `var(--oct-*, <this value>)`), and his flame. */
export const NOX_THEME: UiTheme = {
  accent: '#ff3b5c',
  accentHot: '#ff3a55',
  surface: 'rgba(26, 20, 40, 0.92)',
  surfaceEdge: 'rgba(255, 70, 110, 0.7)',
  buttonFrom: '#ff7a86',
  buttonTo: '#ff4c62',
  focusRing: '#ffd0dc',
  titleIcon: 'flame',
  poster: { src: 'nox/poster-intro.webp', alt: 'Nox, the octopus guide to Security Lab, in the dark water of his lab', width: 1536, height: 1024 },
  pageTitle: 'Nox · Security Lab',
  nameplateLabel: '#d8cfe2',
  plate: 'rgba(12, 6, 18, 0.78)',
  // The red and pink glows, lines and fills the stylesheets held as literals (fix wave A), each
  // exactly as it was: the channel tokens are given as rgb() so they read as the stylesheet's rgba() did.
  glow: 'rgb(255, 40, 90)',
  glowInner: 'rgb(255, 50, 100)',
  accentGlow: 'rgb(255, 60, 90)',
  markGlow: 'rgb(255, 50, 80)',
  buttonGlow: 'rgb(255, 70, 100)',
  titleAccent: '#ff3d52',
  titleGlow: 'rgb(255, 50, 70)',
  plateGlow: 'rgb(255, 40, 80)',
  plateGlowInner: 'rgb(255, 50, 90)',
  line: 'rgb(255, 120, 160)',
  linePale: 'rgb(255, 160, 200)',
  lineHover: 'rgb(255, 190, 215)',
  liveFrom: '#ff5d70',
  liveTo: '#ff2f55',
  ink: '#1a0710',
  markRing: '#2a1420',
  selected: 'rgba(70, 20, 50, 0.85)',
};

export const NOX_BUNDLE: WorldBundle = {
  id: 'nox',
  character: NOX,
  poses: NOX_POSES,
  swim: SWIM_POSES,
  artifacts: NOX_ARTIFACTS,
  sequences: NOX_SEQUENCES,
  place: SECURITY_WORLD,
  stage: { frames: NOX_STAGE_FRAMES, panels: NOX_STAGE_PANELS, introTitle: NOX_INTRO_TITLE },
  content: { project: noxProject, technologies: noxTechnologies },
  theme: NOX_THEME,
};

/** What the entrance's clearance check measures Nox with: his stroke, his arms' reach and the kit's pillar footprint. */
export const NOX_ENTRANCE_GEOMETRY: EntranceGeometry = { swim: NOX.personality.swim, armHalfSpan: ARM_HALF_SPAN, pillarHalf: PILLAR_HALF };

/**
 * The kit pieces the entrance's clearance counts in Nox's layout, by kit name: the four pillars,
 * each the pillar shaft's footprint. The rocks and corals lie low under the swim and are not counted.
 */
export const NOX_ENTRANCE_FOOTPRINTS: Readonly<Record<string, Footprint>> = { pillar_a: PILLAR_HALF, pillar_b: PILLAR_HALF, pillar_c: PILLAR_HALF, pillar_d: PILLAR_HALF };
