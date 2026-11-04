import { AETHER_ARTIFACTS } from './artifacts';
import { AETHER } from './character';
import type { StageId } from '../../engine/config/types';
import { aetherProject } from './content/aetherProject';
import { aetherTechnologies } from './content/aetherTechnologies';
import { AETHER_POSES } from './poses';
import { OBSERVATORY_STAGE } from './place/config';
import { AETHER_SEQUENCES } from './sequences/index';
import { SWIM_POSES } from './swim';
import { AETHER_THEME } from './theme';
import type { IntroTitleBox, StageFrame, StagePanels } from '../../engine/stage/framing';
import type { WorldBundle } from '../../engine/types/bundle';

// Aether's world as one bundle (spec 6.2): the one file that gathers her character, poses, swim,
// artifacts, sequences, the observatory stage, the stage's framing, her project and her theme.
// The engine reads them only through the bundle (host/WorldHost.tsx).

/**
 * What each stage frames, from its storyboard panel at 100 px to a world unit (the panels' own
 * pixel sizes: P1 510 x 504, P2 514 x 504, P3 509 x 504, P5 861 x 519). Focusing a technology
 * keeps the overview's framing (P4 is wider only for its tooltip, which the HTML layer draws).
 */
export const AETHER_STAGE_FRAMES: Record<StageId, StageFrame> = {
  entering: { width: 5.1, height: 5.04 },
  intro: { width: 5.14, height: 5.04 },
  overview: { width: 5.09, height: 5.04 },
  techFocus: { width: 5.09, height: 5.04 },
  detail: { width: 8.61, height: 5.19 },
};

/**
 * Where her HTML panels sit on the stage, in world units, traced from the native panels with the
 * origin at each panel's centre: the overview's project panel is the dark card inside the dome
 * (P3, (147, 143) to (372, 258) px of 509 x 504); the detail's is P5's project panel, (205, 78) to
 * (848, 490) px of 861 x 519. Task 11 and Task 13 register her overview and detail poses on them.
 */
export const AETHER_STAGE_PANELS: StagePanels = {
  overview: [-1.075, 1.09, 1.175, -0.06],
  detail: [-2.255, 1.815, 4.175, -2.305],
};

/** The intro's title lines, in world units (P2): the widest line, "Experimenting with AI, building intelligent tools", is 232 px wide; the kicker's top is at y +1.54. */
export const AETHER_INTRO_TITLE: IntroTitleBox = { halfWidth: 1.16, top: 1.54 };

export const AETHER_BUNDLE: WorldBundle = {
  id: 'aether',
  character: AETHER,
  poses: AETHER_POSES,
  swim: SWIM_POSES,
  artifacts: AETHER_ARTIFACTS,
  sequences: AETHER_SEQUENCES,
  place: OBSERVATORY_STAGE,
  stage: { frames: AETHER_STAGE_FRAMES, panels: AETHER_STAGE_PANELS, introTitle: AETHER_INTRO_TITLE },
  content: { project: aetherProject, technologies: aetherTechnologies },
  theme: AETHER_THEME,
};
