// The live elements a world may add beyond the six shares (snow, motes, fish, rays, bubbles,
// embers): a closed table, one entry per element (spec 9). Each entry is the element's shape; the
// renderer is the shared strand module (Kelp.tsx) for the strands, Packets.tsx for the packets. A world
// turns one on with `live.elements`.

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
 * The shape of the packets element: at most `max` of them (one instanced mesh), each `width` stage
 * units across. Where they run, how many, how fast and in what colours is the world's config.
 */
export interface PacketShape {
  max: number;
  width: number;
}

export const LIVE_ELEMENTS = {
  /** Tall, broad fronds that frame the vault's sides. */
  kelp: { width: 0.16, segments: 12, clear: 2.6, seed: 101 },
  /** Short, fine blades, closer in to the middle. */
  seagrass: { width: 0.05, segments: 5, clear: 1.4, seed: 211 },
  /** Packets of light running along a path of the layout (packets.ts, Packets.tsx): Flux's data on its bridge. */
  packets: { max: 12, width: 0.07 },
} as const satisfies { kelp: StrandShape; seagrass: StrandShape; packets: PacketShape };

export type LiveElementId = keyof typeof LIVE_ELEMENTS;
export const LIVE_ELEMENT_IDS = Object.keys(LIVE_ELEMENTS) as LiveElementId[];

/** The elements that are strands (Kelp.tsx draws them), as against the packets. */
export type StrandElementId = Exclude<LiveElementId, 'packets'>;
export const STRAND_ELEMENT_IDS = ['kelp', 'seagrass'] as const satisfies readonly StrandElementId[];

/** The most strands one element may carry: a typo in a count must not allocate millions of instances. */
export const MAX_STRANDS = 5000;

/** The most packets one world may run: the instanced mesh is sized for this many. */
export const MAX_PACKETS = LIVE_ELEMENTS.packets.max;
