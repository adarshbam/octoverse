import { VEYRA_BUNDLE } from '../../../worlds/veyra/bundle';
import { makeTemplate } from './make';

// Veyra as a creator template (platform spec 7.13). Her mantle and arms are jelly glass, so the slots are the jelly's colours.
// Slots (dotted paths into her CharacterConfig):
//   skin.surfaces.mantle.jelly.crown   the dome's cap (crown)
//   skin.surfaces.mantle.jelly.depth   the thick middle facing the viewer (depth)
//   skin.surfaces.mantle.jelly.rim     the silhouette's fresnel edge (rim)
//   skin.surfaces.arms.jelly.crown     the arms' cap (arm top)
//   skin.surfaces.arms.jelly.depth     the arms' body (arm top)
//   skin.surfaces.arms.jelly.rim       the arms' top rim (arm top)
//   glow.halo.color, glow.halo.crown   the outline round the head and arm tops, and over the crown (halo)
// The jelly cores, the cups (palette.sucker*, suckers.style), the face glow, the eyes, mouth and blush are not slots and never move.

/** The face glow: the glow ramp's last stop (#f8e497), the cream-yellow heart of her face glow (her glow card's core, #f0eca0, is the same cream). */
const FACE_GLOW_AT = 'glow.ramp.9.1';
/** The upper head the face rule measures against: the mantle's jelly depth, the dark see-through teal (#015f67) the dome shows face-on round the eyes. Her crown cap (#04b4c8) is lighter than the face rule allows against a cream face (a lightness gap of 21, under 30), so it is not the upper head the rule measures. */
const UPPER_HEAD = 'skin.surfaces.mantle.jelly.depth';

export const VEYRA_TEMPLATE = makeTemplate('veyra', VEYRA_BUNDLE, {
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
