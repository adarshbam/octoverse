import type { WorldBundle } from '../../engine/types/bundle';
import { applyPalette } from './palettes';
import { PERSONALITIES } from './personalities';
import type { CreatorTemplate, PaletteId, PersonalityId, Project, Technology } from './types';

// One creator world bundle (platform spec 7.13, contract amendment A2 P4): a template's world with the creator's palette,
// personality and one project's content. STRICTLY IMMUTABLE: a template's bundle, a personality block and a character are the
// worlds' own objects, shared (applyPalette('original') returns its argument; a moved palette shares every subtree it did not move),
// so nothing here assigns into any of them: every change is a spread into a new object.

const HANDLE_RE = /^[a-z][a-z0-9-]{1,23}$/;
/** The id a bundle gets when the handle is not usable yet (an empty draft still previews): `u-preview`. */
const FALLBACK_HANDLE = 'preview';

export interface BundlePresets {
  palette: PaletteId;
  personality: PersonalityId;
  /** The octopus's name; empty previews as "Your Octopus". */
  name: string;
  /** The profile handle; the bundle id is `u-<handle>`. */
  handle: string;
}

/**
 * The bundle for one project: the template's world, its character in the palette with the personality's motion, the project's
 * content and the bundle id `u-<handle>`. `sequences.projectId` is the template's, so creator bundles share the template's
 * Theatre project. Pure.
 */
export function assembleBundle(template: CreatorTemplate, presets: BundlePresets, content: { project: Project; technologies: readonly Technology[] }): WorldBundle {
  const { bundle } = template;
  const character = applyPalette({ ...bundle.character, personality: PERSONALITIES[presets.personality] }, template, presets.palette);
  const name = presets.name.trim() === '' ? 'Your Octopus' : presets.name.trim();
  const handle = HANDLE_RE.test(presets.handle) ? presets.handle : FALLBACK_HANDLE;
  return {
    ...bundle,
    id: `u-${handle}`,
    character,
    content: { project: content.project, technologies: content.technologies },
    theme: { ...bundle.theme, pageTitle: `${name} · ${content.project.name}` },
  };
}
