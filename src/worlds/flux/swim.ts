import { BODY_X, FLUX_POSES } from './poses';
import type { SwimPoseSet } from '../../engine/poses/types';

// Flux's swim (`FLUX_BUNDLE.swim`). Placeholder until the entrance task (spec 7.9): both of the
// stroke's shapes are the intro pose, so the arms hold still through a stroke and the mantle's
// beat (personality.swim) still plays. The real `open` and `trail` poses are authored then.
export const SWIM_POSES: SwimPoseSet = {
  open: FLUX_POSES.intro,
  trail: FLUX_POSES.intro,
  stretch: 1,
  bodyX: BODY_X,
};
