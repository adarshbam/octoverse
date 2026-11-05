import { HOST_ARTIFACTS } from './artifacts';
import { HOST } from './character';
import type { StageId } from '../../engine/config/types';
import { HOST_CONTENT } from './content/index';
import { HOST_POSES } from './poses';
import { REEF_WORLD } from './place/config';
import { HOST_ENTRANCE, HOST_SEQUENCE_DEFAULTS } from './sequences/defaults';
import type { SequenceSet } from '../../engine/sequences/keys';
import type { IntroTitleBox, StageFrame, StagePanels } from '../../engine/stage/framing';
import { HOST_SWIM } from './swim';
import { HOST_THEME } from './theme';
import type { WorldBundle } from '../../engine/types/bundle';

// The host, OctoVerse's own octopus, as one world bundle (platform spec 6, approach A): mounted as
// the landing's page instance with `ui: 'none'`, the platform drawing its own text around it. Task
// 2 gives it its character, the intro traced from P2 and a stage backdrop of open water.

/**
 * What each stage frames: its storyboard panel's whole native size at 100 px a unit, each centred on
 * the stage (the engine's frame is a size only: the camera stays on the stage's axis). P1 is 510 x
 * 508, P2 512 x 508, P3 511 x 508; the technology focus and the detail (unreachable) frame as the
 * overview does. Spec 7.7 wants the gate out of the intro's frame or a soft shape at its right edge:
 * a frame cannot move the view sideways, and the narrowest frame that leaves the gate's membrane
 * (x 0.95 to 2.05) out would cut the host's arms (span 4.7), so the gate stays soft beside the host
 * in the intro (Task 6 report: engine-blocked, E02b or owner).
 */
const P1_FRAME: StageFrame = { width: 5.1, height: 5.08 };
const P2_FRAME: StageFrame = { width: 5.12, height: 5.08 };
const P3_FRAME: StageFrame = { width: 5.11, height: 5.08 };
export const HOST_STAGE_FRAMES: Record<StageId, StageFrame> = {
  entering: P1_FRAME,
  intro: P2_FRAME,
  overview: P3_FRAME,
  techFocus: P3_FRAME,
  detail: P3_FRAME,
};

/**
 * The engine's overview and detail panels. The host shows neither (no technologies, no detail
 * view); the boxes only need to be valid, above the head where P2 sets its text.
 */
export const HOST_STAGE_PANELS: StagePanels = {
  overview: [-1.2, 1.6, 1.2, 0.5],
  detail: [-1.2, 1.6, 1.2, -1.2],
};

/** P2's title block: the description's line is the widest (native x 52 to 470), the wordmark's top at native y 100. */
export const HOST_INTRO_TITLE: IntroTitleBox = { halfWidth: 2.1, top: 1.54 };

/**
 * The host's Theatre project, its own (two worlds sharing one would share a sheet store). Its saved
 * state holds the authored entrance (Task 12) and arrival (Task 11), seeded from sequences/defaults.ts.
 */
export const HOST_SEQUENCES: SequenceSet = {
  projectId: 'OctoVerse Host',
  state: () => import('./sequences/state.theatre.json').then(module => module.default),
  defaults: HOST_SEQUENCE_DEFAULTS,
  entrance: HOST_ENTRANCE,
  // The gate greets its keeper (spec 7.6, ~3 s): the place's glyph and membrane props (place/config.ts), by the entrance sheet's props.
  kitDrives: { glyph: 'glyph', membraneRipple: 'membraneRipple' },
};

export const HOST_BUNDLE: WorldBundle = {
  id: 'octoverse',
  character: HOST,
  poses: HOST_POSES,
  swim: HOST_SWIM,
  artifacts: HOST_ARTIFACTS,
  sequences: HOST_SEQUENCES,
  place: REEF_WORLD,
  stage: { frames: HOST_STAGE_FRAMES, panels: HOST_STAGE_PANELS, introTitle: HOST_INTRO_TITLE },
  content: HOST_CONTENT,
  theme: HOST_THEME,
};
