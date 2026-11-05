import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MAX_MEDIA, MAX_PROJECTS, validateDraft } from './draft';
import {
  addMedia,
  addProject,
  addTechnology,
  deleteProject,
  mediaErrorMessage,
  moveProject,
  removeMedia,
  removeTechnology,
  sectionBody,
  setLink,
  setSectionBody,
  setUsage,
  undoDelete,
  withProfile,
  withProject,
} from './draftEdits';
import { FieldIssue } from './FieldIssue';
import { issueFor } from './issueText';
import { LinkField } from './LinkField';
import { useMediaUrls, type MediaApi } from './mediaUrls';
import { ProjectImages } from './ProjectImages';
import { sniffBlob } from './storage';
import { TechnologyPicker } from './TechnologyPicker';
import type { CreatorDraft, DraftProject } from './types';

/** How long a deleted project can be brought back (spec 7.13). */
export const UNDO_MS = 5000;

interface UndoState {
  project: DraftProject;
  index: number;
  /** True when the undo was tried and could not put the project back (the list is full): the toast then only says so. */
  failed: boolean;
}

/**
 * The right glass panel, "Your Projects" (spec 7.13, P4): the project list with add (+), move up and down, and delete with a five
 * second undo; the selected project's title, tagline, description, links, technologies (a searchable picker over the catalog, with a
 * usage note each) and images (local, previewed from object urls); the profile fields in a collapsed section. Validation is inline,
 * per field, and never blocks a save: an untitled project previews as "Untitled project" and a bad link is kept, flagged and not linked.
 * `media` is the browser's image store; without it (server render, tests) images cannot be added.
 */
