import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { logoColour, logoIcon } from '../artifacts/logoTexture';
import type { StageEvent } from '../../engine/behavior/stageMachine';
import type { Project, Technology } from '../content/projectTypes';
import { layoutFor } from '../stage/framing';
import './detail.css';
import { GitHubMark, OpenMark } from './OverviewPanel';
import { DETAIL_PANEL_BOX, detailPages, detailTechnologies, featureCards, overviewText, safeHref } from './detailContent';
import { useStageBox } from './useStageBox';

/** The project's mark in the header: panel 5's shield with a keyhole. */
function ShieldMark() {
  return (
    <svg className="detail-mark" viewBox="0 0 32 36" aria-hidden="true">
      <path d="M16 2.5 28.5 7.2v9.6c0 8-5.6 13.8-12.5 16.7C9.1 30.6 3.5 24.8 3.5 16.8V7.2Z" fill="rgba(255, 59, 92, 0.12)" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="16" cy="15.2" r="3.3" fill="currentColor" />
      <path d="M14.4 17.6h3.2l1 6.4h-5.2Z" fill="currentColor" />
    </svg>
  );
}

/** Generic marks for the key feature cards, taken in turn. */
const FEATURE_MARKS = [
  <path key="app" d="M4 11.5 12 4.5l8 7V20H4ZM12 10.5v4M12 17.2v.3" />,
  <path key="lab" d="M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM12 2v5M12 17v5M2 12h5M17 12h5" />,
  <path key="writeup" d="M7 3h7l4 4v14H7ZM14 3v4h4M10 12h5M10 16h5" />,
  <path key="tools" d="M14.7 6.3a4 4 0 0 0 4.9 5L11 19.9a2.1 2.1 0 0 1-3-3l8.6-8.6a4 4 0 0 0-1.9-1.9ZM4 5l4.5 4.5M3 8l3-3" />,
];

function Badge() {
  return <span className="detail-badge">Placeholder</span>;
}

/** Arrows for the screenshot carousel. */
function Arrow({ back }: { back?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" d={back ? 'M13 8H3.5M7.5 3.5 3 8l4.5 4.5' : 'M3 8h9.5M8.5 3.5 13 8l-4.5 4.5'} />
    </svg>
  );
}

const portraitPhone = () => layoutFor({ width: window.innerWidth, height: window.innerHeight }) === 'phone' && window.innerHeight > window.innerWidth;
/** Narrower than this where panel 5 places it, the panel is too small to read. */
const MIN_PANEL_WIDTH = 640;

/**
 * The full project view (panel 5): a large panel on the right, placed on the panel traced from
 * the high-quality panel 5, while Nox rests at the left edge. It holds the section list (sections
 * with something in them), the screenshot carousel, the section's text, Live Demo and GitHub, the
 * technology chips and the key feature cards. Its close button, like Escape, returns to the
 * overview. Storyboard text shows, badged, only while developing. Where panel 5's place would be
 * too small to read, it is a sheet instead: along the bottom on a phone held upright, down the
 * right side otherwise, clear of Nox.
 */
