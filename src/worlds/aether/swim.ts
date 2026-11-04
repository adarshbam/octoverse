import { AETHER_POSES, BODY_X } from './poses';
import type { SwimPoseSet } from '../../engine/poses/types';

// Aether's swim (spec 7.4, 7.9): her own umbrella and trail shapes (long wavy ribbons, a
// jellyfish's pulse) are authored with the entrance in Task 17. Until then both are her intro
// arms, so a stroke moves her body (the mantle's beat, the arms' swing from the stroke drive) but
// does not reshape the arms; `stretch` 1 draws the entering pose at the intro's length.
export const SWIM_POSES: SwimPoseSet = {
  open: AETHER_POSES.intro,
  trail: AETHER_POSES.intro,
  stretch: 1,
  bodyX: BODY_X,
};
