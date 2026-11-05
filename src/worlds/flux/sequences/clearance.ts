import { strokeTiming } from '../../../engine/motion/stroke';
import type { EntranceGeometry, Footprint } from '../../../engine/sequences/entrance';
import { FLUX } from '../character';

// What the entrance's clearance check measures Flux with (spec 7.9: the path stays clear of the
// towers, the bridge piers and the portal with the arms open or closed): his arm reach, his
// stroke's timing, and the footprints of the pipeline kit's tall pieces. Veyra's are her own
// (worlds/veyra/sequences/clearance.ts); this is a copy of the pattern, not an import.

/**
 * How far his arms reach either side of his centre, in stage units: `open` as the swim's umbrella
 * opens (its widest arm, T2, reaches 2.22 before the stroke swings it back; the intro's T2 and T7
 * reach 1.96 and 1.98) and `closed` with the arms streaming behind (the trail bundle at the swim's
 * stretch: its loosest arm, T1, reaches 1.48; the head is 0.76 either side). Each with the tip's
 * 0.05 on top. entrance.test.ts measures both from the poses.
 */
export const FLUX_ARM_HALF_SPAN = { open: 2.3, closed: 1.55 } as const;

/**
 * The intro pose's reach (T2 and T7 at 1.96 and 1.98, with the tip): the widest his arms are once the
 * strokes are over, as they open from the trail into the intro (entrance.test.ts checks the arrival
 * with it: the umbrella never opens there).
 */
export const FLUX_INTRO_HALF_SPAN = 2.05;

/**
 * The pipeline kit's tall pieces as half their footprint (x across, z deep) about the origin each
 * is placed by, before a placement's rotY and scale: the widest side of each mesh's bounds in
 * public/flux/world/kit.glb (POSITION min and max through the node's quantisation scale and
 * offset), so an off-centre piece counts its far side both ways. The towers and the loose rack
 * module, the bridge's pier and deck, and the portal's plinth (the ring's arcs and the disc stand
 * inside it). The rocks and the coral clumps are low and sit at the edges: passed over.
 */
export const FLUX_ENTRANCE_FOOTPRINTS: Readonly<Record<string, Footprint>> = {
  tower_a: { x: 1.78, z: 1.18 },
  tower_b: { x: 1.43, z: 1.42 },
  tower_c: { x: 1.87, z: 1.94 },
  rack_module: { x: 0.8, z: 0.72 },
  bridge_pier: { x: 0.71, z: 0.69 },
  bridge_deck: { x: 3.0, z: 0.63 },
  portal_plinth: { x: 2.86, z: 1.55 },
};

/**
 * His swim for the clearance check: the stroke he really swims, `strokeTiming(personality)` (the
 * glide times `glideBias` 0.55: 0.32 s), never `personality.swim`.
 */
export const FLUX_ENTRANCE_GEOMETRY: Pick<EntranceGeometry, 'swim' | 'armHalfSpan'> = {
  swim: strokeTiming(FLUX.personality),
  armHalfSpan: FLUX_ARM_HALF_SPAN,
};
