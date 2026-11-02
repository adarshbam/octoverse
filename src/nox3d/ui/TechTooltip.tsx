import { useLayoutEffect, useRef, useState } from 'react';
import { noxFaceAnchor, useAnchorShift } from '../stage/liveAnchors';
import './tooltip.css';
import type { TooltipContent } from './tooltipContent';
import { type Disc, type FaceInput, placeTooltip, sheetFits } from './tooltipPlacement';

/**
 * How a technology is used in this project, beside its presented orb (panel 4): the name, the
 * role, the details as bullets (or a one-line summary), and, while developing, a Placeholder badge
 * on storyboard or missing text. It sits beside the orb, clear of Nox's face (placeTooltip), or on
 * a phone held upright along the bottom of the window when that is clear of the face (sheetFits); it
 * fades in with a small rise once the presentation reads (`delayMs`). A tooltip that is `leaving`
 * fades out quickly and is no longer announced.
 */
/** The tooltip moves as one with Nox's face (it sits beside his presented orb) as the camera hovers. */
const TOOLTIP_ANCHOR = noxFaceAnchor('overview');

export function TechTooltip({ id, content, orb, face, others, delayMs, leaving = false }: { id: string; content: TooltipContent; orb: Disc | null; face: FaceInput; others: readonly Disc[]; delayMs: number; leaving?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  useAnchorShift(box, TOOLTIP_ANCHOR);
  // Where it goes; null for the sheet along the bottom. Measured as a card, which is never shorter
  // than the wider sheet, so a sheet that fits as measured fits as shown.
  const [place, setPlace] = useState<{ left: number; top: number } | null>({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!orb || !box.current) return;
    const { width, height } = box.current.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    setPlace(sheetFits(viewport, face, height) ? null : placeTooltip(orb, { width, height }, face, viewport, others));
  }, [orb, face, others, content]);
  if (!orb) return null;
  return (
    <div
      ref={box}
      id={leaving ? undefined : id}
      role={leaving ? undefined : 'tooltip'}
      aria-hidden={leaving || undefined}
      className={`tech-tooltip${place ? '' : ' is-sheet'}${leaving ? ' is-leaving' : ''}`}
      style={{ ...place, animationDelay: leaving ? undefined : `${delayMs}ms` }}
    >
      <div className="tech-tooltip-head">
        <h3>{content.name}</h3>
        {content.badge && <span className="tech-tooltip-badge">Placeholder</span>}
      </div>
      {content.role && <p className="tech-tooltip-role">{content.role}</p>}
      {content.details.length > 0 ? (
        <ul>
          {content.details.map(detail => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : (
        content.summary && <p>{content.summary}</p>
      )}
    </div>
  );
}
