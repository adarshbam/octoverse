import type { ArmId, ArtifactConfig, ChoosingStage, PendantPlacement, PendantSlot } from '../../engine/config/types';

// Flux's artifacts as data for the engine's strategy tables (artifacts/strategies.ts). His
// technologies are glass orbs that "glow and float at the end of each tentacle" (P3): the engine's
// `pendant` placement (spec 7.5) with no thread, each orb hanging straight off a small violet-pink
// cap at its slot. Until the pulse appear and the arm lift (Task 16) the engine's `blow` appear and
// `suctionHold` choice stand in. A technology can be chosen in the overview only (ruling R1).

/**
 * The small cap where an orb meets its arm: P3's violet-pink (181, 143, 208), the mean of the cap
 * pixels that are violet-pink (red over green by 25 or more, blue over red) on the Linux, chart, git
 * and Redis caps of the native P3 panel.
 */
export const CAP_VIOLET_PINK = '#b58fd0';

/** P3's orb rim: the lavender-white (190, 192, 232) of the brightest quarter of the rim on six orbs (native P3). With no rim beads it is not drawn; the engine's orb style needs one. */
export const ORB_RIM = '#bec0e8';

/**
 * The intro's orb radius: spec 7.5 wants none (the intro shows the pulse waves only, P2), but the
 * engine refuses a size of 0 (types/bundle.ts checkPendants, "above 0"). A thousandth of a unit is
 * under a pixel at every viewport. An engine-owner item: allow 0 (Task 16's pulse appear expects it).
 */
export const INTRO_ORB_SIZE = 0.001;

/**
 * The tether's width: none (the orb hangs off its cap, spec 7.5), but the engine refuses a width of
 * 0 (checkPendants). At a thousandth of a unit its own bead (1.8 widths) is under a pixel; the cap
 * that shows is the orb style's. An engine-owner item, with the size above.
 */
const NO_THREAD = 0.001;

/** Arms from the top of him down, left then right: the order each pass of slots fills (spec 7.5: the most important technologies on the top arms). */
const TOP_DOWN: readonly ArmId[] = ['T1', 'T8', 'T2', 'T7', 'T3', 'T6', 'T4', 'T5'];

/** Where on its arm a slot is, as an arc fraction: the tip, and about 55% along (spec 7.5). */
const TIP = 1;
const MID = 0.55;

/**
 * A stage's sixteen slots: the eight tips (order 0 to 7, top arms first), then the mid-arm slots of
 * T1, T8, T2 and T7 (8 to 11: with the tips, P3's twelve), then of T3, T6, T4 and T5 (12 to 15).
 * The intro and the overview share them, so a technology keeps its arm and place from stage to
 * stage. The overview pose (poses.ts) is shaped round them: each tip ends over the orb it holds and
 * T1, T8, T2 and T7 run out level where their mid orbs hang, so the twelve stay clear (artifacts.test.ts).
 */
const slots = (): PendantSlot[] => [...TOP_DOWN.map(arm => ({ arm, at: TIP })), ...TOP_DOWN.map(arm => ({ arm, at: MID }))].map((slot, order) => ({ ...slot, order }));

export const FLUX_SLOTS: Record<ChoosingStage, PendantSlot[]> = { intro: slots(), overview: slots() };

export const FLUX_ARTIFACTS: ArtifactConfig & { placement: PendantPlacement } = {
  placement: {
    kind: 'pendant',
    slots: FLUX_SLOTS,
    maxPerArm: 2,
    // P3's orbs are 0.28 across the radius (spec 7.5: 0.28 +- 0.03), larger than Veyra's.
    sizes: { intro: INTRO_ORB_SIZE, overview: 0.28 },
    // No thread: length 0, the orb straight off its cap.
    tether: { length: 0, color: CAP_VIOLET_PINK, width: NO_THREAD, sag: 0, cap: CAP_VIOLET_PINK },
  },
  appear: { kind: 'blow' },
  select: { kind: 'suctionHold' },
  choosableIn: ['overview'],
  // Spec 7.5: a small violet-pink cap where the orb meets the arm, and no rim beads.
  orbStyle: { rimBeads: 0, rimColour: ORB_RIM, cap: { colour: CAP_VIOLET_PINK, size: 0.05 } },
};
