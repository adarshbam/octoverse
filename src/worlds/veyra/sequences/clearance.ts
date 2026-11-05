import { strokeTiming } from '../../../engine/motion/stroke';
import type { EntranceGeometry, Footprint } from '../../../engine/sequences/entrance';
import { VEYRA } from '../character';

// What the entrance's clearance check measures Veyra with (spec 7.9: the path stays clear of the arch
// and walls with the arms open or closed): her arm reach, her stroke's timing, and the footprints of
// the vault's stone. Nox's are NOX_ENTRANCE_FOOTPRINTS and ARM_HALF_SPAN (worlds/nox/bundle.ts).

/**
 * How far her arms reach either side of her centre, in stage units: `open` in the intro pose and as the
 * swim's open umbrella opens (the intro's arms reach 1.86, the swim's open pose 2.05 before it is
 * swung back, so 2.05), and `closed` with the arms streaming behind (the trail bundle reaches 1.18
 * and the stage's stretch lengthens it by 12%; the head is 0.88 either side: 1.3).
 */
export const VEYRA_ARM_HALF_SPAN = { open: 2.05, closed: 1.3 } as const;

/**
 * The vault's pieces the path must keep clear of, as half their footprint (x across, z deep) in the
 * piece's own axes before a placement's rotY and scale. Read off blender/vault/build_kit.py, the
 * pieces' stone boxes, taken about the origin the kit places them by (the widest side where the
 * box is not centred): the arch's plinth 4.1 across and 1.3 deep (its jambs, head and back wall
 * fit inside it), the broken wall 4.6 long and 0.9 deep (0.96 with its courses' jitter), the four
 * blocks, and the steps (2.8 across, the five treads 3.65 deep). The low rocks, plants and corals
 * stand at the edges and are passed over, as Nox's rocks are.
 */
export const VEYRA_ENTRANCE_FOOTPRINTS: Readonly<Record<string, Footprint>> = {
  arch: { x: 2.05, z: 0.65 },
  wall_broken: { x: 2.3, z: 0.48 },
  block_a: { x: 1.1, z: 0.75 },
  block_b: { x: 1.05, z: 0.7 },
  block_c: { x: 0.7, z: 0.65 },
  // The fallen stone beside the slab sticks out at +x (x -1.4 to 1.95): the footprint takes the wider side both ways.
  block_d: { x: 1.95, z: 0.8 },
  steps: { x: 1.5, z: 1.9 },
};

/**
 * Her swim for the clearance check: the stroke she really swims, `strokeTiming(personality)` (the glide
 * stretched by `glideBias`: 1.0 s, not the raw 0.625), never `personality.swim`.
 */
export const VEYRA_ENTRANCE_GEOMETRY: Pick<EntranceGeometry, 'swim' | 'armHalfSpan'> = {
  swim: strokeTiming(VEYRA.personality),
  armHalfSpan: VEYRA_ARM_HALF_SPAN,
};
