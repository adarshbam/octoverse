import { useLayoutEffect, useRef, useState } from 'react';
import type { ProjectTechnologyUsage } from '../content/projectTypes';
import './tooltip.css';
import { placeTooltip } from './tooltipPlacement';

/**
 * How a technology is used in this project, beside its presented orb (panel 4): the name, the
 * role, the details as bullets (or a one-line summary), and a "Placeholder" badge while the text
 * is storyboard copy. It sits beside the orb on the side away from Nox's face (placeTooltip).
 */
export function TechTooltip({ id, name, usage, orb, face }: { id: string; name: string; usage?: ProjectTechnologyUsage; orb: { x: number; y: number; size: number } | null; face: { x: number; y: number } }) {
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!orb || !box.current) return;
    const { width, height } = box.current.getBoundingClientRect();
    setPlace(placeTooltip(orb, { width, height }, face, { width: window.innerWidth, height: window.innerHeight }));
  }, [orb, face, name, usage]);
  if (!orb) return null;
  return (
    <div ref={box} id={id} role="tooltip" className="tech-tooltip" style={place}>
      <div className="tech-tooltip-head">
        <h3>{name}</h3>
        {usage?.placeholder && <span className="tech-tooltip-badge">Placeholder</span>}
      </div>
      {usage?.role && <p className="tech-tooltip-role">{usage.role}</p>}
      {usage?.details?.length ? (
        <ul>
          {usage.details.map(detail => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : (
        usage?.summary && <p>{usage.summary}</p>
      )}
    </div>
  );
}
