import { CATALOG } from './catalog';
import { MAX_MEDIA, MAX_MEDIA_TOTAL_BYTES, MAX_PROJECTS, MAX_TECHNOLOGIES, mediaBytes, parseHttpsUrl } from './draft';
import { MediaError } from './storage';
import type { CreatorDraft, DraftMediaRef, DraftProject } from './types';

// Pure edits of a draft: each returns a new draft (the argument is never changed, so the frozen sample stays what it is) with
// `updatedAt` stamped, or the SAME draft object when the edit does nothing (an unknown id, a full list, an id outside the catalog),
// so a caller can tell. Validation and storage are Task 18's; the editor (ProjectsPanel) is built on these.

const stamp = (draft: CreatorDraft): CreatorDraft => ({ ...draft, updatedAt: new Date().toISOString() });

const CATALOG_IDS: ReadonlySet<string> = new Set(CATALOG.map(t => t.id));

export const withOctopus = (draft: CreatorDraft, patch: Partial<CreatorDraft['octopus']>): CreatorDraft => stamp({ ...draft, octopus: { ...draft.octopus, ...patch } });

export const withProfile = (draft: CreatorDraft, patch: Partial<CreatorDraft['profile']>): CreatorDraft => stamp({ ...draft, profile: { ...draft.profile, ...patch } });

/** Edits one project by id; an unknown id changes nothing. */
export function withProject(draft: CreatorDraft, id: string, patch: Partial<DraftProject>): CreatorDraft {
  if (!draft.projects.some(p => p.id === id)) return draft;
  return stamp({ ...draft, projects: draft.projects.map(p => (p.id === id ? { ...p, ...patch } : p)) });
}

/** `withProject` under the name the editor uses. */
export const updateProject = withProject;

/** Edits one project with a function of it (so a list is read and written in one step); an unknown id changes nothing. */
function editProject(draft: CreatorDraft, id: string, edit: (project: DraftProject) => Partial<DraftProject> | null): CreatorDraft {
  const project = draft.projects.find(p => p.id === id);
  if (!project) return draft;
  const patch = edit(project);
  return patch === null ? draft : withProject(draft, id, patch);
}

/**
 * Adds an empty project (an untitled one previews as "Untitled project"), up to eight. Its id and slug are never one the draft has,
 * nor one in `reserved` (the ids of projects just deleted that can still be brought back: undoing must never find its id taken).
 */
export function addProject(draft: CreatorDraft, reserved: readonly string[] = []): CreatorDraft {
  if (draft.projects.length >= MAX_PROJECTS) return draft;
  const taken = new Set([...draft.projects.flatMap(p => [p.id, p.slug]), ...reserved]);
  let n = draft.projects.length + 1;
  while (taken.has(`project-${n}`)) n++;
  const id = `project-${n}`;
  return stamp({ ...draft, projects: [...draft.projects, { id, slug: id, title: '', tagline: '', sections: [], links: {}, technologies: [], usage: {}, media: [] }] });
}

/** Moves a project one place up or down the list; at an end (or for an unknown id) nothing changes. */
export function moveProject(draft: CreatorDraft, id: string, direction: 'up' | 'down'): CreatorDraft {
  const from = draft.projects.findIndex(p => p.id === id);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= draft.projects.length) return draft;
  const projects = [...draft.projects];
  [projects[from], projects[to]] = [projects[to], projects[from]];
  return stamp({ ...draft, projects });
}

/** `moveProject` under the name the plan uses. */
export const reorderProject = moveProject;

export interface DeletedProject {
  draft: CreatorDraft;
  /** The project that was removed, whole, for `undoDelete`. */
  project: DraftProject;
  /** Where it was in the list. */
  index: number;
}

/** Removes a project and hands back what is needed to undo it (null for an unknown id). */
export function deleteProject(draft: CreatorDraft, id: string): DeletedProject | null {
  const index = draft.projects.findIndex(p => p.id === id);
  if (index < 0) return null;
  const project = draft.projects[index];
  return { draft: stamp({ ...draft, projects: draft.projects.filter(p => p.id !== id) }), project, index };
}

/**
 * Puts a deleted project back at its index (the end, if the list is shorter now). Nothing changes (the same draft comes back) if the
 * list is full, the project (or its id or slug) is already there, or its images would take the draft past 24 MB in all.
 */
export function undoDelete(draft: CreatorDraft, project: DraftProject, index: number): CreatorDraft {
  if (draft.projects.length >= MAX_PROJECTS) return draft;
  if (draft.projects.some(p => p.id === project.id || p.slug === project.slug)) return draft;
  // The images it lists count again (the draft may have gained others since): never past the cap that addMedia keeps.
  if (mediaBytes(draft) + mediaBytes({ ...draft, projects: [project] }) > MAX_MEDIA_TOTAL_BYTES) return draft;
  const projects = [...draft.projects];
  projects.splice(Math.max(0, Math.min(index, projects.length)), 0, project);
  return stamp({ ...draft, projects });
}

// ---------------------------------------------------------------------------------------------
// Technologies
// ---------------------------------------------------------------------------------------------

