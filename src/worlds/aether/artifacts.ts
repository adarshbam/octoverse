import { type ArmId, type ArtifactConfig, type PendantSlot, type SatellitePlacement } from '../../engine/config/types';
import { OVERVIEW_ROOM } from './poses';

const deg = (d: number) => (d * Math.PI) / 180;

/** Her gold: the ring line, the threads, the trails and the orbs' caps (spec 7.2: the ring's warm gold). */
const GOLD = '#d99982';

/** The arms in pairs from the top of her down, left then right: the order the slots fill (spec 7.5: the most important technologies on the upper arms). */
const TOP_DOWN: readonly (readonly [ArmId, ArmId])[] = [['T1', 'T8'], ['T2', 'T7'], ['T3', 'T6'], ['T4', 'T5']];

/**
 * The overview's sixteen slots (spec 7.5, P3's horseshoe): two an arm, at the room the overview pose
 * leaves for them (poses.ts OVERVIEW_ROOM: a tip point and a mid-arm point). They fill a pair of arms
 * at a time from the top down, tips first: T1's and T8's tips take orders 0 and 1, their mid-arms 2
 * and 3, then T2 and T7, and so on, so her ten technologies hang on the upper slots (T1, T8, T2 and
 * T7 both, T3 and T6 at the tips) and the lower arms' slots wait for an eleventh to sixteenth.
 */
function overviewSlots(): PendantSlot[] {
  const slots: PendantSlot[] = [];
  for (const pair of TOP_DOWN) {
    for (const which of [1, 0] as const) for (const arm of pair) slots.push({ arm, at: OVERVIEW_ROOM[arm][which], order: slots.length });
  }
  return slots;
}

// Aether's artifacts as data for the engine's strategy tables (artifacts/strategies.ts). Her
// technologies are the beads of the gold ring that fly out to her arm tips (spec 7.5): the engine's
// `satellite` placement. At rest (intro, detail) the ring circles her head at brow height, almost
// edge-on (Task 5). As her head swells into the overview the beads brighten, flare and split into
// the technology orbs, which fly along gold arcs to their pendant slots and hang there on short
// gold threads, floating (Task 12). The beads are not choosable: in the intro the way on is Explore,
// so a technology can be chosen in the overview only (until Task 19's arm lift).
export const AETHER_ARTIFACTS: ArtifactConfig & { placement: SatellitePlacement } = {
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
      line: { color: GOLD, width: 1.4, constellation: GOLD, flicker: 0.5 },
      // Spec 7.2: lavender glass with a warm gold rim; two of the five glow gold-amber.
      beads: { glass: '#93699a', rim: GOLD, lit: [1, 3] },
    },
    slots: { overview: overviewSlots() },
    // The orbs' radius: 0.3, P3's orbs 0.6 across (the plan's "0.6" is their width; poses.test.ts places the room for orbs that size).
    sizes: { overview: 0.3 },
    // Spec 7.5: a short gold thread (0.12 to 0.2 units) with a small gold cap; thin, as the ring line is.
    tether: { length: 0.16, color: GOLD, width: 0.012, sag: 0.2, cap: GOLD },
    // Spec 7.5: float, not swing: at most 15 degrees from vertical, settled in about 1.4 s.
    swing: { maxAngle: deg(15), settle: 1.4 },
  },
  appear: { kind: 'blow' },
  select: { kind: 'suctionHold' },
  choosableIn: ['overview'],
  // Spec 2.3 (P3, P4): every orb has a rim of small glowing lavender-white beads and a small gold cap where its thread attaches.
  orbStyle: { rimBeads: 16, rimColour: '#e4d9f8', cap: { colour: GOLD, size: 0.05 } },
};
