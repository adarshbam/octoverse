import type { WorldBundle } from '../../engine/types/bundle';
import { resolveLoaded } from './draftController';
import { assembleBundle } from './assembleBundle';
import { draftToContent } from './draftToContent';
import { SAMPLE_DRAFT } from './sampleDraft';
import { TEMPLATES } from './templates';
import type { CreatorDraft } from './types';

// The full draft preview's pure parts (platform spec 7.13, Task 20): which draft and which project the page shows, and the bundle it
// gives the engine. Nothing here reads or writes any storage, the network or the showcase fixtures.

/** The address parameter that carries the creator's selected project to `/create/preview` (the least invasive way: no draft field, no history state). */
export const PROJECT_PARAM = 'project';

/**
 * The draft the preview shows: exactly the creator's rule (draftController `resolveLoaded`). Nothing stored, or the store could not be
 * read (the caller passes null), is the sample draft; a stored value is migrated, and one that is not a draft of this version is the
 * empty draft (the creator shows that too). Never throws.
 */
export function draftOrSample(stored: unknown): CreatorDraft {
  return resolveLoaded(stored, SAMPLE_DRAFT, []);
}

/**
 * The draft the preview shows when the creator handed its draft over (the draft as it is on screen, newer than the store's) or not: the
 * hand-off first, otherwise the stored draft (`draftOrSample`), which is the sample when nothing is stored.
 */
export function previewDraftFrom(handedOff: CreatorDraft | null, stored: unknown): CreatorDraft {
  return handedOff ?? draftOrSample(stored);
}

/** The project the address names (`?project=<id>`), or null. */
export function projectIdFrom(search: string): string | null {
  const id = new URLSearchParams(search).get(PROJECT_PARAM);
  return id === null || id === '' ? null : id;
}

/** The project to show: the one named when the draft has it, otherwise the first; null when the draft has none. */
export function chooseProject(draft: CreatorDraft, wanted: string | null): string | null {
  return (draft.projects.find(p => p.id === wanted) ?? draft.projects[0])?.id ?? null;
}

/** The address the creator's "See live preview" opens for the selected project. */
export function previewHref(projectId: string | null): string {
  return projectId === null ? '/create/preview' : `/create/preview?${new URLSearchParams({ [PROJECT_PARAM]: projectId })}`;
}

/** The ids of the stored images of the project the preview shows (the page reads these blobs). */
export function mediaIdsOf(draft: CreatorDraft, projectId: string | null): string[] {
  return (draft.projects.find(p => p.id === projectId) ?? draft.projects[0])?.media.map(m => m.id) ?? [];
}

/**
 * The template's FULL world with the draft's colours, personality and the chosen project (assembleBundle: a new object, the
 * template's own objects shared and never assigned into). `mediaUrls` maps an image id to a url the page can show (an object url of the
 * stored file); an image that has none (not found in the store) is left out rather than shown broken.
 */
export function previewBundleFor(draft: CreatorDraft, projectId: string | null, mediaUrls: Readonly<Record<string, string>>): WorldBundle {
  const { template, palette, personality, name } = draft.octopus;
  const content = draftToContent(draft, projectId, mediaUrls);
  const media = content.project.media?.filter(m => Object.hasOwn(mediaUrls, m.id));
  return assembleBundle(TEMPLATES[template], { palette, personality, name, handle: draft.profile.handle }, { ...content, project: { ...content.project, media } });
}