/** Adds a catalog technology at the end of the project's list (the order added is the order shown). Not one the catalog lacks, not twice, not past 30. */
export function addTechnology(draft: CreatorDraft, projectId: string, techId: string): CreatorDraft {
  return editProject(draft, projectId, project => {
    if (!CATALOG_IDS.has(techId) || project.technologies.includes(techId) || project.technologies.length >= MAX_TECHNOLOGIES) return null;
    return { technologies: [...project.technologies, techId] };
  });
}

/** Removes a technology and its usage note; the rest keep their order. */
export function removeTechnology(draft: CreatorDraft, projectId: string, techId: string): CreatorDraft {
  return editProject(draft, projectId, project => {
    if (!project.technologies.includes(techId)) return null;
    // fromEntries defines own properties: a key like "__proto__" stays a plain key.
    const usage = Object.fromEntries(Object.entries(project.usage).filter(([id]) => id !== techId));
    return { technologies: project.technologies.filter(id => id !== techId), usage };
  });
}

/** The optional usage note of a chosen catalog technology; an empty note removes it. */
export function setUsage(draft: CreatorDraft, projectId: string, techId: string, note: string): CreatorDraft {
  return editProject(draft, projectId, project => {
    if (!CATALOG_IDS.has(techId) || !project.technologies.includes(techId)) return null;
    const others = Object.entries(project.usage).filter(([id]) => id !== techId);
    return { usage: Object.fromEntries(note === '' ? others : [...others, [techId, note]]) };
  });
}

// ---------------------------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------------------------

/** What the editor says next to a link that does not start with https://. The link is kept in the draft and shown as plain text, never linked. */
export const LINK_ISSUE = 'This link must start with https://';

/** Sets a link as typed (an empty value removes it). A bad link is KEPT; `linkIssues` flags it and `safeHref` refuses to link it. */
export function setLink(draft: CreatorDraft, projectId: string, key: 'live' | 'repo', value: string): CreatorDraft {
  return editProject(draft, projectId, project => {
    const { [key]: _previous, ...rest } = project.links;
    return { links: value === '' ? rest : { ...rest, [key]: value } };
  });
}

/** The links of a project that are not https (by key). An empty or missing link has no issue. */
export function linkIssues(links: DraftProject['links']): Partial<Record<'live' | 'repo', string>> {
  const out: Partial<Record<'live' | 'repo', string>> = {};
  for (const key of ['live', 'repo'] as const) {
    const value = links[key];
    if (value !== undefined && value !== '' && parseHttpsUrl(value) === null) out[key] = LINK_ISSUE;
  }
  return out;
}

/** The value to put in an `href`: the PARSED address (`URL.href`, never the raw text) if the value passes the one https rule (draft.ts parseHttpsUrl), otherwise undefined (show it as plain text). */
export function safeHref(value: string | undefined): string | undefined {
  return parseHttpsUrl(value)?.href;
}

// ---------------------------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------------------------

/** The one free-text section of a project in this version of the editor (rendered as "Overview" by draftToContent). */
export const OVERVIEW_SECTION = 'overview';

/** The text of the overview section ('' if there is none). */
export const sectionBody = (project: DraftProject): string => project.sections.find(s => s.id === OVERVIEW_SECTION)?.body ?? '';

/** Sets the overview text; an empty text removes the section. Other sections (from an older draft) are kept. */
export function setSectionBody(draft: CreatorDraft, projectId: string, body: string): CreatorDraft {
  return editProject(draft, projectId, project => {
    const others = project.sections.filter(s => s.id !== OVERVIEW_SECTION);
    return { sections: body === '' ? others : [{ id: OVERVIEW_SECTION, body }, ...others] };
  });
}

// ---------------------------------------------------------------------------------------------
// Media (metadata only: the blob is the store's, putMedia)
// ---------------------------------------------------------------------------------------------

/** Adds an image reference (up to four a project, 24 MB for the draft, no id twice). The blob is already in the store: this only lists it. */
export function addMedia(draft: CreatorDraft, projectId: string, media: DraftMediaRef): CreatorDraft {
  return editProject(draft, projectId, project => {
    if (project.media.length >= MAX_MEDIA || project.media.some(m => m.id === media.id)) return null;
    if (mediaBytes(draft) + media.size > MAX_MEDIA_TOTAL_BYTES) return null;
    return { media: [...project.media, media] };
  });
}

export function removeMedia(draft: CreatorDraft, projectId: string, mediaId: string): CreatorDraft {
  return editProject(draft, projectId, project => (project.media.some(m => m.id === mediaId) ? { media: project.media.filter(m => m.id !== mediaId) } : null));
}

/** What the editor says when adding an image would take the draft past 24 MB of images in all. */
export const MEDIA_TOTAL_MESSAGE = 'A draft keeps at most 24 MB of images in all. Remove one to add another.';

/** What the editor says when the store refuses an image (storage.ts MediaError), in plain words. */
export function mediaErrorMessage(error: unknown): string {
  if (error instanceof MediaError) {
    if (error.code === 'too-large') return 'That image is over 2 MB. Pick a smaller one.';
    if (error.code === 'bad-type') return 'Images must be PNG, JPEG or WebP.';
    return 'That file could not be read. Try another image.';
  }
  return 'That image could not be added. Try again.';
}
