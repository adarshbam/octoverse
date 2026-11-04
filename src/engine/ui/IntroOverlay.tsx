import { useRef } from 'react';
import type { Project } from '../content/projectTypes';
import { useInstance } from '../host/instanceContext';
import { useFaceShift } from '../stage/liveAnchors';
import { ExploreNameplate } from './ExploreNameplate';
import { TITLE_ICONS } from './titleIcons';
import './intro.css';

/** Panel 2's title block (with the world's title icon, `theme.titleIcon`) and nameplate, laid out on the square stage; it fades out when `hidden`. */
export function IntroOverlay({ project, onExplore, hidden = false }: { project: Project; onExplore: () => void; hidden?: boolean }) {
  const [first, ...rest] = project.name.split(' ');
  const stage = useRef<HTMLDivElement>(null);
  const TitleIcon = TITLE_ICONS[useInstance().bundle.theme.titleIcon];
  // The title block and nameplate move as one with the face as the camera hovers, so they keep their places against it.
  useFaceShift(stage, 'intro');
  return (
    <div ref={stage} className={`stage${hidden ? ' is-hidden' : ''}`} aria-hidden={hidden}>
      <p className="kicker">OCTOVERSE</p>
      <h1 className="title">
        <TitleIcon />
        <span>
          {first} <span className="lab">{rest.join(' ')}</span>
        </span>
      </h1>
      <p className="tag">{project.tagline}</p>
      <p className="desc">
        {project.introduction.map((line, i) => (
          <span key={i}>
            {line}
            {i < project.introduction.length - 1 && <br />}
          </span>
        ))}
      </p>
      <ExploreNameplate project={project} onExplore={onExplore} disabled={hidden} />
    </div>
  );
}
