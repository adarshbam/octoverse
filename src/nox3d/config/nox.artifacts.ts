import type { ArtifactConfig } from './types';

// Nox's artifacts as data for the engine's strategy tables (artifacts/strategies.ts): his
// technology bubbles orbit on three shells, are blown from his mouth, and are pulled to an arm's
// tip when chosen, in the intro and in the overview.

/**
 * Nox's artifacts. The shells: each is a rounded ring, as wide as `radius` and as tall as one
 * height (the tilt is made up for, so the three show the same height on the page), round the
 * title lines above Nox and the nameplate below, outside his face and the overview's panel. The
 * tilts set the shells at different depths where their rings run together, which is what keeps the
 * bubbles of one shell clear of the next; all three circle at one pace, so a bubble keeps its
 * distance from the rest.
 */
export const NOX_ARTIFACTS: ArtifactConfig = {
  placement: {
    kind: 'orbit',
    shells: [
      { radius: 1.8, tilt: -0.3, speed: 0.21 },
      { radius: 1.95, tilt: 0, speed: 0.21 },
      { radius: 2.1, tilt: 0.3, speed: 0.21 },
    ],
    // A bubble's radius in each stage's framing (the intro frames Nox smaller, and its bubbles are smaller with it).
    sizes: { intro: 0.16, overview: 0.2 },
    // Where the rings are centred, in body space (a little above the arms' root), and the height they show.
    centreY: 0.25,
    halfHeight: 1.55,
    // How square the rings are: 2 is an ellipse, more is a rounder rectangle.
    squareness: 3,
    // How far a full swell pushes the rings out, as a fraction of their size.
    swellPush: 0.3,
  },
  appear: { kind: 'blow' },
  select: { kind: 'suctionHold' },
  choosableIn: ['intro', 'overview'],
};
