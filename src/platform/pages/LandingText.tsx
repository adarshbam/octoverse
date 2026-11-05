import { useRef } from 'react';
import { useInstanceApi } from '../../engine/host/useInstanceApi';
import { HOST_BUNDLE } from '../../worlds/octoverse/bundle';
import { stageRect } from './geometry';
import { useHostBox, useShift } from './hooks';
import '../ui/glass.css';
import './landing.css';

/** The wordmark: P2's title, spec 7.10. The host project's name, upper case. */
const WORDMARK = HOST_BUNDLE.content.project.name.toUpperCase();
const TAGLINE = HOST_BUNDLE.content.project.tagline;
/** The description is the host project's two lines as one paragraph (they wrapped there by hand; here the box does it). */
const DESCRIPTION = HOST_BUNDLE.content.project.introduction.join(' ');
const PILL = 'Your Ideas. Your Octopus. Your Universe.';

/** P2's frame: the stage square the intro's text is laid out on (5.12 x 5.08 units, the stage's centre at the origin). */
const P2 = [-2.56, 2.54, 2.56, -2.54] as const;

/** How far the intro's content keeps from the window's edges as it follows the face (px). */
const KEEP_ON = 12;

/**
 * Where the intro's content is on screen now: the lines of the wordmark, tagline and description (their text, not their full-width boxes),
 * the buttons and the pill. The block follows the hovering camera, and on a narrow window the camera's drift is wide enough to carry
 * the description off the window's edge, so the block's shift is held to keep this content inside (hooks.ts `useShift`).
 */
function contentOf(el: HTMLElement) {
  const out: DOMRect[] = [];
  const range = document.createRange();
  for (const text of el.querySelectorAll('.oct-wordmark, .oct-tagline, .oct-desc')) {
    range.selectNodeContents(text);
    out.push(range.getBoundingClientRect());
  }
  for (const box of el.querySelectorAll('.oct-actions .oct-button, .oct-pill')) out.push(box.getBoundingClientRect());
  return out;
}

/**
 * The intro (P2) over the live host: the wordmark with its gradient, "Create. Showcase. Belong." and the
 * description beneath it, two glass buttons, and at the bottom the pill (text, not a button). On a
 * desktop or a tablet the block is laid out on the stage as P2 has it (a rectangle of the window, its
 * parts in shares of it, so it keeps its place against the host as the window changes) and follows the
 * face as the camera hovers; on a phone the title sits above the host in the box's top and the buttons
 * and the pill below it (spec 7.15). It fades out when `hidden`.
 */
export function LandingText({ onSeeHow, onCreate, hidden = false }: { onSeeHow: () => void; onCreate: () => void; hidden?: boolean }) {
  const api = useInstanceApi();
  const box = useHostBox();
  const stage = useRef<HTMLDivElement>(null);
  // The block moves as one with the face as the camera hovers, so it keeps its place against it.
  useShift(stage, api, api.faceAnchor, !box.phone, { margin: KEEP_ON, measure: contentOf });
  const place = box.phone ? undefined : stageRect(HOST_BUNDLE.stage.frames.intro, box, P2);
  return (
    <div
      ref={stage}
      className={`oct-intro${hidden ? ' is-hidden' : ''}`}
      data-layout={box.phone ? 'phone' : 'stage'}
      style={place && { left: place.left, top: place.top, width: place.width, height: place.height }}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
    >
      <div className="oct-title-block">
        <h1 className="oct-wordmark">{WORDMARK}</h1>
        <p className="oct-tagline">{TAGLINE}</p>
        <p className="oct-desc">{DESCRIPTION}</p>
      </div>
      <div className="oct-actions">
        <button type="button" className="oct-button oct-button-primary" onClick={onSeeHow}>
          See how it works
        </button>
        <button type="button" className="oct-button" onClick={onCreate}>
          Create yours
        </button>
      </div>
      <p className="oct-pill oct-glass">{PILL}</p>
    </div>
  );
}
