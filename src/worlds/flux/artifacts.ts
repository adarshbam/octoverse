import type { ArtifactConfig } from '../../engine/config/types';

// Flux's artifacts as data for the engine's strategy tables (artifacts/strategies.ts). A
// placeholder until the technology-orb task (Task 12): the orbit placement on one plain shell (the
// engine lays the orbs out over `shells[i % shells.length]`, so an empty list breaks the page with
// twelve technologies: `NaN` index, artifacts/bubbleOrbits.ts `layoutOrbits`), and a technology can
// be chosen in the overview only (ruling R1), where the orbs will hang. The appear and the select
// are the engine's existing kinds.
export const FLUX_ARTIFACTS: ArtifactConfig = {
  placement: {
    kind: 'orbit',
    shells: [{ radius: 1.95, tilt: 0, speed: 0.21 }],
    sizes: { intro: 0.16, overview: 0.2 },
    centreY: 0.25,
    halfHeight: 1.55,
    squareness: 3,
    swellPush: 0.3,
  },
  appear: { kind: 'blow' },
  select: { kind: 'suctionHold' },
  choosableIn: ['overview'],
};
