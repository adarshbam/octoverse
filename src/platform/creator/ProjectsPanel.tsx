import { useId, useState } from 'react';
import { Chips } from '../pages/parts';
import { addProject, withProfile, withProject } from './draftEdits';
import { technologyName } from './technologies';
import type { CreatorDraft } from './types';

const MAX_PROJECTS = 8;

/**
 * The right glass panel, "Your Projects" (spec 7.13, P4): the project list with add (+), the selected project's title, tagline,
 * links, technologies and images, and the profile fields in a collapsed section. The technology picker, reorder, delete with undo,
 * section text and image uploads come with the editor (Task 19); here technologies show as chips and images as a placeholder.
 */
export function ProjectsPanel({ draft, onChange }: { draft: CreatorDraft; onChange: (draft: CreatorDraft) => void }) {
  const uid = useId();
  const [selectedId, setSelectedId] = useState(draft.projects[0]?.id);
  const project = draft.projects.find(p => p.id === selectedId) ?? draft.projects[0];
  const setLink = (key: 'live' | 'repo', value: string) => {
    if (!project) return;
    const links = { ...project.links, [key]: value };
    if (value === '') delete links[key];
    onChange(withProject(draft, project.id, { links }));
  };
  const add = () => {
    const next = addProject(draft);
    onChange(next);
    setSelectedId(next.projects[next.projects.length - 1]?.id);
  };
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
                <span className="oct-project-row-title">{p.title === '' ? 'Untitled project' : p.title}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" aria-label="Add project" className="oct-add" disabled={draft.projects.length >= MAX_PROJECTS} onClick={add}>
          <span aria-hidden="true">+</span>
        </button>
      </div>

      {project ? (
        <div className="oct-project-edit" role="group" aria-label="Selected project">
          <label className="oct-field">
            Title
            <input type="text" value={project.title} placeholder="Untitled project" autoComplete="off" onChange={event => onChange(withProject(draft, project.id, { title: event.target.value }))} />
          </label>
          <label className="oct-field">
            Tagline
            <input type="text" value={project.tagline} placeholder="A short description" autoComplete="off" onChange={event => onChange(withProject(draft, project.id, { tagline: event.target.value }))} />
          </label>
          <label className="oct-field">
            Live link
            <input type="url" value={project.links.live ?? ''} placeholder="https://" autoComplete="off" onChange={event => setLink('live', event.target.value)} />
          </label>
          <label className="oct-field">
            Repository
            <input type="url" value={project.links.repo ?? ''} placeholder="https://" autoComplete="off" onChange={event => setLink('repo', event.target.value)} />
          </label>
          <div className="oct-subsection">
            <h3>Technologies</h3>
            {project.technologies.length > 0 ? <Chips names={project.technologies.map(technologyName)} label="Technologies in this project" /> : <p className="oct-empty">None yet</p>}
          </div>
          <div className="oct-subsection">
            <h3>Images</h3>
            <div className="oct-images-empty">No images yet</div>
          </div>
        </div>
      ) : (
        <p className="oct-empty">No projects yet. Add one with the plus button.</p>
      )}

      <details className="oct-profile-fold">
        <summary>Profile</summary>
        <div className="oct-profile-fields">
          <label className="oct-field">
            Handle
            <input type="text" value={draft.profile.handle} autoComplete="off" spellCheck={false} onChange={event => onChange(withProfile(draft, { handle: event.target.value }))} />
          </label>
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
          <label className="oct-field">
            Link
            <input type="url" value={draft.profile.link ?? ''} placeholder="https://" autoComplete="off" onChange={event => onChange(withProfile(draft, { link: event.target.value }))} />
          </label>
        </div>
      </details>
    </section>
  );
}
