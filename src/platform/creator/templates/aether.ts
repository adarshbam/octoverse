import { AETHER_BUNDLE } from '../../../worlds/aether/bundle';
import { makeTemplate } from './make';

// Aether as a creator template (platform spec 7.13). Her mantle and arms are jelly glass, so the slots are the jelly's colours.
// Slots (dotted paths into her CharacterConfig):
//   skin.surfaces.mantle.jelly.crown   the dome's cap (crown)
//   skin.surfaces.mantle.jelly.depth   the thick middle facing the viewer (depth)
//   skin.surfaces.mantle.jelly.rim     the silhouette's fresnel edge (rim)
//   skin.surfaces.arms.jelly.crown     the arms' cap (arm top)
//   skin.surfaces.arms.jelly.depth     the arms' body (arm top)
//   skin.surfaces.arms.jelly.rim       the arms' top rim (arm top)
//   glow.halo.color, glow.halo.crown   the outline round the head and arm tops, and over the crown (halo)
// The jelly cores, the cups (palette.sucker*, suckers.style), the face glow, the eyes, mouth and blush are not slots and never move.

/** The face glow: the glow ramp's last stop (#fdd2ec), her pink-white face glow (P2: 253, 212, 232). Her glow card's core is kept dim on purpose, so it is not the face. */
const FACE_GLOW_AT = 'glow.ramp.7.1';
/** The upper head the face rule measures against: the mantle's jelly depth, the deep blue-violet (#5b4ef3, P2's upper dome 91, 78, 243) where the dome faces the viewer. Her crown cap (#a0bafc) is a blue-white sheen, too close to a pink-white face for the rule. */
const UPPER_HEAD = 'skin.surfaces.mantle.jelly.depth';

export const AETHER_TEMPLATE = makeTemplate('aether', AETHER_BUNDLE, {
  slots: [
    'skin.surfaces.mantle.jelly.crown',
    'skin.surfaces.mantle.jelly.depth',
    'skin.surfaces.mantle.jelly.rim',
    'skin.surfaces.arms.jelly.crown',
    'skin.surfaces.arms.jelly.depth',
    'skin.surfaces.arms.jelly.rim',
    'glow.halo.color',
    'glow.halo.crown',
  ],
  faceGlowAt: FACE_GLOW_AT,
  upperHead: UPPER_HEAD,
});
