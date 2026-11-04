import type { KitMaterialAssignment } from '../../../engine/world/kitMaterials';
import type { LedParams } from '../../../engine/world/ledMaterial';
import type { MembraneParams } from '../../../engine/world/membraneMaterial';

// What the pipeline kit holds (public/flux/world/kit.glb, built by blender/pipeline/build_kit.py):
// the pieces a layout may place (each also has a `_lod1`), the nodes that are not placed pieces,
// and the corridor the layout keeps clear. The world config names the kit from this list (Task 9);
// kit.test.ts checks the file against it and layout.test.ts the layout.

/** The towers and the rack module: their LED faces are split into `<piece>_led` (R22). */
const LED_OWNERS = ['tower_a', 'tower_b', 'tower_c', 'rack_module'] as const;
type LedNode = `${(typeof LED_OWNERS)[number]}_led`;
export const LED_NODES = LED_OWNERS.map(owner => `${owner}_led` as LedNode);

/**
 * The LEDs' colours as the kit script gives them (build_kit.py LED_COLORS, linear RGB; config.test
 * reads the script to keep them equal): mostly blue and cyan, some violet, a few amber, no red.
 */
export const LED_COLOURS = {
  blue: [0.08, 0.32, 1.0],
  cyan: [0.05, 0.85, 1.0],
  violet: [0.55, 0.22, 1.0],
  amber: [1.0, 0.62, 0.1],
} as const satisfies Record<string, readonly [number, number, number]>;

/** The ring arcs: each is its own piece, so a sequence can light one arc and not the others. */
const ARCS = ['portal_arc_1', 'portal_arc_2', 'portal_arc_3', 'portal_arc_4'] as const;
type InlayNode = `${(typeof ARCS)[number]}_inlay`;
/**
 * Each arc's lit inlay (the strip on the front of its blocks), split off as its own top-level node in
 * the arc's frame (Task 9, as R22 did for the LEDs): the arc stays baked stone, and the inlay takes a
 * kit material of its own, whose emissive a sequence may drive (props, `'emissive'`) without lighting
 * any other piece. The arcs' lod1 has no inlay; the attached inlay stands over both levels.
 */
export const INLAY_NODES = ARCS.map(arc => `${arc}_inlay` as InlayNode);

/** The portal's pieces: built in one frame (the ring's centre is on the plinth's axis), placed with one transform. */
export const PORTAL_PIECES = ['portal_plinth', 'portal_disc', ...ARCS] as const;

/** One bridge segment's pieces: built in one frame (the deck along x, the pier and arch at its middle), placed with one transform. */
export const BRIDGE_PIECES = ['bridge_deck', 'bridge_pier', 'bridge_arch'] as const;

export const PIPELINE_KIT = {
  url: '/flux/world/kit.glb',
  /**
   * Placeable pieces: server towers and a loose rack module (stone; their LEDs are the nodes
   * below), the portal (plinth, glowing disc, four ring arcs a sequence can light one by one), the
   * bridge segment, dark rocks and a coral clump.
   */
  pieces: [...LED_OWNERS, ...PORTAL_PIECES, ...BRIDGE_PIECES, 'rock_a', 'rock_b', 'rock_c', 'coral_a'],
  /**
   * Named nodes that are not placed pieces: the LED faces of each tower and of the rack module,
   * in their piece's frame, carrying a colour (COLOR_0) and a blink phase (`_PHASE`) per light;
   * and each ring arc's inlay. They are their own nodes because the page draws every mesh under a
   * node with that node's material: the stone and the lights of one piece need two.
   */
  nodes: [...LED_NODES, ...INLAY_NODES],
  /** Each LED node stands with every placement of its piece, each inlay with its arc. */
  attached: [
    ...LED_OWNERS.map(piece => ({ node: `${piece}_led` as LedNode, piece })),
    ...ARCS.map(piece => ({ node: `${piece}_inlay` as InlayNode, piece })),
  ],
} as const;

/**
 * The lod1 LED nodes. They are in the file but not drawn: the page draws an attached node at one
 * level only, so the full `<piece>_led` stands over both levels of its piece (the towers' lod1
 * stacks the same modules in the same places, so the lights stay on the face plates).
 */
export const LED_LOD1_NODES = LED_OWNERS.map(owner => `${owner}_lod1_led`);

/** The led kit material on every LED node, all with the same params (the colour is each light's own). */
export function ledMaterials(params: LedParams): KitMaterialAssignment[] {
  return LED_NODES.map(node => ({ node, material: 'led', params }));
}

/**
 * The membrane kit material on every arc inlay, one assignment each (so each is its own material
 * and a drive on one lights that arc alone). The inlays carry no flow map: the membrane reads its
 * second UV set as (0, 0) there, so an inlay glows evenly in its `edge` colour at the drive's level.
 */
export function inlayMaterials(params: MembraneParams): KitMaterialAssignment[] {
  return INLAY_NODES.map(node => ({ node, material: 'membrane', params }));
}

/** The width of the clear corridor Flux swims along (stage units). */
export const CORRIDOR_WIDTH = 2.4;

/**
 * The corridor's centre line on the ground plane, as (x, z) points, from the far left (where he
 * swims in, P1) to the stage spot. No kit piece may stand on it.
 */
export const PIPELINE_CORRIDOR = [
  [-12, 0.6],
  [-6, 0.5],
  [-3, 0.25],
  [0, 0],
] as const;
