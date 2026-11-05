import { NOX_BUNDLE } from '../../../worlds/nox/bundle';
import { makeTemplate } from './make';

// Nox as a creator template (platform spec 7.13). His skin is Nox's living `'skin'`, not jelly (he has no `skin.surfaces`), so his
// body colours are the palette's own fields. Slots (the colours a palette may move, dotted paths into his CharacterConfig):
//   palette.headEdge   the head's violet body (the "depth" slot; also the upper head the face rule measures against)
//   palette.rimTop     the thin top rim over the head and arms (the "rim" slot)
//   palette.armBody    the arms' deep blue-violet top (the "arm top" slot)
//   glow.halo.color    the soft outline round the head and the arm tops (the "halo" slot)
//   glow.halo.crown    the same outline over the crown (the "crown" slot)
// The red undersides, the cups, the glow ramp and card, the eyes, mouth and blush are not slots and never move.

/** The face glow: the glow ramp's last stop, the colour at the glow's core strength (#ff8765), the warm peach-coral between his eyes. */
const FACE_GLOW_AT = 'glow.ramp.9.1';
/** The upper head the face rule measures against: the violet head (#5c148c), the "depth" slot. */
const UPPER_HEAD = 'palette.headEdge';

export const NOX_TEMPLATE = makeTemplate('nox', NOX_BUNDLE, {
  slots: ['palette.headEdge', 'palette.rimTop', 'palette.armBody', 'glow.halo.color', 'glow.halo.crown'],
  faceGlowAt: FACE_GLOW_AT,
  upperHead: UPPER_HEAD,
});
