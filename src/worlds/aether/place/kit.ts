// What the observatory kit holds (public/aether/world/kit.glb, built by blender/aether/build_kit.py):
// the pieces a layout may place, the nodes that are not placed pieces, and the path the layout
// keeps clear. Task 9 names the kit from this list in the world config; layout.test.ts checks the
// file against it.

import type { WorldProp } from '../../../engine/world/types';

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

export const RUBBLE_PIECES = OBSERVATORY_KIT.pieces.filter(piece => piece.startsWith('rubble_float_'));

/** How far each floating fragment bobs either way (stage units): too small to read as motion at a glance, enough to feel afloat. */
export const RUBBLE_BOB_AMPLITUDE = 0.04;

/** Each fragment's bob period (seconds), 7 to 11, varied so the rubble never moves in step (the engine adds a phase per prop id). */
const RUBBLE_BOB_PERIODS: Record<string, number> = {
  rubble_float_a: 8.2,
  rubble_float_b: 10.4,
  rubble_float_c: 7.4,
  rubble_float_d: 9.3,
  rubble_float_e: 10.9,
};

/**
 * The world's props: the portal's glyph on the `'emissive'` drive, and every floating fragment on
 * `'bob'`. A bob prop moves the placed piece of its `node` name (the engine bobs placed layout
 * pieces only: not corals, not nodes attached to another frame), so each `rubble_float_*` is a
 * piece placed once in layout.json's `rubble` group.
 */
export const OBSERVATORY_PROPS: WorldProp[] = [
  { id: 'portalGlyph', node: 'portal_glyph', drive: 'emissive' },
  ...RUBBLE_PIECES.map(
    (node): WorldProp => ({ id: `${node}Bob`, node, drive: 'bob', bob: { amplitude: RUBBLE_BOB_AMPLITUDE, period: RUBBLE_BOB_PERIODS[node] ?? 9 } }),
  ),
];

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
