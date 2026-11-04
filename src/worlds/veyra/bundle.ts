import { VEYRA_ARTIFACTS } from './artifacts';
import { VEYRA } from './character';
import type { StageId } from '../../engine/config/types';
import { veyraProject } from './content/veyraProject';
import { veyraTechnologies } from './content/veyraTechnologies';
import { VEYRA_POSES } from './poses';
import { VEYRA_SWIM } from './swim';
import { VEYRA_SEQUENCES } from './sequences/index';
import type { IntroTitleBox, StageFrame, StagePanels } from '../../engine/stage/framing';
import type { WorldBundle } from '../../engine/types/bundle';
import { VAULT_WORLD } from './place/config';
import { VEYRA_THEME } from './theme';

// Veyra's world as one bundle (spec 6.2): the one file that gathers her character, poses, swim,
// artifacts, sequences, the place, the stage's framing, her project and her theme. The engine reads
// them only through the bundle (host/WorldHost.tsx). 1 world unit is 100 px of the native panels.

/**
 * What each stage frames, from its storyboard panel's native size (488 x 495 for P2, 509 x 495
 * for P1, 535 x 495 for P3, 867 x 528 for P5). Focusing a technology keeps the overview's framing,
 * as Nox's does.
 */
export const VEYRA_STAGE_FRAMES: Record<StageId, StageFrame> = {
  entering: { width: 5.09, height: 4.95 },
  intro: { width: 4.88, height: 4.95 },
  overview: { width: 5.35, height: 4.95 },
  techFocus: { width: 5.35, height: 4.95 },
  detail: { width: 8.67, height: 5.28 },
};

/**
 * Where Veyra's HTML panels sit on her stage, in world units [left, top, right, bottom], read off
 * the native panels at 100 px a unit from each panel's centre: P3's project panel inside the head
 * and P5's project panel. Provisional until Milestone 3 registers them on her face.
 */
export const VEYRA_STAGE_PANELS: StagePanels = {
  overview: [-1.17, 1.17, 1.05, -0.03],
  detail: [-2.215, 1.825, 4.225, -2.32],
};

/** The intro's title lines, in world units: the widest line's half width, and the top of the kicker (P2: the kicker's top at y 97 px, "Vault OS" 147 to 362 px). */
export const VEYRA_INTRO_TITLE: IntroTitleBox = { halfWidth: 1.1, top: 1.5 };

export const VEYRA_BUNDLE: WorldBundle = {
  id: 'veyra',
  character: VEYRA,
  poses: VEYRA_POSES,
  swim: VEYRA_SWIM,
  artifacts: VEYRA_ARTIFACTS,
  sequences: VEYRA_SEQUENCES,
  place: VAULT_WORLD,
  stage: { frames: VEYRA_STAGE_FRAMES, panels: VEYRA_STAGE_PANELS, introTitle: VEYRA_INTRO_TITLE },
  content: { project: veyraProject, technologies: veyraTechnologies },
  theme: VEYRA_THEME,
};
