import { AETHER_POSES, BODY_X } from './poses';
import { AETHER_SWIM_STRETCH, swimArms } from './swimArms';
import type { StagePose, SwimPoseSet } from '../../engine/poses/types';

// Aether's swim (spec 7.4, 7.9; Task 17): her own open bell and trailing ribbons (swimArms.ts,
// read from P1), each from its intro root at its intro length, the happy face of the swim. The two
// poses are built on first use (16 curve fits), not when the page loads: nothing here may delay the
// first frame.

const pose = (which: 'open' | 'trail'): StagePose => ({ ...AETHER_POSES.intro, arms: swimArms(AETHER_POSES.intro.arms)[which], expression: 'happy' });

let built: { open: StagePose; trail: StagePose } | null = null;
const build = () => (built ??= { open: pose('open'), trail: pose('trail') });

/** Aether's swim (`AETHER_BUNDLE.swim`). */
export const SWIM_POSES: SwimPoseSet = {
  get open() {
    return build().open;
  },
  get trail() {
    return build().trail;
  },
  stretch: AETHER_SWIM_STRETCH,
  bodyX: BODY_X,
};