export function ProjectDetail({ project, technologies, open, showPlaceholders, forceSheet = false, panelId, dispatch }: {
  project: Project;
  technologies: readonly Technology[];
  open: boolean;
  showPlaceholders: boolean;
  /** A sheet whatever the window (without WebGL there is no stage to place the panel on). */
  forceSheet?: boolean;
  /** The panel's id, which the instance's skip link goes to (unique to the instance). */
  panelId: string;
  dispatch: (event: StageEvent) => void;
}) {
  const id = useId();
  const box = useStageBox('detail', DETAIL_PANEL_BOX);
  const sheet = forceSheet || portraitPhone() || box.width < MIN_PANEL_WIDTH;
  const side = sheet && !portraitPhone();
  const pages = detailPages(project, showPlaceholders);
  const [pageId, setPageId] = useState('overview');
  const page = pages.find(item => item.id === pageId) ?? pages[0];
  const media = (project.media ?? []).filter(item => item.type !== 'video');
  const [shot, setShot] = useState(0);
  const shown = media[Math.min(shot, media.length - 1)];
  const overview = overviewText(project, showPlaceholders);
  const cards = featureCards(project, showPlaceholders);
  const cardsPlaceholder = Boolean(project.sections?.find(section => section.id === 'features')?.placeholder);
  const chips = detailTechnologies(project, technologies);
  const links = (project.links ?? []).flatMap(link => {
    const href = safeHref(link.url);
    return href ? [{ ...link, href }] : [];
  });
  const live = links.find(link => link.kind === 'live');
  const github = links.find(link => link.kind === 'github');

  // Opening moves focus to the project's name; closing gives it back to what opened the view.
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    if (open) {
      opener.current = document.activeElement;
      heading.current?.focus({ preventScroll: true });
    } else if (opener.current instanceof HTMLElement && opener.current.isConnected) {
      opener.current.focus({ preventScroll: true });
      opener.current = null;
    }
  }, [open]);

  // Text longer than its room fades out at the bottom, so it reads as more to scroll, not cut off.
  const text = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    const element = text.current;
    if (!element) return;
    const measure = () => setOverflowing(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // The web font can land after the first measure and change the text's height.
    document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [page.id, project]);

  const section = page.section;
  return (
    <section
      id={panelId}
      className={`project-detail${open ? ' is-open' : ''}${sheet ? ' is-sheet' : ''}${side ? ' is-side' : ''}`}
      style={sheet ? undefined : { left: box.left, top: box.top, width: box.width, height: box.height }}
      aria-label={`${project.name} full project view`}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="detail-inner">
        <header className="detail-header">
          <ShieldMark />
          <div className="detail-identity">
            <h1 ref={heading} tabIndex={-1}>{project.name}</h1>
            {project.tagline && <p>{project.tagline}</p>}
          </div>
          {/* As a sheet, the view counts screenshots only when there is more than one. */}
          {media.length > (sheet ? 1 : 0) && (
            <div className="detail-carousel" role="group" aria-label="Screenshots">
              <button type="button" aria-label="Previous screenshot" disabled={shot <= 0} onClick={() => setShot(shot - 1)}>
                <Arrow back />
              </button>
              <span aria-live="polite">{Math.min(shot, media.length - 1) + 1} / {media.length}</span>
              <button type="button" aria-label="Next screenshot" disabled={shot >= media.length - 1} onClick={() => setShot(shot + 1)}>
                <Arrow />
              </button>
            </div>
          )}
          <button type="button" className="detail-close" aria-label="Close project view" onClick={() => dispatch({ type: 'CLOSE' })}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>
        <div className={`detail-body${pages.length > 1 ? ' has-sections' : ''}`}>
          {pages.length > 1 && (
            <nav className="detail-sections" aria-label="Project sections">
              {pages.map(item => (
                <button key={item.id} type="button" aria-current={item.id === page.id ? 'page' : undefined} aria-controls={`${id}-text`} onClick={() => setPageId(item.id)}>
                  <span>{item.title}</span>
                </button>
              ))}
            </nav>
          )}
          <figure className="detail-shot">
            {shown ? <img src={shown.url} alt={shown.alt} /> : <figcaption>No screenshots yet</figcaption>}
          </figure>
          <div className="detail-copy">
            <h2>
              {section ? section.title : 'Project Overview'}
              {(section ? section.placeholder : overview.placeholder) && <Badge />}
            </h2>
            <div
              ref={text}
              id={`${id}-text`}
              className={`detail-text${overflowing ? ' is-overflowing' : ''}`}
              role="region"
              aria-label={section ? section.title : 'Project overview'}
              tabIndex={0}
            >
              {section ? (
                <>
                  {section.summary?.trim() && <p>{section.summary}</p>}
                  {section.content?.trim() && <p>{section.content}</p>}
                  {section.items?.some(item => item.trim()) && (
                    <ul>
                      {section.items.filter(item => item.trim()).map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  )}
                </>
              ) : (
                <p>{overview.text}</p>
              )}
            </div>
            {(live || github) && (
              <div className="detail-links">
                {live && (
                  <a className="detail-live" href={live.href} target="_blank" rel="noopener noreferrer">
                    {live.label} <OpenMark />
                  </a>
                )}
                {github && (
                  <a className="detail-github" href={github.href} target="_blank" rel="noopener noreferrer">
                    <GitHubMark /> {github.label}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
        {chips.length > 0 && (
          <section className="detail-stack" aria-labelledby={`${id}-stack`}>
            <h2 id={`${id}-stack`}>Tech Stack</h2>
            <ul>
              {chips.map(technology => {
                const icon = logoIcon(technology.iconKey);
                return (
                  <li key={technology.id}>
                    {icon && (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path fill={logoColour(technology.iconKey)} d={icon.path} />
                      </svg>
                    )}
                    {technology.name}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {cards.length > 0 && (
          <section className="detail-features" aria-labelledby={`${id}-features`}>
            <h2 id={`${id}-features`}>
              Key Features {cardsPlaceholder && <Badge />}
            </h2>
            <ul>
              {cards.map((card, i) => (
                <li key={`${i}-${card.title}`}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    {FEATURE_MARKS[i % FEATURE_MARKS.length]}
                  </svg>
                  <div>
                    <h3>{card.title}</h3>
                    {card.text && <p>{card.text}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </section>
  );
}
