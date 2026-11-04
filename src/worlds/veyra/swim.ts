import { BODY_X, VEYRA_POSES } from './poses';
import type { SwimPoseSet } from '../../engine/poses/types';

// Veyra's swim poses: placeholders, copies of her intro arms (spec 7.9 gives her own long-glide
// stroke later). The arms do not change shape as she strokes until the entrance task authors the
// open umbrella and the trailing bundle.
export const VEYRA_SWIM: SwimPoseSet = {
  open: { ...VEYRA_POSES.intro, expression: 'happy' },
  trail: { ...VEYRA_POSES.intro, expression: 'happy' },
  stretch: 1,
  bodyX: BODY_X,
};
