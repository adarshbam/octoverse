import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useInstance } from '../host/instanceContext';
import { useFaceShift } from '../stage/liveAnchors';
import { bubbleDisc } from './OrbButtons';
import './tooltip.css';
import type { TooltipContent } from './tooltipContent';
import { type Disc, type FaceInput, placeTooltip, sheetFits } from './tooltipPlacement';

/**
 * How a technology is used in this project, beside its presented orb (panel 4): the name, the
 * role, the details as bullets (or a one-line summary), and, while developing, a Placeholder badge
 * on storyboard or missing text. It sits beside the orb, clear of Nox's face (placeTooltip), or on
 * a phone held upright along the bottom of the window when that is clear of the face (sheetFits); it
 * fades in with a small rise once the presentation reads (`delayMs`). A tooltip that is `leaving`
 * fades out quickly and is no longer announced. With `follow` (the held bubble's index) the card
 * keeps beside that bubble's live anchor as it moves on from where it was placed (the hold's lift).
 */
export function TechTooltip({ id, content, orb, face, others, delayMs, leaving = false, follow }: { id: string; content: TooltipContent; orb: Disc | null; face: FaceInput; others: readonly Disc[]; delayMs: number; leaving?: boolean; follow?: number }) {
  const instance = useInstance();
  const box = useRef<HTMLDivElement>(null);
  // The tooltip moves as one with the face (it sits beside the presented orb) as the camera hovers.
  useFaceShift(box, 'overview');
  // Where it goes; null for the sheet along the bottom. Measured as a card, which is never shorter
  // than the wider sheet, so a sheet that fits as measured fits as shown.
  const [place, setPlace] = useState<{ left: number; top: number } | null>({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!orb || !box.current) return;
    const { width, height } = box.current.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    setPlace(sheetFits(viewport, face, height) ? null : placeTooltip(orb, { width, height }, face, viewport, others));
  }, [orb, face, others, content]);
  // Beside the held bubble as it moves: offset (as a margin, leaving the anchor's translate and
  // the fade's transform alone) by how far it has moved since the card was placed. A leaving card stays where it is.
  const card = place !== null;
  useEffect(() => {
    const el = box.current;
    if (follow === undefined || follow < 0 || !orb || leaving || !card || !el) return;
    let last = '';
    const apply = () => {
      const now = bubbleDisc(instance, follow);
      if (!now) return;
      const next = `${(now.y - orb.y).toFixed(1)}px 0 0 ${(now.x - orb.x).toFixed(1)}px`;
      if (next === last) return;
      last = next;
      el.style.margin = next;
    };
    apply();
    return instance.bubbleLive.subscribe(apply);
  }, [follow, orb, leaving, card, instance]);
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
