import type { WorldBundle } from '../../../engine/types/bundle';
import { getColour } from '../palettes';
import type { ColourSlot, CreatorTemplate, TemplateId } from '../types';

/**
 * A template from its world's bundle (read, never copied): the bundle without its id and its content, the slots a palette may move,
 * the face glow (read from `faceGlowAt` in the bundle's own character: the colour the world approved as its face glow) and the
 * path of the upper-head colour the face rule measures against (one of the slots).
 */
export function makeTemplate(id: TemplateId, world: WorldBundle, parts: { slots: readonly ColourSlot[]; faceGlowAt: ColourSlot; upperHead: ColourSlot }): CreatorTemplate {
  const { id: _worldId, content: _content, ...bundle } = world;
  return { id, bundle, slots: parts.slots, faceGlow: getColour(bundle.character, parts.faceGlowAt), faceGlowAt: parts.faceGlowAt, upperHead: parts.upperHead };
}
