// What the observatory kit holds (public/aether/world/kit.glb, built by blender/aether/build_kit.py):
// the pieces a layout may place, the nodes that are not placed pieces, and the path the layout
// keeps clear. Task 9 names the kit from this list in the world config; layout.test.ts checks the
// file against it.

export const OBSERVATORY_KIT = {
  url: '/aether/world/kit.glb',
  /**
   * Placeable pieces: the portal's arch, four ruin towers, three wall pieces, five floating rubble
   * fragments, five seabed rocks, three magenta coral fans and three small amber corals. The
   * portal's other parts share the arch's frame (`nodes`).
   */
  pieces: [
    'portal_arch',
    'tower_a',
    'tower_b',
    'tower_c',
    'tower_d',
    'wall_a',
    'wall_b',
    'wall_c',
    'rubble_float_a',
    'rubble_float_b',
    'rubble_float_c',
    'rubble_float_d',
    'rubble_float_e',
    'rock_a',
    'rock_b',
    'rock_c',
    'rock_d',
    'rock_e',
    'coral_fan_a',
    'coral_fan_b',
    'coral_fan_c',
    'coral_amber_a',
    'coral_amber_b',
    'coral_amber_c',
  ],
  /**
   * Named nodes that are not placed pieces. The portal's parts share the arch's frame (its origin
   * and orientation), so a world places them with the arch's placement: `portal_steps` leads up to
   * it on the front, `portal_membrane` is the oval in the opening, `portal_glyph` the brain on it
   * (the `'emissive'` prop drive) and `portal_lanterns` the amber beads along the rim.
   */
  nodes: ['portal_steps', 'portal_membrane', 'portal_glyph', 'portal_lanterns'],
} as const;

/** Every portal node, the arch and the four that share its frame. */
export const PORTAL_NODES = ['portal_arch', ...OBSERVATORY_KIT.nodes] as const;

/**
 * TODO (Task 7): the floating rubble should bob. Task 7 adds the `'bob'` prop drive to the engine
 * (src/engine/world/props.ts). After it, add a `rubble_float_*` prop per fragment on `'bob'`
 * (amplitude 0.04, period 7 to 11 s) to the world's `props`. The drive does not exist yet, so
 * `validateWorld` would reject such props: none are declared now.
 */
export const RUBBLE_PIECES = OBSERVATORY_KIT.pieces.filter(piece => piece.startsWith('rubble_float_'));

/** The width of the clear path Aether swims along (stage units). */
export const PATH_WIDTH = 2.4;

/**
 * The path's centre line on the ground plane, as (x, z) points: from the left distance, past the
 * stage spot's back, to the foot of the portal's steps. The lit path of the floor follows it and no
 * kit piece may stand on it (the portal itself ends it).
 */
export const OBSERVATORY_PATH = [
  [-11, -11],
  [-7, -7.2],
  [-3, -4.4],
  [1, -3.6],
  [4.2, -4.8],
  [6.6, -6.7],
  [8.8, -7.3],
  [10.8, -7.4],
] as const;
