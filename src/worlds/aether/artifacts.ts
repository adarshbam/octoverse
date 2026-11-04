import type { ArtifactConfig } from '../../engine/config/types';

const deg = (d: number) => (d * Math.PI) / 180;

// Aether's artifacts as data for the engine's strategy tables (artifacts/strategies.ts). Her
// technologies are the beads of the gold ring that fly out to her arm tips (spec 7.5). The ring is
// the engine's `satellite` placement at rest (Task 5): it circles her head at brow height, almost
// edge-on, in the intro and the detail. Its active form (pendants on the arms) arrives in Task 12;
// until then the overview lays out no orbs (the technologies' buttons stay, inert, for the keyboard).
// The beads are not choosable: in the intro the way on is Explore, so a technology can be chosen in
// the overview only.
export const AETHER_ARTIFACTS: ArtifactConfig = {
  placement: {
    kind: 'satellite',
    ring: {
      // Spec 2.2: centre y -0.28 (brow height), projected half-width 1.25, right side about 8 degrees higher, almost edge-on.
      radius: 1.25,
      centreY: -0.28,
      tilt: 1.36,
      roll: 0.14,
      beadCount: 5,
      // P2's seed beads are 10 to 18 px across at 100 px a unit.
      beadSize: 0.075,
      // Five homes spread evenly over the rear 270 degrees, 54 degrees apart, the face's 90 degrees left clear.
      homes: [deg(72), deg(126), deg(180), deg(234), deg(288)],
      // Spec 7.5: each sways +-12 degrees about its home, with its own period of 6 to 9 s.
      sway: { amplitude: 0.21, period: [6, 9] },
      keepOut: Math.PI / 4,
      // Spec 2.3: a thin gold line, at most 1.5 px at P2's size; faint gold constellation lines between neighbours.
      // 1.4, not 1.5: measured on the render with its anti-aliased fringe, 1.5 read 1.49 to 1.60 px; 1.4 reads 1.33 to 1.49 (Task 6).
      // The beads stay on the spec's homes and roll: P2's two bead samples (1.06, -0.13 and -1.04, -0.03) need the
      // left side about 4 degrees higher (roll -4 degrees), against spec 2.2's right side 8 degrees higher (Task 6 fix round 1).
      line: { color: '#d99982', width: 1.4, constellation: '#d99982', flicker: 0.5 },
      // Spec 7.2: lavender glass with a warm gold rim; two of the five glow gold-amber.
      beads: { glass: '#93699a', rim: '#d99982', lit: [1, 3] },
    },
  },
  appear: { kind: 'blow' },
  select: { kind: 'suctionHold' },
  choosableIn: ['overview'],
};
