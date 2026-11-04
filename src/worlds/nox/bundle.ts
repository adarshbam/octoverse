import { NOX_ARTIFACTS } from './artifacts';
import { NOX } from './character';
import type { StageId } from '../../engine/config/types';
import { noxProject } from './content/noxProject';
import { noxTechnologies } from './content/noxTechnologies';
import { NOX_POSES } from './poses';
import { SWIM_POSES } from './swim';
import { ARM_HALF_SPAN, type EntranceGeometry, PILLAR_HALF } from '../../engine/sequences/entrance';
import { NOX_SEQUENCES } from './sequences/index';
import type { StageFrame } from '../../engine/stage/framing';
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
  nameplateLabel: '#d8cfe2',
};

export const NOX_BUNDLE: WorldBundle = {
  id: 'nox',
  character: NOX,
  poses: NOX_POSES,
  swim: SWIM_POSES,
  artifacts: NOX_ARTIFACTS,
  sequences: NOX_SEQUENCES,
  place: SECURITY_WORLD,
  stage: { frames: NOX_STAGE_FRAMES },
  content: { project: noxProject, technologies: noxTechnologies },
  theme: NOX_THEME,
};

/** What the entrance's clearance check measures Nox with: his stroke, his arms' reach and the kit's pillar footprint. */
export const NOX_ENTRANCE_GEOMETRY: EntranceGeometry = { swim: NOX.personality.swim, armHalfSpan: ARM_HALF_SPAN, pillarHalf: PILLAR_HALF };
