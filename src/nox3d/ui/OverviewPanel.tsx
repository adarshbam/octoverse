import { useRef } from 'react';
import type { StageEvent } from '../behavior/stageMachine';
import type { Project } from '../content/projectTypes';
import './overview.css';
import { noxFaceAnchor, useAnchorShift } from '../stage/liveAnchors';
import { useStageBox } from './useStageBox';

/** The dome's inner rectangle, traced in world units from the high-quality panel 3. */
export const DOME_PANEL_BOX = [-1.22, 1.14, 1.33, 0.06] as const;

/** The panel moves as one with Nox's face, so it keeps its place in the dome as the camera hovers. */
const FACE_ANCHOR = noxFaceAnchor('overview');

export function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  );
}

export function OpenMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5v3.2a.8.8 0 0 1-.8.8H3.3a.8.8 0 0 1-.8-.8V4.8a.8.8 0 0 1 .8-.8h3.2" />
    </svg>
  );
}

/**
 * The project panel inside the overview dome (panel 3): preview, title, short text, and the two
 * actions. It is placed on the dome's traced inner rectangle and fades in as the head opens.
 */
export function OverviewPanel({ project, open, dispatch }: { project: Project; open: boolean; dispatch: (event: StageEvent) => void }) {
  const box = useStageBox('overview', DOME_PANEL_BOX);
  const panel = useRef<HTMLElement>(null);
  useAnchorShift(panel, FACE_ANCHOR);
  const preview = project.media?.find(item => item.type === 'screenshot');
  const github = project.links?.find(link => link.kind === 'github');
  return (
    <section
      ref={panel}
      className={`overview-panel${open ? ' is-open' : ''}`}
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
      aria-label={`${project.name} overview`}
      aria-hidden={!open}
    >
      {preview && <img className="overview-preview" src={preview.previewUrl ?? preview.url} alt={preview.alt} />}
      <div className="overview-copy">
        <h2>{project.name}</h2>
        {project.summary && <p>{project.summary}</p>}
      </div>
      <div className="overview-actions">
        <button type="button" className="overview-view" tabIndex={open ? 0 : -1} onClick={() => dispatch({ type: 'OPEN_DETAIL' })}>
          View Project <OpenMark />
        </button>
        {github && (
          <a className="overview-github" href={github.url} target="_blank" rel="noopener" tabIndex={open ? 0 : -1}>
            <GitHubMark /> {github.label}
          </a>
        )}
      </div>
    </section>
  );
}
