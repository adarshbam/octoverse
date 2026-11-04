// The live elements a world may add beyond the six shares (snow, motes, fish, rays, bubbles,
// embers): a closed table, one entry per element (spec 9). Each entry is the element's shape; the
// renderer is the element's module: the shared strand module (Kelp.tsx) for kelp and seagrass,
// live/Jellyfish.tsx for the jellyfish. A world turns one on with `live.elements`.

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

/**
 * The shape of a jellyfish (live/jelly.ts): a bell of `bellSegments` around, and `filaments`
 * trailing filaments of `filamentSegments` rings each, `filamentLength` bell radii long and
 * `filamentWidth` bell radii across. The swarm scatters from `seed`.
 */
export interface JellyShape {
  seed: number;
  bellSegments: number;
  filaments: number;
  filamentSegments: number;
  filamentLength: number;
  filamentWidth: number;
}

/** The strand elements, which the shared strand module draws. */
export const STRAND_ELEMENTS = {
  /** Tall, broad fronds that frame the vault's sides. */
  kelp: { width: 0.16, segments: 12, clear: 2.6, seed: 101 },
  /** Short, fine blades, closer in to the middle. */
  seagrass: { width: 0.05, segments: 5, clear: 1.4, seed: 211 },
} as const satisfies Record<string, StrandShape>;

export const LIVE_ELEMENTS = {
  ...STRAND_ELEMENTS,
  /** Pulsing bells with trailing filaments, drifting slowly up through the mid water (Aether's). */
  jellyfish: { seed: 307, bellSegments: 16, filaments: 8, filamentSegments: 10, filamentLength: 2.4, filamentWidth: 0.05 },
} as const satisfies { [id: string]: StrandShape | JellyShape };

export type LiveElementId = keyof typeof LIVE_ELEMENTS;
export const LIVE_ELEMENT_IDS = Object.keys(LIVE_ELEMENTS) as LiveElementId[];
export type StrandElementId = keyof typeof STRAND_ELEMENTS;
export const STRAND_ELEMENT_IDS = Object.keys(STRAND_ELEMENTS) as StrandElementId[];

/** The most strands one element may carry: a typo in a count must not allocate millions of instances. */
export const MAX_STRANDS = 5000;
/** The most jellyfish a world may draw at any tier (the spec's swarm is 6 to 10 in view). */
export const MAX_JELLYFISH = 64;
