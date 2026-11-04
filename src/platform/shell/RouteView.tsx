import { Suspense, lazy } from 'react';
import { profileFor } from '../fixtures/showcase';
import { Explore } from '../pages/Explore';
import { Landing } from '../pages/Landing';
import { NotFound } from '../pages/NotFound';
import { Profile } from '../pages/Profile';
import type { Route } from '../router/routes';
import { worldFor } from './pageKey';
import './shell.css';

// The chunks that load only when their route is entered (spec 2.4): a world (its bundle, kit and Theatre state come through
// `loadWorld`, one dynamic import per world), the creator, its preview, and the engine's own page for a review address.
const WorldPage = lazy(() => import('../world/WorldPage'));
const CreatorRoute = lazy(() => import('../creator/CreatorRoute'));
const PreviewPage = lazy(() => import('../creator/PreviewPage'));
const ReviewPage = lazy(() => import('../../app/ReviewPage'));

/**
 * What a chunk shows while it loads: the reef's water and nothing else (so no navigation bar can flash in on a world or
 * the preview, and none pops in late on the creator). The route fade covers most of it when the chunk is cached.
 */
function Loading() {
  return <div className="oct-root oct-page oct-route-loading" aria-hidden="true" />;
}

/**
 * One route's page (spec 7.8). The landing and How It Works are one `Landing` (one host instance that stays mounted); a handle
 * or a project the showcase does not have is the not-found page, decided here at render time (the router checks only the
 * shape of the address).
 */
export function RouteView({ route }: { route: Route }) {
  switch (route.name) {
    case 'landing':
    case 'howItWorks':
      return <Landing route={route.name} />;
    case 'explore':
      return <Explore />;
    case 'profile': {
      const profile = profileFor(route.handle);
      return profile ? <Profile profile={profile} /> : <NotFound />;
    }
    case 'world': {
      const world = worldFor(route.handle, route.project);
      if (!world) return <NotFound />;
      return (
        <Suspense fallback={<Loading />}>
          <WorldPage world={world} view={route.view} />
        </Suspense>
      );
    }
    case 'create':
      return (
        <Suspense fallback={<Loading />}>
          <CreatorRoute />
        </Suspense>
      );
    case 'createPreview':
      return (
        <Suspense fallback={<Loading />}>
          <PreviewPage />
        </Suspense>
      );
    case 'review':
      return (
        <Suspense fallback={null}>
          <ReviewPage search={route.search} />
        </Suspense>
      );
    case 'notFound':
      return <NotFound />;
  }
}
