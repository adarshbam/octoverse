import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MAX_MEDIA, MAX_MEDIA_TOTAL_BYTES, MAX_PROJECTS, MAX_TITLE_LENGTH, mediaBytes, validateDraft } from './draft';
import {
  MEDIA_TOTAL_MESSAGE,
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
import { clip } from './clip';
import './editorFixes.css';
import { FieldIssue } from './FieldIssue';
import { issueFor } from './issueText';
import { LinkField } from './LinkField';
import { useMediaUrls, type MediaApi } from './mediaUrls';
import { ProjectImages } from './ProjectImages';
import { MediaError, sniffBlob } from './storage';
import { TechnologyPicker } from './TechnologyPicker';
import type { CreatorDraft, DraftProject } from './types';

/** How long a deleted project can be brought back (spec 7.13), and how many deleted projects are kept for it, newest first. */
export const UNDO_MS = 5000;
export const UNDO_DEPTH = 3;

interface Deleted {
  project: DraftProject;
  index: number;
  /** When its undo runs out (ms since the epoch): five seconds after ITS delete. */
  expires: number;
}

/** Where focus goes after a change that removes the button it was on (a deleted project, an expired toast): never to the page. */
type FocusTarget = 'add' | 'title' | { row: string };

/**
 * The right glass panel, "Your Projects" (spec 7.13, P4): the project list with add (+), move up and down, and delete with a five
 * second undo; the selected project's title, tagline, description, links, technologies (a searchable picker over the catalog, with a
 * usage note each) and images (local, previewed from object urls); the profile fields in a collapsed section. Validation is inline,
 * per field, and never blocks a save: an untitled project previews as "Untitled project" and a bad link is kept, flagged and not linked.
 * `media` is the browser's image store; without it (server render, tests) images cannot be added.
 */
export function ProjectsPanel({ draft, onChange, media, onSelect }: { draft: CreatorDraft; onChange: (draft: CreatorDraft) => void; media?: MediaApi; onSelect?: (id: string | undefined) => void }) {
  const uid = useId();
  const [selectedId, setSelectedId] = useState(draft.projects[0]?.id);
  const [stack, setStack] = useState<Deleted[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  // One polite line for what happened (added, moved, deleted, back). It is on the page from the start and its text changes, so a screen
  // reader speaks it; a repeat of the same words flips an invisible no-break space so it is spoken again.
  const [live, setLive] = useState({ text: '', n: 0 });
  const announce = (text: string) => setLive(previous => ({ text, n: previous.n + 1 }));
  const [imageError, setImageError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const wantFocus = useRef<{ target: FocusTarget; tries: number } | null>(null);
  // An upload finishes after the draft has moved on: it adds its image to the draft as it is THEN, not as it was when the file was chosen.
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  const project = draft.projects.find(p => p.id === selectedId) ?? draft.projects[0];
  const index = project ? draft.projects.indexOf(project) : -1;
  // The creator's live preview draws the selected project's technologies: it is told which one that is.
  const selectedNow = project?.id;
  useEffect(() => onSelect?.(selectedNow), [onSelect, selectedNow]);
  const issues = useMemo(() => validateDraft(draft), [draft]);
  const urls = useMediaUrls(project ? project.media.map(m => m.id) : [], media?.get);

  // Each deleted project can be brought back for five seconds from ITS delete; one timer waits for the first to run out.
  useEffect(() => {
    if (stack.length === 0) return;
    const wait = Math.max(0, Math.min(...stack.map(d => d.expires)) - Date.now());
    const timer = setTimeout(() => {
      const left = stack.filter(d => d.expires > Date.now());
      // The toast goes with the last of them. If focus was on its Undo button it would fall to the page: it goes to the selected project.
      if (left.length === 0 && toastRef.current?.contains(document.activeElement) && selectedNow !== undefined) wantFocus.current = { target: { row: selectedNow }, tries: 0 };
      setStack(left);
    }, wait);
    return () => clearTimeout(timer);
  }, [stack, selectedNow]);

  useEffect(() => {
    if (problem === null) return;
    const timer = setTimeout(() => setProblem(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [problem]);

  // Moves focus to where a change asked for it, once that element is on the page (a restored project's button appears a render late).
  useEffect(() => {
    const want = wantFocus.current;
    if (want === null) return;
    const target =
      want.target === 'add' ? addRef.current : want.target === 'title' ? titleRef.current : listRef.current?.querySelector<HTMLElement>(`[data-project-id="${CSS.escape(want.target.row)}"]`);
    if (target) {
      wantFocus.current = null;
      target.focus();
    } else if ((want.tries += 1) > 4) wantFocus.current = null;
  });

  const nameOf = (p: DraftProject) => (p.title.trim() === '' ? 'Untitled project' : p.title);
  const edit = (patch: Partial<DraftProject>) => project && onChange(withProject(draft, project.id, patch));

  const add = () => {
    // The ids of projects that can still be brought back are not handed out again.
    const next = addProject(draft, stack.flatMap(d => [d.project.id, d.project.slug]));
    if (next === draft) return;
    onChange(next);
    wantFocus.current = { target: 'title', tries: 0 };
    setSelectedId(next.projects[next.projects.length - 1].id);
    announce('Project added.');
  };

  const move = (direction: 'up' | 'down') => {
    if (!project) return;
    const next = moveProject(draft, project.id, direction);
    if (next === draft) return;
    onChange(next);
    announce(`${clip(nameOf(project))} moved to place ${next.projects.findIndex(p => p.id === project.id) + 1} of ${next.projects.length}.`);
  };

  const remove = () => {
    if (!project) return;
    const out = deleteProject(draft, project.id);
    if (!out) return;
    onChange(out.draft);
    // The Delete button stays, but the project's place does not: focus goes to the project now in that place, or to Add when none is left.
    const nextId = out.draft.projects[Math.min(out.index, out.draft.projects.length - 1)]?.id;
    wantFocus.current = { target: nextId === undefined ? 'add' : { row: nextId }, tries: 0 };
    setSelectedId(nextId);
    setStack(previous => [...previous, { project: out.project, index: out.index, expires: Date.now() + UNDO_MS }].slice(-UNDO_DEPTH));
    setProblem(null);
    announce(`Deleted ${clip(nameOf(out.project))}. Undo is available for 5 seconds.`);
  };

  const undoNow = () => {
    const top = stack[stack.length - 1];
    if (!top) return;
    const next = undoDelete(latest.current, top.project, top.index);
    if (next === latest.current) {
      const message =
        latest.current.projects.length >= MAX_PROJECTS
          ? `The list already has ${MAX_PROJECTS} projects, so ${clip(nameOf(top.project))} cannot come back yet. Delete another project first.`
          : `${clip(nameOf(top.project))} cannot come back: its place in the list is taken.`;
      setProblem(message);
      announce(message);
      return;
    }
    latest.current = next;
    onChange(next);
    setSelectedId(top.project.id);
    wantFocus.current = { target: { row: top.project.id }, tries: 0 };
    setStack(previous => previous.slice(0, -1));
    setProblem(null);
    announce(`${clip(nameOf(top.project))} is back.`);
  };

  const addFiles = async (files: File[]) => {
    if (!media || !project) return;
    const projectId = project.id;
    setImageError(null);
    setAdding(true);
    try {
      for (const file of files) {
        const current = latest.current;
        const here = current.projects.find(p => p.id === projectId);
        if (!here) {
          setImageError('That project is not in the list any more.');
          break;
        }
        if (here.media.length >= MAX_MEDIA) {
          setImageError(`A project has at most ${MAX_MEDIA} images.`);
          break;
        }
        if (mediaBytes(current) + file.size > MAX_MEDIA_TOTAL_BYTES) {
          setImageError(MEDIA_TOTAL_MESSAGE);
          break;
        }
        try {
          const id = await media.put(file);
          // The type is what the bytes say: if that cannot be told, the image is not added (the stored copy is cleaned up by the controller).
          const type = await sniffBlob(file);
          if (type === null) throw new MediaError('bad-type', 'The bytes are not an image.');
          // Chained on the draft as it is now (the next file of this batch starts from this result, even before React has rendered it).
          const next = addMedia(latest.current, projectId, { id, name: file.name.slice(0, 80), type, size: file.size });
          if (next === latest.current) {
            setImageError('That image could not be added to this project.');
            continue;
          }
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
  const titleIssue = project ? issueFor(issues, `projects[${index}].title`, 'Title') : undefined;

  return (
    <section className="oct-glass oct-panel oct-projects-panel" aria-labelledby={`${uid}-title`}>
      <h2 id={`${uid}-title`} className="oct-panel-title">
        Your Projects
      </h2>

      <div className="oct-project-list-row">
        <ul ref={listRef} className="oct-project-list" aria-label="Projects">
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

      {stack.length > 0 ? (
        <div ref={toastRef} className="oct-toast" data-undo-toast>
          <span>
            {`Deleted ${clip(nameOf(stack[stack.length - 1].project))}.${stack.length > 1 ? ` ${stack.length} deleted projects can be brought back, newest first.` : ''}${problem === null ? '' : ` ${problem}`}`}
          </span>
          <button type="button" className="oct-small-button" onClick={undoNow}>
            Undo
          </button>
        </div>
      ) : null}
      <p className="oct-sr-only" role="status" data-panel-live>
        {live.text}
        {live.n % 2 === 1 ? ' ' : ''}
      </p>

      {project ? (
        <div className="oct-project-edit" role="group" aria-label="Selected project">
          <div className="oct-link-field">
            <label className="oct-field">
              Title
              <input ref={titleRef} type="text" value={project.title} maxLength={MAX_TITLE_LENGTH} placeholder="Untitled project" autoComplete="off" aria-describedby={untitled ? `${uid}-untitled` : undefined} onChange={event => edit({ title: event.target.value })} />
            </label>
            {untitled ? (
              <p id={`${uid}-untitled`} className="oct-hint">
                It shows as &quot;Untitled project&quot; until you give it a title.
              </p>
            ) : null}
            <FieldIssue id={`${uid}-title-issue`} text={titleIssue} />
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
