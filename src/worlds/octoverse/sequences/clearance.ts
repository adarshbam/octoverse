import { strokeTiming } from '../../../engine/motion/stroke';
import type { EntranceGeometry, Footprint } from '../../../engine/sequences/entrance';
import { HOST } from '../character';

// What the entrance's clearance check measures the host with (platform spec 7.6: the path stays clear
// of the gateway and rocks): its arm reach, its stroke's timing, and the footprints of the reef's
// gate and rocks. Veyra's are VEYRA_ENTRANCE_FOOTPRINTS and VEYRA_ARM_HALF_SPAN.

/**
 * How far the host's arms reach either side of its centre, in stage units, read off its own poses
 * (entrance.test.ts checks each against them): `open` is the swim's open umbrella at its widest
 * (2.99, wider than the intro's welcome), `intro` the intro pose's widest arm (2.43, the arms as the
 * settle opens them), `closed` the trail bundle (1.29) with the arms streaming behind.
 */
export const HOST_ARM_HALF_SPAN = { open: 3.0, intro: 2.45, closed: 1.3 } as const;

/**
 * The reef's pieces the path must keep clear of, as half their footprint (x across, z deep) in the
 * piece's own axes before a placement's rotY and scale: the larger side of each piece's box in
 * kit.nodes.json (blender/reef/build_kit.py writes it), so a box about the origin covers the whole
 * piece. The gate's arch with its threshold rubble, and the four rocks, every one counted however low
 * it stands (the spec names them). The corals and the floating glass cards are scenery the swim passes
 * over or behind.
 */
export const HOST_ENTRANCE_FOOTPRINTS: Readonly<Record<string, Footprint>> = {
  gate_arch: { x: 1.89, z: 1.04 },
  rock_a: { x: 1.21, z: 1.02 },
  rock_b: { x: 1.02, z: 1.33 },
  rock_c: { x: 0.93, z: 0.81 },
  rock_d: { x: 1.83, z: 1.28 },
};

/** Its swim for the clearance check: the stroke it really swims, `strokeTiming(personality)` (no glideBias: the spec's 0.58 / 0.24 / 0.8). */
export const HOST_ENTRANCE_GEOMETRY: Pick<EntranceGeometry, 'swim' | 'armHalfSpan'> = {
  swim: strokeTiming(HOST.personality),
  armHalfSpan: HOST_ARM_HALF_SPAN,
};
