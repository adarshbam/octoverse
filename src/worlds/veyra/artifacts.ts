import type { ArmId, ArtifactConfig, ChoosingStage, PendantPlacement, PendantSlot } from '../../engine/config/types';
import { VEYRA } from './character';

// Veyra's artifacts as data for the engine's strategy tables (artifacts/strategies.ts). Her
// technologies are glass orbs hung as pendants on short glowing threads from her arms (spec 7.5):
// the engine's `pendant` placement. Until Task 19 gives her the bloom and the arm lift, the engine's
// `blow` appearance and `suctionHold` choice stand in (a pendant is blown from her mouth to its
// place, and a chosen one is drawn to the nearest arm's tip).

/** Arms from the top of her down, left then right: the order the first slots go to (spec 7.5: the most important technologies sit on the top arms). */
const TOP_DOWN: readonly ArmId[] = ['T1', 'T8', 'T2', 'T7', 'T3', 'T6', 'T4', 'T5'];

/**
 * The arc fractions an arm's pendants hang at, outermost first (the arm's second pendant is the
 * second number), as fitted to each stage's pose, arms as the rig draws them (rest bend included),
 * by `threadClearance` (artifacts.test.ts): every thread and orb stays more than 0.05 clear of the
 * other arms and the face, and no two orbs touch. The curled arms leave little room under the upper
 * arms, so an arm with no number for a stage carries none there (the intro has none on T8, the arm
 * that hooks over T7; the overview has one each on the four upper arms). Task 14 re-places them
 * against P3's twelve.
 */
const FRACTIONS: Record<ChoosingStage, Partial<Record<ArmId, readonly number[]>>> = {
  intro: { T1: [1, 0.81], T2: [1, 0.74], T7: [1, 0.71], T3: [1, 0.63], T6: [1, 0.52], T4: [0.95], T5: [0.8, 0.51] },
  overview: { T1: [1], T8: [1], T2: [1], T7: [1], T3: [1, 0.63], T6: [1, 0.7], T4: [1, 0.48], T5: [1, 0.64] },
};

/** A stage's slots: every arm's outermost pendant in top-down order, then every arm's second, so the first technologies fill the top arms. */
function slotsFor(stage: ChoosingStage): PendantSlot[] {
  const slots: PendantSlot[] = [];
  for (const pass of [0, 1]) {
    for (const arm of TOP_DOWN) {
      const at = FRACTIONS[stage][arm]?.[pass];
      if (at !== undefined) slots.push({ arm, at, order: slots.length });
    }
  }
  return slots;
}

export const VEYRA_ARTIFACTS: ArtifactConfig & { placement: PendantPlacement } = {
  placement: {
    kind: 'pendant',
    slots: { intro: slotsFor('intro'), overview: slotsFor('overview') },
    maxPerArm: 2,
    // The orbs' radii. P3's orbs are larger (about 0.28 on the stage); the arms' curls leave no room for that under a thread with twelve of them, so Task 14 settles the size against the slots.
    sizes: { intro: 0.12, overview: 0.15 },
    // A thin cyan thread (her wet-skin highlight) that bows a little, ending in a cream-gold cap (her cups' cream).
    tether: { length: 0.08, color: VEYRA.palette.wet, width: 0.014, sag: 0.12, cap: VEYRA.palette.suckerBody },
  },
  // Until the bloom and the arm lift (Task 19): the blow and the suction hold.
  appear: { kind: 'blow' },
  select: { kind: 'suctionHold' },
  choosableIn: ['intro', 'overview'],
};
