import type { ArtifactConfig } from '../../engine/config/types';

// The host has no technologies (spec 7.4): no artifact is placed, appears or can be chosen. The
// strategies are still named (the bundle needs one of each); with no shells and no technologies
// the orbit lays out nothing, and `choosableIn: []` (amendment A3) keeps the buttons and the tray away.
export const HOST_ARTIFACTS: ArtifactConfig = {
  placement: {
    kind: 'orbit',
    shells: [],
    sizes: { intro: 0.16, overview: 0.2 },
    centreY: 0.25,
    halfHeight: 1.55,
    squareness: 3,
    swellPush: 0,
  },
  appear: { kind: 'blow' },
  select: { kind: 'suctionHold' },
  choosableIn: [],
};
