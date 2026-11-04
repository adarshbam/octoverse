// What the reef kit holds (public/octoverse/world/reef/kit.glb, built by blender/reef/build_kit.py,
// which writes the same lists to kit.nodes.json beside it; config.test checks the two agree): the
// pieces a layout may place (each also has a `_lod1`) and the gate's nodes that are not placed
// pieces. The gate's nodes share the arch's frame, so the world attaches them to `gate_arch`.

const CARDS = ['card_glass_01', 'card_glass_02', 'card_glass_03', 'card_glass_04', 'card_glass_05', 'card_glass_06', 'card_glass_07', 'card_glass_08'] as const;

export const REEF_KIT = {
  url: '/octoverse/world/reef/kit.glb',
  /** Placeable pieces: the gateway's arch, dark rocks, magenta and orange coral, and the glass cards. */
  pieces: ['gate_arch', 'rock_a', 'rock_b', 'rock_c', 'rock_d', 'coral_magenta_a', 'coral_magenta_b', 'coral_magenta_c', 'coral_orange_a', 'coral_orange_b', ...CARDS],
  /** The gate's parts in the arch's frame: the ember windows, the doorway's membrane (two UV sets) and the octopus glyph. */
  nodes: ['gate_windows', 'gate_membrane', 'gate_glyph'],
} as const;

export const REEF_CARDS: readonly string[] = CARDS;
export const REEF_MAGENTA_CORALS: readonly string[] = REEF_KIT.pieces.filter(p => p.startsWith('coral_magenta_'));
