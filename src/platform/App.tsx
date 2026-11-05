import { useEffect, useRef, useState } from 'react';
import { restoreArrival, useRoute } from './router/history';
import type { Route } from './router/routes';
import { installListenerCount } from './devListenerCount';
import { RouteView } from './shell/RouteView';
import { type FadePhase, createRouteFade } from './shell/routeFade';
import { pageKey, titleFor } from './shell/pageKey';
import './ui/glass.css';

// Development builds count the window's listeners for the end-to-end specs (the literal DEV check keeps it out of the production bundle).
if (import.meta.env.DEV) installListenerCount();

const prefersReducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The route on screen and the overlay's phase. A route on the same page (the landing and How It Works, a world's views) is on
 * screen at once; a route on another page waits under the 250 ms fade (spec 7.9) and is swapped in at its middle. The fade's
 * timer is cleared when the app unmounts, and a route that changes mid-fade is the one the swap shows.
 */
function useRouteTransition(route: Route): { shown: Route; phase: FadePhase } {
  const [shown, setShown] = useState(route);
  const [phase, setPhase] = useState<FadePhase>('idle');
  const latest = useRef(route);
  const shownRef = useRef(shown);
  const fade = useRef<ReturnType<typeof createRouteFade> | null>(null);

  useEffect(() => {
    shownRef.current = shown;
  });
  useEffect(() => {
    const instance = createRouteFade({ reduced: prefersReducedMotion, swap: () => setShown(latest.current), paint: setPhase });
    fade.current = instance;
    return () => {
      instance.dispose();
      fade.current = null;
    };
  }, []);
  useEffect(() => {
    latest.current = route;
    if (pageKey(route) !== pageKey(shownRef.current)) fade.current?.request();
    else setShown(route);
  }, [route]);

  // The same page needs no waiting: its new route is on screen in this very render.
  return { shown: pageKey(route) === pageKey(shown) ? route : shown, phase };
}

/**
 * The platform shell (spec 7.8): every route of the platform, the document title of the pages that are not the host's, and the
 * 250 ms fade between pages. The world and creator chunks are lazy (spec 2.4).
 */
export function PlatformApp() {
  const route = useRoute();
  const { shown, phase } = useRouteTransition(route);
  useEffect(() => {
    const title = titleFor(shown);
    if (title !== null) document.title = title;
  }, [shown]);
  // A page just swapped in by the browser's Back or Forward gets its scroll and focus back (spec 7.9); a world's views are one page and are left alone.
  const page = pageKey(shown);
  useEffect(() => {
    restoreArrival();
  }, [page]);
  return (
    <>
      <RouteView key={pageKey(shown)} route={shown} />
      {phase !== 'idle' && <div className="oct-route-fade" data-phase={phase} aria-hidden="true" />}
    </>
  );
}
