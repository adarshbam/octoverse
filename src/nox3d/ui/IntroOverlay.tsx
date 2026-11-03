import { useId, useRef } from 'react';
import type { Project } from '../content/projectTypes';
import { noxFaceAnchor, useAnchorShift } from '../stage/liveAnchors';
import { ExploreNameplate } from './ExploreNameplate';
import './intro.css';

// The title block and nameplate move as one with Nox's face as the camera hovers, so they keep their
// places against him.
const FACE_ANCHOR = noxFaceAnchor('intro');

function Flame() {
  // Unique to the instance: two on a page would otherwise share an id.
  const gradient = `${useId()}-flame`;
  return (
    <svg viewBox="0 0 40 46" aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff7a5a" />
          <stop offset="1" stopColor="#ff2440" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradient})`}
        d="M20 2c2 8 12 12 12 24a12 12 0 0 1-24 0c0-6 3-9 5-12 0 4 2 7 4 8-1-8 1-14 3-20Zm0 26c-3 3-5 5-5 8a5 5 0 0 0 10 0c0-3-2-5-5-8Z"
      />
    </svg>
  );
}

/** Panel 2's title block and nameplate, laid out on the square stage; it fades out when `hidden`. */
export function IntroOverlay({ project, onExplore, hidden = false }: { project: Project; onExplore: () => void; hidden?: boolean }) {
  const [first, ...rest] = project.name.split(' ');
  const stage = useRef<HTMLDivElement>(null);
  useAnchorShift(stage, FACE_ANCHOR);
  return (
    <div ref={stage} className={`stage${hidden ? ' is-hidden' : ''}`} aria-hidden={hidden}>
      <p className="kicker">OCTOVERSE</p>
      <h1 className="title">
        <Flame />
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