export function ProjectsPanel({ draft, onChange, media }: { draft: CreatorDraft; onChange: (draft: CreatorDraft) => void; media?: MediaApi }) {
  const uid = useId();
  const [selectedId, setSelectedId] = useState(draft.projects[0]?.id);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [note, setNote] = useState('');
  const [imageError, setImageError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const focusTitle = useRef(false);
  // An upload finishes after the draft has moved on: it adds its image to the draft as it is THEN, not as it was when the file was chosen.
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  const project = draft.projects.find(p => p.id === selectedId) ?? draft.projects[0];
  const index = project ? draft.projects.indexOf(project) : -1;
  const addRef = useRef<HTMLButtonElement>(null);
  const focusAdd = useRef(false);
  const issues = useMemo(() => validateDraft(draft), [draft]);
  const urls = useMediaUrls(project ? project.media.map(m => m.id) : [], media?.get);

  // The undo toast lasts five seconds from the last delete; a new delete restarts it, and unmounting stops it.
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  // A project just added: its title field takes focus, so typing can start.
  useEffect(() => {
    if (focusTitle.current) {
      focusTitle.current = false;
      titleRef.current?.focus();
    }
  }, [selectedId]);

  useEffect(() => {
    if (focusAdd.current && draft.projects.length === 0) {
      focusAdd.current = false;
      addRef.current?.focus();
    }
  }, [draft.projects.length]);

  const nameOf = (p: DraftProject) => (p.title.trim() === '' ? 'Untitled project' : p.title);
  const edit = (patch: Partial<DraftProject>) => project && onChange(withProject(draft, project.id, patch));

  const add = () => {
    const next = addProject(draft);
    if (next === draft) return;
    onChange(next);
    focusTitle.current = true;
    setSelectedId(next.projects[next.projects.length - 1].id);
    setNote('Project added.');
  };

  const move = (direction: 'up' | 'down') => {
    if (!project) return;
    const next = moveProject(draft, project.id, direction);
    if (next === draft) return;
    onChange(next);
    setNote(`${nameOf(project)} moved to place ${next.projects.findIndex(p => p.id === project.id) + 1} of ${next.projects.length}.`);
  };

  const remove = () => {
    if (!project) return;
    const out = deleteProject(draft, project.id);
    if (!out) return;
    onChange(out.draft);
    // With none left the actions go away (the focused Delete with them): focus moves to Add.
    focusAdd.current = out.draft.projects.length === 0;
    setSelectedId(out.draft.projects[Math.min(out.index, out.draft.projects.length - 1)]?.id);
    setUndo({ project: out.project, index: out.index, failed: false });
    setNote('');
  };

  const undoNow = () => {
    if (!undo) return;
    const next = undoDelete(latest.current, undo.project, undo.index);
    if (next === latest.current) {
      setUndo({ ...undo, failed: true });
      return;
    }
    onChange(next);
    setSelectedId(undo.project.id);
    setUndo(null);
    setNote(`${nameOf(undo.project)} is back.`);
  };

  const addFiles = async (files: File[]) => {
    if (!media || !project) return;
    const projectId = project.id;
    setImageError(null);
    setAdding(true);
    try {
      for (const file of files) {
        const room = MAX_MEDIA - (latest.current.projects.find(p => p.id === projectId)?.media.length ?? MAX_MEDIA);
        if (room <= 0) {
          setImageError(`A project has at most ${MAX_MEDIA} images.`);
          break;
        }
        try {
          const id = await media.put(file);
          const type = (await sniffBlob(file)) ?? 'image/png';
          // Chained on the draft as it is now (the next file of this batch starts from this result, even before React has rendered it).
          const next = addMedia(latest.current, projectId, { id, name: file.name.slice(0, 80), type, size: file.size });
          latest.current = next;
          onChange(next);
        } catch (error) {
          setImageError(mediaErrorMessage(error));
        }
      }
    } finally {
      setAdding(false);
    }
  };

  const profileIssue = (field: string, label: string) => issueFor(issues, `profile.${field}`, label);
  const handleIssue = profileIssue('handle', 'Handle');
  const profileLinkIssue = profileIssue('link', 'Link');
  const untitled = project !== undefined && project.title.trim() === '';

  return (
    <section className="oct-glass oct-panel oct-projects-panel" aria-labelledby={`${uid}-title`}>
      <h2 id={`${uid}-title`} className="oct-panel-title">
        Your Projects
      </h2>

      <div className="oct-project-list-row">
        <ul className="oct-project-list" aria-label="Projects">
          {draft.projects.map(p => (
            <li key={p.id}>
              <button type="button" data-project-id={p.id} aria-current={p.id === project?.id ? 'true' : undefined} className="oct-project-row" onClick={() => setSelectedId(p.id)}>
                <span className="oct-project-thumb" aria-hidden="true" />
                <span className="oct-project-row-title">{nameOf(p)}</span>
              </button>
            </li>
          ))}
        </ul>
        <button ref={addRef} type="button" aria-label="Add project" className="oct-add" disabled={draft.projects.length >= MAX_PROJECTS} onClick={add}>
          <span aria-hidden="true">+</span>
        </button>
      </div>

      {project ? (
        <div role="group" aria-label="Selected project actions" className="oct-project-actions">
          <button type="button" className="oct-small-button" aria-label="Move project up" aria-disabled={index === 0 ? true : undefined} onClick={() => move('up')}>
            <span aria-hidden="true">↑</span> Up
          </button>
          <button type="button" className="oct-small-button" aria-label="Move project down" aria-disabled={index === draft.projects.length - 1 ? true : undefined} onClick={() => move('down')}>
            <span aria-hidden="true">↓</span> Down
          </button>
          <button type="button" className="oct-small-button oct-small-danger" aria-label="Delete project" onClick={remove}>
            Delete
          </button>
        </div>
      ) : null}

      {undo ? (
        <div className="oct-toast" role="status" data-undo-toast>
          <span>{undo.failed ? 'There is no room to bring it back. Delete another project first.' : `Deleted ${nameOf(undo.project)}.`}</span>
          {undo.failed ? null : (
            <button type="button" className="oct-small-button" onClick={undoNow}>
              Undo
            </button>
          )}
        </div>
      ) : null}
      <p className="oct-sr-only" role="status">
        {note}
      </p>

      {project ? (
        <div className="oct-project-edit" role="group" aria-label="Selected project">
          <div className="oct-link-field">
            <label className="oct-field">
              Title
              <input ref={titleRef} type="text" value={project.title} placeholder="Untitled project" autoComplete="off" aria-describedby={untitled ? `${uid}-untitled` : undefined} onChange={event => edit({ title: event.target.value })} />
            </label>
            {untitled ? (
              <p id={`${uid}-untitled`} className="oct-hint">
                It shows as &quot;Untitled project&quot; until you give it a title.
              </p>
            ) : null}
          </div>
          <label className="oct-field">
            Tagline
            <input type="text" value={project.tagline} placeholder="A short description" autoComplete="off" onChange={event => edit({ tagline: event.target.value })} />
          </label>
          <label className="oct-field">
            Description
            <textarea value={sectionBody(project)} rows={3} placeholder="What it is and what you did" onChange={event => onChange(setSectionBody(draft, project.id, event.target.value))} />
          </label>
          <LinkField label="Live link" value={project.links.live ?? ''} onChange={value => onChange(setLink(draft, project.id, 'live', value))} />
          <LinkField label="Repository" value={project.links.repo ?? ''} onChange={value => onChange(setLink(draft, project.id, 'repo', value))} />
          <TechnologyPicker
            key={project.id}
            chosen={project.technologies}
            usage={project.usage}
            onAdd={id => onChange(addTechnology(draft, project.id, id))}
            onRemove={id => onChange(removeTechnology(draft, project.id, id))}
            onNote={(id, text) => onChange(setUsage(draft, project.id, id, text))}
          />
          <ProjectImages
            key={`${project.id}-images`}
            media={project.media}
            urls={urls}
            canAdd={media !== undefined}
            busy={adding}
            error={imageError}
            onFiles={files => void addFiles(files)}
            onRemove={id => {
              setImageError(null);
              onChange(removeMedia(draft, project.id, id));
            }}
          />
        </div>
      ) : (
        <p className="oct-empty">No projects yet. Add one with the plus button.</p>
      )}

      <details className="oct-profile-fold">
        <summary>
          Profile{handleIssue || profileLinkIssue ? <span className="oct-summary-flag"> · needs a look</span> : null}
        </summary>
        <div className="oct-profile-fields">
          <div className="oct-link-field">
            <label className="oct-field">
              Handle
              <input type="text" value={draft.profile.handle} autoComplete="off" spellCheck={false} aria-invalid={handleIssue ? true : undefined} aria-describedby={handleIssue ? `${uid}-handle-issue` : undefined} onChange={event => onChange(withProfile(draft, { handle: event.target.value }))} />
            </label>
            <FieldIssue id={`${uid}-handle-issue`} text={handleIssue} />
          </div>
          <label className="oct-field">
            Tagline
            <input type="text" value={draft.profile.tagline} autoComplete="off" onChange={event => onChange(withProfile(draft, { tagline: event.target.value }))} />
          </label>
          <label className="oct-field">
            About
            <textarea value={draft.profile.about} rows={3} onChange={event => onChange(withProfile(draft, { about: event.target.value }))} />
          </label>
          <label className="oct-field">
            Location
            <input type="text" value={draft.profile.location ?? ''} autoComplete="off" onChange={event => onChange(withProfile(draft, { location: event.target.value }))} />
          </label>
          <div className="oct-link-field">
            <label className="oct-field">
              Link
              <input type="url" value={draft.profile.link ?? ''} placeholder="https://" autoComplete="off" aria-invalid={profileLinkIssue ? true : undefined} aria-describedby={profileLinkIssue ? `${uid}-plink-issue` : undefined} onChange={event => onChange(withProfile(draft, { link: event.target.value }))} />
            </label>
            <FieldIssue id={`${uid}-plink-issue`} text={profileLinkIssue} />
          </div>
        </div>
      </details>
    </section>
  );
}
