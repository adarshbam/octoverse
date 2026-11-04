import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LinkStage } from '../../engine/behavior/stageMachine';
import { parseUrlState } from '../../engine/behavior/urlState';
import { WorldHost } from '../../engine/host/WorldHost';
import { useInstanceApi } from '../../engine/host/useInstanceApi';
import { HOST_BUNDLE } from '../../worlds/octoverse/bundle';
import { goBack, navigate } from '../router/history';
import { HowItWorks } from './HowItWorks';
import { LandingText } from './LandingText';
import { Nav } from './Nav';
import { faceRects } from './geometry';
import { useHostBox } from './hooks';
import '../ui/glass.css';
import './landing.css';

declare global {
  interface Window {
    /** Development only: what the platform reports about the page for the end-to-end specs (the host's face rectangles on screen). */
    __platform?: { faceRect?: { eyes: Rect[]; mouth: Rect }; route?: string };
  }
}
interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The history entry of How It Works that the intro's button pushed says so (it survives a reload, Back and Forward). */
const FROM_INTRO = { octFromIntro: true };

/** Opens How It Works from the intro: a new history entry, marked as the intro's. */
function openHowItWorks() {
  navigate('/how-it-works');
  window.history.replaceState(FROM_INTRO, '');
}

/** Leaves How It Works for the intro: one step back when the intro is the entry before, otherwise the intro replaces it (a link or a reload landed here). */
function leaveHowItWorks() {
  if ((window.history.state as typeof FROM_INTRO | null)?.octFromIntro) goBack();
  else navigate('/', { replace: true });
}

/**
 * Writes the host's eye and mouth rectangles on screen to `window.__platform.faceRect` each frame
 * (development builds only): the face layout at the face anchor, turned and scaled with the pose, in
 * the host box, plus the live camera's shift of the anchor.
 */
function FaceProbe() {
  const api = useInstanceApi();
  const box = useHostBox();
  const at = useRef({ api, box });
  useEffect(() => {
    at.current = { api, box };
  });
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let frame = 0;
    const tick = () => {
      const { api: now, box: size } = at.current;
      // A technology focus or the detail keep the overview's face; the entrance lands in the intro's.
      const stage = now.stage === 'intro' || now.stage === 'entering' ? 'intro' : 'overview';
      const rects = faceRects(HOST_BUNDLE.stage.frames[stage], size, HOST_BUNDLE, stage);
      const { dx, dy } = now.liveShift(now.faceAnchor);
      const move = (r: Rect): Rect => ({ left: r.left + dx, top: r.top + dy, right: r.right + dx, bottom: r.bottom + dy });
      window.__platform = { ...window.__platform, faceRect: { eyes: rects.eyes.map(move), mouth: move(rects.mouth) }, route: window.location.pathname };
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      if (window.__platform) delete window.__platform.faceRect;
    };
  }, []);
  return null;
}

/** The entrance's skip control (the engine's own comes with its HTML, which `ui: 'none'` leaves out): any click or key skips too. */
function SkipIntro() {
  const api = useInstanceApi();
  return (
    <button type="button" className="oct-button oct-skip-intro" onClick={api.skip}>
      Skip intro
    </button>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="oct-button oct-back" onClick={onBack}>
      <span aria-hidden="true">{'←'}</span>
      Back
    </button>
  );
}

/**
 * Focus follows the view (spec 2.5, 7.15): when How It Works opens, the first card takes focus (the
 * intro's button that opened it has gone inert); when it closes (Back, Escape, the browser's Back)
 * focus returns to the control that opened it. A page that loads on How It Works keeps its focus where it is.
 */
function useViewFocus(showHow: boolean, intro: boolean, layer: RefObject<HTMLElement | null>) {
  const before = useRef(showHow);
  const returning = useRef(false);
  useEffect(() => {
    if (before.current !== showHow) {
      before.current = showHow;
      returning.current = !showHow;
      if (showHow) layer.current?.querySelector<HTMLElement>('.oct-card')?.focus();
    }
    // The intro's controls are inert until the stage is the intro again (a beat after the route is): focus waits for that.
    if (returning.current && intro) {
      returning.current = false;
      layer.current?.querySelector<HTMLElement>('.oct-actions .oct-button-primary')?.focus();
    }
  }, [showHow, intro, layer]);
}

/** The platform's HTML over the host: the nav, the intro's text, How It Works' cards, Back. */
function LandingLayer({ route }: { route: 'landing' | 'howItWorks' }) {
  const api = useInstanceApi();
  const layer = useRef<HTMLDivElement>(null);
  const entering = api.stage === 'entering';
  const showHow = api.stage === 'overview' && route === 'howItWorks';
  useViewFocus(showHow, api.stage === 'intro', layer);
  return (
    <div ref={layer} className="oct-layer oct-root">
      <a className="oct-skip-link oct-button" href="#oct-main">
        Skip to main content
      </a>
      <Nav hidden={entering} />
      <main id="oct-main" tabIndex={-1} className="oct-main">
        {entering && <SkipIntro />}
        <LandingText hidden={api.stage !== 'intro'} onSeeHow={openHowItWorks} onCreate={() => navigate('/create')} />
        {showHow && (
          <>
            <HowItWorks onOpen={href => navigate(href)} />
            <BackButton onBack={leaveHowItWorks} />
          </>
        )}
      </main>
      <FaceProbe />
    </div>
  );
}

/**
 * The landing (spec 7.8): one host page instance (`ui: 'none'`) that stays mounted across the intro
 * (`/`) and How It Works (`/how-it-works`); the route asks for the stage and the stage (the engine's
 * Escape included) asks for the route, so the two never disagree. On a phone the host is boxed in the
 * upper 55% of the screen (an ancestor with a transform makes the engine's fixed canvas fill the box,
 * not the window) and the rest of the page sits below it.
 */
export function Landing({ route }: { route: 'landing' | 'howItWorks' }) {
  const options = useMemo(() => parseUrlState(window.location.search), []);
  const routeNow = useRef(route);
  routeNow.current = route;
  // The route asks for the stage (browser Back and Forward, the buttons): a new id is a new request.
  const [request, setRequest] = useState<{ id: number; stage: LinkStage } | undefined>();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setRequest(previous => ({ id: (previous?.id ?? 0) + 1, stage: route === 'howItWorks' ? 'overview' : 'intro' }));
  }, [route]);
  // The stage asks for the route: the engine's own Escape leaves How It Works, and a stage opened by the host itself is the route's.
  const onStageChange = useCallback((stage: string) => {
    if (stage === 'overview' && routeNow.current === 'landing') navigate('/how-it-works');
    else if (stage === 'intro' && routeNow.current === 'howItWorks') leaveHowItWorks();
  }, []);
  return (
    <div className="oct-landing">
      <div className="oct-hostbox">
        <WorldHost bundle={HOST_BUNDLE} options={options} ui="none" initialStage={route === 'howItWorks' ? 'overview' : undefined} stageRequest={request} onStageChange={onStageChange}>
          <LandingLayer route={route} />
        </WorldHost>
      </div>
    </div>
  );
}
