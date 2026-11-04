import type { CreatorDraft, DraftProject } from './types';

// Pure edits of a draft: each returns a new draft (the argument is never changed, so the frozen sample stays what it is) with
// `updatedAt` stamped. Validation and storage are Task 18's.

const MAX_PROJECTS = 8;
const stamp = (draft: CreatorDraft): CreatorDraft => ({ ...draft, updatedAt: new Date().toISOString() });

export const withOctopus = (draft: CreatorDraft, patch: Partial<CreatorDraft['octopus']>): CreatorDraft => stamp({ ...draft, octopus: { ...draft.octopus, ...patch } });

export const withProfile = (draft: CreatorDraft, patch: Partial<CreatorDraft['profile']>): CreatorDraft => stamp({ ...draft, profile: { ...draft.profile, ...patch } });

/** Edits one project by id; an unknown id changes nothing. */
export function withProject(draft: CreatorDraft, id: string, patch: Partial<DraftProject>): CreatorDraft {
  if (!draft.projects.some(p => p.id === id)) return draft;
  return stamp({ ...draft, projects: draft.projects.map(p => (p.id === id ? { ...p, ...patch } : p)) });
}

/** Adds an empty project (an untitled one previews as "Untitled project"), up to eight. */
export function addProject(draft: CreatorDraft): CreatorDraft {
  if (draft.projects.length >= MAX_PROJECTS) return draft;
  const taken = new Set(draft.projects.flatMap(p => [p.id, p.slug]));
  let n = draft.projects.length + 1;
  while (taken.has(`project-${n}`)) n++;
  const id = `project-${n}`;
  return stamp({ ...draft, projects: [...draft.projects, { id, slug: id, title: '', tagline: '', sections: [], links: {}, technologies: [], usage: {}, media: [] }] });
}
