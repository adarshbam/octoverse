import { BODY_X, SWIM_STRETCH, hostSwimPoses } from './poses';
import type { SwimPoseSet } from '../../engine/poses/types';

// The host's swim (spec 7.4: "its own open and trail shapes, long and graceful"), from P1 (Task 6):
// `open`, the umbrella the arms open into on each recovery, and `trail`, P1's long loose bundle the
// power stroke sweeps them back into (poses.ts draws both, from the intro's roots, SWIM_STRETCH
// times the intro's length). Built on first read, as Nox's are, so nothing here delays the first frame.

export const HOST_SWIM: SwimPoseSet = {
  get open() {
    return hostSwimPoses().open;
  },
  get trail() {
    return hostSwimPoses().trail;
  },
  stretch: SWIM_STRETCH,
  bodyX: BODY_X,
};
