// What the vault kit holds (public/veyra/world/kit.glb, built by blender/vault/build_kit.py): the
// pieces a layout may place (each also has a `_lod1`), the nodes that are not placed pieces, and
// the corridor the layout keeps clear. The world config names the kit from this list (Task 10);
// layout.test.ts checks the file against it.

export const VAULT_KIT = {
  url: '/veyra/world/kit.glb',
  /** Placeable pieces: the stone portal arch, mossy blocks, a broken wall, steps, dark rocks, orange coral and glowing plants. */
  pieces: [
    'arch',
    'block_a',
    'block_b',
    'block_c',
    'block_d',
    'wall_broken',
    'steps',
    'rock_a',
    'rock_b',
    'rock_c',
    'coral_orange',
    'glowplant_a',
    'glowplant_b',
  ],
  /**
   * Named nodes that are not placed pieces. The portal's parts share the arch's frame (its origin
   * and orientation), so a world places them with the arch's placement: `membrane` is the doorway's
   * plane (two UV sets, the second for the flow), `padlock_body` the lock with its shackle and
   * `padlock_ring` its dial ring, which turns about its own centre (props can name the latter two).
   */
  nodes: ['membrane', 'padlock_body', 'padlock_ring'],
} as const;

/** The width of the clear corridor Veyra swims along (stage units). */
export const CORRIDOR_WIDTH = 2.4;

/**
 * The corridor's centre line on the ground plane, as (x, z) points: from the far left to the stage
 * spot (`path`), then from the stage spot toward the portal's doorway (`approach`). The worn path of
 * the floor follows it and no kit piece may stand on it.
 */
export const VAULT_CORRIDOR = {
  path: [
    [-10, -10],
    [-6.2, -5.4],
    [-3, -1.8],
    [0, 0],
  ],
  approach: [
    [0, 0],
    [1.6, -1.8],
    [3, -5.2],
  ],
} as const;
