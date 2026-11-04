import type { ArtifactConfig } from '../../engine/config/types';

// Aether's artifacts as data for the engine's strategy tables (artifacts/strategies.ts). Her
// technologies are the beads of the gold ring that fly out to her arm tips (spec 7.5); the
// satellite placement and its slot tables arrive in Task 5 and Task 12. Until then this is the
// engine's `orbit` placement with no visible orbit: the brief asks for zero shells, but the
// engine's layout (artifacts/bubbleOrbits.ts `layoutOrbits`) picks a shell by `i % shells.length`
// and crashes on an empty list (`shells[NaN]`), and src/engine is not this task's to change. So the
// placeholder is one shell of radius 0 and speed 0, with bubbles of size 0: the technologies are
// all there (the list, the tray, the keyboard path), but nothing is drawn round her.
export const AETHER_ARTIFACTS: ArtifactConfig = {
  placement: {
    kind: 'orbit',
    shells: [{ radius: 0, tilt: 0, speed: 0 }],
    sizes: { intro: 0, overview: 0 },
    centreY: 0.25,
    halfHeight: 1.55,
    squareness: 3,
    swellPush: 0.3,
  },
  appear: { kind: 'blow' },
  select: { kind: 'suctionHold' },
  choosableIn: ['intro', 'overview'],
};
