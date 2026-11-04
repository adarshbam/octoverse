import type { Project } from '../content/projectTypes';

/** The intro nameplate as the way into the overview: a button that opens Nox's head. */
export function ExploreNameplate({ project, onExplore, disabled = false }: { project: Project; onExplore: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="nameplate nameplate-button"
      aria-label={`${project.characterName}, ${project.characterEpithet}, Explore ${project.name}`}
      tabIndex={disabled ? -1 : 0}
      onClick={onExplore}
    >
      <b>{project.characterName}</b>
      <span>{project.characterEpithet}</span>
    </button>
  );
}
