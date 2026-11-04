/** Where bubbles drift: a box of x (width), z (from `z0`, depth `dz`) and y, how many, and their size. */
export interface BubbleField {
  count: number;
  width: number;
  z0: number;
  dz: number;
  top: number;
  bottom: number;
  /** Bubble radius scale. */
  size: number;
}

/** The stage's few bubbles round Nox. */
export const STAGE_BUBBLES: BubbleField = { count: 22, width: 5.2, z0: -1.6, dz: 2.4, top: 2.9, bottom: -2.9, size: 1 };

/** The world's ambient bubbles: drifting up through the water of the whole corridor (they are separate from the technology bubbles). */
export const WORLD_BUBBLES: BubbleField = { count: 70, width: 9, z0: -12, dz: 14, top: 4.2, bottom: -2.4, size: 1.25 };
