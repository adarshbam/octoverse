import { BODY_X, HOST_POSES } from './poses';
import type { SwimPoseSet } from '../../engine/poses/types';

// The host's swim (spec 7.4: "its own open and trail shapes, long and graceful"). Placeholders until
// the host's entrance is built: both shapes are the intro's arms, so a stroke holds the intro pose
// rather than borrow another world's. The entering pose is the intro too (poses.ts), so it is drawn
// at the intro's length (stretch 1).

export const HOST_SWIM: SwimPoseSet = {
  open: HOST_POSES.intro,
  trail: HOST_POSES.intro,
  stretch: 1,
  bodyX: BODY_X,
};
