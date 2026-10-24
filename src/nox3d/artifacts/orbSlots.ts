import type { ArmChain } from '../character/armChain';
import type { ArmId, Point2 } from '../config/types';

/** Depth the technology orbs float at, in front of every arm (the front arms reach z 0.5). */
export const ORB_Z = 0.7;

/**
 * Where one technology orb rides: an arm, the arc fraction along it, the orb's radius, and its
 * offset from that point of the arm (arm space), so it hangs where the painting puts it and
 * follows the arm as it moves.
 */
export interface OrbSlot {
  armId: ArmId;
  u: number;
  radius: number;
  offset: Point2;
}

/**
 * The orb centres in panel 3 (world units, high-quality panel, scripts/hq3.py): HTML, CSS,
 * JavaScript, TypeScript, Node.js, Redis, Docker, GitHub, Linux, Kali (low), MongoDB, Python,
 * Kali (top); then two in the same rhythm, mirroring TypeScript on the right and below the face.
 */
export const PANEL3_ORBS: readonly Point2[] = [
  [-1.97, 0.58], [-2.19, 0.09], [-1.85, -0.34], [-1.26, -0.64], [-1.87, -0.91], [-1.28, -1.24], [-0.53, -1.42], [0.49, -1.42],
  [1.43, -1.26], [2.31, -0.93], [1.91, -0.46], [2.27, 0.07], [1.99, 0.56], [1.36, -0.64], [0.0, -1.75],
];

/**
 * The overview's 15 orb slots, in the order technologies fill them: each panel 3 orb on the
 * nearest outer half of an arm (at most three to an arm), worked out from the overview's rest pose.
 */
export const NOX_OVERVIEW_SLOTS: readonly OrbSlot[] = [
  { armId: 'T2', u: 0.906, radius: 0.25, offset: [-0.007, 0.092] },
  { armId: 'T2', u: 0.758, radius: 0.25, offset: [-0.098, -0.016] },
  { armId: 'T2', u: 0.586, radius: 0.25, offset: [-0.028, -0.016] },
  { armId: 'T3', u: 0.461, radius: 0.25, offset: [-0.047, 0.317] },
  { armId: 'T3', u: 0.742, radius: 0.25, offset: [-0.014, -0.018] },
  { armId: 'T3', u: 0.508, radius: 0.25, offset: [0.038, -0.233] },
  { armId: 'T4', u: 0.477, radius: 0.25, offset: [-0.047, 0.049] },
  { armId: 'T5', u: 0.445, radius: 0.25, offset: [-0.11, -0.065] },
  { armId: 'T5', u: 0.852, radius: 0.25, offset: [0.281, 0] },
  { armId: 'T6', u: 0.773, radius: 0.25, offset: [0.337, 0.173] },
  { armId: 'T7', u: 0.617, radius: 0.25, offset: [0.133, -0.183] },
  { armId: 'T7', u: 0.797, radius: 0.25, offset: [0.236, -0.032] },
  { armId: 'T8', u: 0.656, radius: 0.25, offset: [0.189, -0.047] },
  { armId: 'T7', u: 0.445, radius: 0.25, offset: [-0.011, -0.189] },
  { armId: 'T4', u: 0.445, radius: 0.25, offset: [0.416, -0.296] },
];

/** Fills slots with technologies in project order; those beyond the last slot overflow, in order. */
export function assignOrbs(techIds: readonly string[], slots: readonly OrbSlot[]) {
  return {
    placed: techIds.slice(0, slots.length).map((techId, i) => ({ techId, slot: slots[i] })),
    overflow: techIds.slice(slots.length),
  };
}

const at = { x: 0, y: 0, z: 0 };

/** The orb's centre in arm space for the arm as it is now (x, y; it floats at ORB_Z). */
export function orbRestPosition(chain: ArmChain, slot: OrbSlot) {
  chain.pointAt(slot.u, at);
  return { x: at.x + slot.offset[0], y: at.y + slot.offset[1] };
}
