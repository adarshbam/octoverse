import type { ArtifactConfig } from '../../engine/config/types';

// Veyra's artifacts as data for the engine's strategy tables (artifacts/strategies.ts). Her
// technologies are pendants that hang from her arms (spec 7.5), which the pendant placement
// (a later task) draws. Until it joins the engine's table, the orbit placement stands in with no
// shells, so there are no places to put a technology: none is drawn and none can be chosen, and the
// stages show Veyra alone. The sizes and the ring's shape are Nox's and unused until then.
export const VEYRA_ARTIFACTS: ArtifactConfig = {
  placement: {
    kind: 'orbit',
    shells: [],
    sizes: { intro: 0.16, overview: 0.2 },
    centreY: 0.25,
    halfHeight: 1.55,
    squareness: 3,
    swellPush: 0.3,
  },
  appear: { kind: 'blow' },
  select: { kind: 'suctionHold' },
  choosableIn: [],
};
