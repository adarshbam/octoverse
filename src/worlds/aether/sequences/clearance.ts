import { strokeTiming } from '../../../engine/motion/stroke';
import type { EntranceGeometry, Footprint } from '../../../engine/sequences/entrance';
import { AETHER } from '../character';

// What the entrance's clearance check measures Aether with (spec 7.9: the path clears the arch,
// towers and floating rubble with the arms open or closed): her arm reach, her stroke's timing, and
// the footprints of the observatory's stone. Nox's are NOX_ENTRANCE_FOOTPRINTS and ARM_HALF_SPAN,
// Veyra's her own clearance.ts.

/**
 * How far her arms reach either side of her centre, in stage units. `open`: the intro's arms reach
 * 1.99 (T1's curl on the left), the swim's open bell 2.14 before it is swung back, and the stage
 * stretches the swim's arms by 12% (AETHER_SWIM_STRETCH): 2.14 x 1.12 = 2.40. `closed`: the trailing
 * ribbons reach 1.04 either side, 1.16 stretched; the head is 0.745 either side: 1.3. Held open the
 * whole way (2.40, a circle every way), it also covers the ribbons streaming behind her when swung
 * back (the trail's farthest point is 2.72 from her head's middle, about 2.1 of it behind her at
 * the swim's lean): swim.test.ts measures the poses.
 */
export const AETHER_ARM_HALF_SPAN = { open: 2.4, closed: 1.3 } as const;

/**
 * The observatory's pieces the path must keep clear of, as half their footprint (x across, z deep)
 * in the piece's own axes before a placement's rotY and scale: the larger side of each piece's box in
 * kit.glb about the origin the layout places it by (read from the file's accessors, as layout.test
 * reads them). The arch and its steps, the four towers, the three walls and the five floating
 * stones. The floating stones hang in the mid water at her height; their footprint counts at every
 * height, as the pillars' do. The rocks and corals stand low at the stage's edges and in front of it,
 * and are passed over or never reached, as Nox's rocks are.
 */
export const AETHER_ENTRANCE_FOOTPRINTS: Readonly<Record<string, Footprint>> = {
  portal_arch: { x: 2.35, z: 1.04 },
  portal_steps: { x: 2.44, z: 2.52 },
  tower_a: { x: 2.13, z: 2.01 },
  tower_b: { x: 2.32, z: 2.26 },
  tower_c: { x: 2.68, z: 2.37 },
  tower_d: { x: 1.84, z: 1.85 },
  wall_a: { x: 2.35, z: 0.36 },
  wall_b: { x: 1.85, z: 0.36 },
  wall_c: { x: 1.45, z: 0.36 },
  rubble_float_a: { x: 0.55, z: 0.4 },
  rubble_float_b: { x: 0.4, z: 0.4 },
  rubble_float_c: { x: 0.7, z: 0.45 },
  rubble_float_d: { x: 0.3, z: 0.25 },
  rubble_float_e: { x: 0.5, z: 0.35 },
};

/**
 * Her swim for the clearance check: the stroke she really swims, `strokeTiming(personality)` (the
 * glide stretched by `glideBias` to 0.85 s), never the raw `personality.swim`.
 */
export const AETHER_ENTRANCE_GEOMETRY: Pick<EntranceGeometry, 'swim' | 'armHalfSpan'> = {
  swim: strokeTiming(AETHER.personality),
  armHalfSpan: AETHER_ARM_HALF_SPAN,
};
