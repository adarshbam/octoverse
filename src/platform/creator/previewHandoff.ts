import type { CreatorDraft } from './types';

// The creator's hand-off to its full preview (platform spec 7.13, Task 20 fix round): pressing "See live preview" leaves the draft AS IT IS ON
// SCREEN in a module-level slot, because two things are not in the browser's store yet at that moment:
//   1. an edit made less than 800 ms ago (the autosave has not run; the creator saves it when it unmounts, but that races the preview's read), and
//   2. everything, when the browser cannot keep drafts (IndexedDB blocked: the draft and its images live in the creator's memory only).
// The preview takes it with `peekHandoff`, shows it, and clears it with `clearHandoff` once it has been read. With nothing handed off (a
// pasted link, a reload, a new tab, a stale hand-off) the preview reads the stored draft, then the sample. Nothing here touches any storage.

/** A hand-off older than this is stale (the visitor did not arrive at the preview from that press) and is ignored. */
export const HANDOFF_TTL_MS = 30_000;

export interface Handoff {
  draft: CreatorDraft;
  /** The project the visitor was looking at (null: none). */
  project: string | null;
  /** The stored images of that project, ALREADY being read (the creator's store closes when it unmounts, so the reads start now). */
  media: Readonly<Record<string, Promise<Blob | null>>>;
  at: number;
}

let held: Handoff | null = null;

/** Leaves the draft on screen for the preview. `getMedia` is the creator's media reader (its store); the images' reads start now. */
export function handOff(draft: CreatorDraft, project: string | null, getMedia: ((id: string) => Promise<Blob | null>) | undefined, now = Date.now()): void {
  const chosen = draft.projects.find(p => p.id === project) ?? draft.projects[0];
  const media: Record<string, Promise<Blob | null>> = {};
  for (const image of chosen?.media ?? []) media[image.id] = getMedia ? getMedia(image.id).catch(() => null) : Promise.resolve(null);
  held = { draft, project, media, at: now };
}

/** The hand-off, if there is a fresh one; it stays until `clearHandoff` (a development double effect reads it twice). */
export function peekHandoff(now = Date.now()): Handoff | null {
  if (held !== null && now - held.at > HANDOFF_TTL_MS) held = null;
  return held;
}

/** The hand-off has been used. */
export function clearHandoff(): void {
  held = null;
}
