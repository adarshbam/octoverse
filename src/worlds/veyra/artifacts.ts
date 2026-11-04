import type { ArmId, ArtifactConfig, ChoosingStage, PendantPlacement, PendantSlot } from '../../engine/config/types';
import { VEYRA } from './character';

// Veyra's artifacts as data for the engine's strategy tables (artifacts/strategies.ts). Her
// technologies are glass orbs hung as pendants on short glowing threads from her arms (spec 7.5):
// the engine's `pendant` placement. Until Task 19 gives her the bloom and the arm lift, the engine's
// `blow` appearance and `suctionHold` choice stand in (a pendant is blown from her mouth to its
// place, and a chosen one is drawn to the nearest arm's tip).

/** Arms from the top of her down, left then right: the order each pass of slots goes in (spec 7.5: the most important technologies sit on the top arms). */
const TOP_DOWN: readonly ArmId[] = ['T1', 'T8', 'T2', 'T7', 'T3', 'T6', 'T4', 'T5'];

/**
 * Each arm's two pendants as arc fractions, [tip, midway] (spec 7.5: sixteen slots, two an arm), in
 * both choosing stages, on the arms as the rig draws them (rest bend included). Fitted by Task 14
 * against slotCriteria.ts, the tests' measure (artifacts.test.ts): every thread and orb stays more
 * than 0.05 clear of the other arms, the face (the dome in the overview) and the HTML (the intro's
 * title block and nameplate, the phone's sheet and tray) at the review desktop and at 390 x 844,
 * across the whole swing (plus and minus 25 degrees); no orb sits on its own arm away from where it
 * hangs; no two orbs touch. The overview's tips are P3's: each arm's first pendant hangs under its
 * hook or curl where P3 paints an orb (under T1 P3's React, T8 GitHub, T2 TypeScript, T7 Cloudflare,
 * T3 JavaScript, T6 Linux, T4 Express, T5 Docker; which technology hangs there is the project's
 * order, top arms first, not P3's). P3's four middle orbs (Node, MongoDB, Redis, AWS)
 * hang lower than any midway slot can: they hang from arms Veyra does not have (P3 paints eleven),
 * so her midway slots sit higher along T3, T6, T4 and T5, and the four the painting has no orb for
 * (the second on T1, T8, T2, T7) follow the same rhythm. The intro's are fitted the same way round
 * P2's arms, which leave less room (the nameplate under the centre arms, T8 hooked over T7).
 */
const FRACTIONS: Record<ChoosingStage, Record<ArmId, readonly [number, number]>> = {
  intro: { T1: [0.98, 0.89], T2: [0.76, 0.68], T3: [0.64, 0.54], T4: [0.65, 0.48], T5: [0.7, 0.45], T6: [0.93, 0.82], T7: [0.73, 0.59], T8: [0.71, 0.62] },
  overview: { T1: [0.96, 0.7], T2: [0.97, 0.75], T3: [0.94, 0.53], T4: [0.8, 0.51], T5: [0.87, 0.6], T6: [0.92, 0.75], T7: [0.96, 0.75], T8: [0.99, 0.8] },
};

/**
 * The order the midway slots fill in: first the four P3 paints (T3, T6, T4, T5), so twelve
 * technologies (P3's twelve) take P3's twelve places, then the other four.
 */
const MIDWAY: readonly ArmId[] = ['T3', 'T6', 'T4', 'T5', 'T1', 'T8', 'T2', 'T7'];

/**
 * A stage's slots: every arm's tip in top-down order, then the midway slots. Both stages use the
 * same order of arms, so a technology hangs from the same arm in the intro and the overview and
 * only slides along it as the stage changes.
 */
function slotsFor(stage: ChoosingStage): PendantSlot[] {
  const slots: PendantSlot[] = [];
  for (const arm of TOP_DOWN) slots.push({ arm, at: FRACTIONS[stage][arm][0], order: slots.length });
  for (const arm of MIDWAY) slots.push({ arm, at: FRACTIONS[stage][arm][1], order: slots.length });
  return slots;
}

export const VEYRA_ARTIFACTS: ArtifactConfig & { placement: PendantPlacement } = {
  placement: {
    kind: 'pendant',
    slots: { intro: slotsFor('intro'), overview: slotsFor('overview') },
    maxPerArm: 2,
    // The orbs' radii, in the arms' units (the overview's on the stage: 0.085 x 1.1 = 0.094). The
    // largest that keep sixteen clear across the whole swing (Task 14's trade, in the review log):
    // P3's orbs are about 0.28 on the stage, and its twelve alone would allow only about 0.1 here.
    sizes: { intro: 0.075, overview: 0.085 },
    // A short cyan thread (her wet-skin highlight) that bows a little, ending in a cream-gold cap (her cups' cream): 0.03 long, so the orb hangs snug under the arm, and 0.02 wide so it reads.
    tether: { length: 0.03, color: VEYRA.palette.wet, width: 0.02, sag: 0.12, cap: VEYRA.palette.suckerBody },
  },
  // Until the bloom and the arm lift (Task 19): the blow and the suction hold.
  appear: { kind: 'blow' },
  select: { kind: 'suctionHold' },
  choosableIn: ['intro', 'overview'],
};
