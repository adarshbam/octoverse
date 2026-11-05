import { FLUX_BUNDLE } from '../../../worlds/flux/bundle';
import { makeTemplate } from './make';

// Flux as a creator template (platform spec 7.13). His mantle and arms are jelly glass, so the slots are the jelly's colours.
// Slots (dotted paths into his CharacterConfig):
//   skin.surfaces.mantle.jelly.crown   the dome's cap (crown)
//   skin.surfaces.mantle.jelly.depth   the thick middle facing the viewer (depth)
//   skin.surfaces.mantle.jelly.rim     the silhouette's fresnel edge (rim)
//   skin.surfaces.arms.jelly.crown     the arms' cap (arm top)
//   skin.surfaces.arms.jelly.depth     the arms' body (arm top)
//   skin.surfaces.arms.jelly.rim       the arms' top rim (arm top)
//   glow.halo.color, glow.halo.crown   the outline round the head and arm tops, and over the crown (halo)
// The jelly cores, the cups (palette.sucker*, suckers.style), the face glow, the eyes, mouth and blush are not slots and never move.

/** The face glow: the glow card's core (#feabcf), P2's pink-white face glow (254, 171, 207). His ramp's last stop (#ff98a8) is deliberately pinker, to offset the bloom and the jelly core, so it is not the face. */
const FACE_GLOW_AT = 'glow.core';
/** The upper head the face rule measures against: the mantle's jelly crown, the electric blue (#3044ef) over his head. His depth (#9c57ef) is the violet middle, too light for the rule against a pink-white face (a lightness gap of 22). */
const UPPER_HEAD = 'skin.surfaces.mantle.jelly.crown';

export const FLUX_TEMPLATE = makeTemplate('flux', FLUX_BUNDLE, {
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
