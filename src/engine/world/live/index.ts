// The live elements a world may add beyond the six shares (snow, motes, fish, rays, bubbles,
// embers): a closed table, one entry per element (spec 9). Each entry is the element's shape; the
// renderer is the shared strand module (Kelp.tsx). A world turns one on with `live.elements`.

/**
 * The shape of a strand and where its element stands. A strand is a tapered blade of `segments`
 * rings, `width` across at the root (stage units); the element keeps `clear` stage units either
 * side of the middle free (the corridor and the stage), and scatters from `seed`.
 */
export interface StrandShape {
  width: number;
  segments: number;
  clear: number;
  seed: number;
}

export const LIVE_ELEMENTS = {
  /** Tall, broad fronds that frame the vault's sides. */
  kelp: { width: 0.16, segments: 12, clear: 2.6, seed: 101 },
  /** Short, fine blades, closer in to the middle. */
  seagrass: { width: 0.05, segments: 5, clear: 1.4, seed: 211 },
} as const satisfies Record<string, StrandShape>;

export type LiveElementId = keyof typeof LIVE_ELEMENTS;
export const LIVE_ELEMENT_IDS = Object.keys(LIVE_ELEMENTS) as LiveElementId[];
