import { FLUX_ARTIFACTS } from './artifacts';
import { FLUX } from './character';
import { fluxProject } from './content/fluxProject';
import { fluxTechnologies } from './content/fluxTechnologies';
import { PIPELINE_WORLD } from './place/config';
import { FLUX_POSES } from './poses';
import { FLUX_SEQUENCES } from './sequences/index';
import { SWIM_POSES } from './swim';
import { FLUX_THEME } from './theme';
import type { StageId } from '../../engine/config/types';
import type { IntroTitleBox, StageFrame, StagePanels } from '../../engine/stage/framing';
import type { WorldBundle } from '../../engine/types/bundle';

// Flux's world as one bundle (spec 6.2): the one file that gathers his character, poses, swim,
// artifacts, sequences, the pipeline world (place/config.ts), the stage's framing, his project and
// his theme. The engine reads them only through the bundle (host/WorldHost.tsx).

/**
 * What each stage frames, from its storyboard panel at 100 px a unit (the native panels: P1 508 x
 * 510, P2 511 x 510, P3 515 x 510, P5 875 x 513). Focusing a technology keeps the overview's framing.
 */
export const FLUX_STAGE_FRAMES: Record<StageId, StageFrame> = {
  entering: { width: 5.08, height: 5.1 },
  intro: { width: 5.11, height: 5.1 },
  overview: { width: 5.15, height: 5.1 },
  techFocus: { width: 5.15, height: 5.1 },
  detail: { width: 8.75, height: 5.13 },
};

/**
 * Where Flux's HTML panels sit on his stage, in world units [left, top, right, bottom], read from
 * the native panels by eye (a first trace): the overview's project panel is the dome's inner
 * rectangle (P3, origin at its centre (257.5, 255)); the detail's is P5's project panel,
 * (211, 85) to (853, 490) px, origin at its centre (437.5, 256.5).
 */
export const FLUX_STAGE_PANELS: StagePanels = {
  overview: [-1.22, 1.15, 1.63, -0.07],
  detail: [-2.265, 1.715, 4.155, -2.335],
};

/** The intro's title lines, in world units: the widest line's half width, and the top of the kicker (P2). */
export const FLUX_INTRO_TITLE: IntroTitleBox = { halfWidth: 1.39, top: 1.57 };

export const FLUX_BUNDLE: WorldBundle = {
  id: 'flux',
  character: FLUX,
  poses: FLUX_POSES,
  swim: SWIM_POSES,
  artifacts: FLUX_ARTIFACTS,
  sequences: FLUX_SEQUENCES,
  place: PIPELINE_WORLD,
  stage: { frames: FLUX_STAGE_FRAMES, panels: FLUX_STAGE_PANELS, introTitle: FLUX_INTRO_TITLE },
  content: { project: fluxProject, technologies: fluxTechnologies },
  theme: FLUX_THEME,
};
