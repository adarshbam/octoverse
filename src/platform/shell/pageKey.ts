import { profileFor } from '../fixtures/showcase';
import type { Route } from '../router/routes';

/**
 * What a route fade is between (spec 7.9: "between platform pages"): the landing and How It Works are one page (one host
 * instance that stays mounted), a world is one page across its views, and every other route is its own page.
 */
export function pageKey(route: Route): string {
  switch (route.name) {
    case 'landing':
    case 'howItWorks':
      return 'landing';
    case 'profile':
      return `profile:${route.handle}`;
    case 'world':
      return `world:${route.handle}/${route.project}`;
    case 'notFound':
      return `notFound:${route.path}`;
    default:
      return route.name;
  }
}

/** The world a handle's project is, or undefined (the fixtures decide at render time: the router only checks the shape of the address). */
export function worldFor(handle: string, project: string): string | undefined {
  return profileFor(handle)?.projects.find(p => p.slug === project)?.bundle;
}

const NOT_FOUND_TITLE = 'Not found (404) · OctoVerse';

/**
 * The document title of a platform page, or null where the host sets it (the landing, How It Works, a world, the create preview, a review).
 * The not-found page carries its status; a handle or project the fixtures do not know is the not-found page too.
 */
export function titleFor(route: Route): string | null {
  switch (route.name) {
    case 'explore':
      return 'Explore · OctoVerse';
    case 'create':
      return 'Create · OctoVerse';
    case 'profile': {
      const profile = profileFor(route.handle);
      return profile ? `${profile.name} · OctoVerse` : NOT_FOUND_TITLE;
    }
    case 'world':
      return worldFor(route.handle, route.project) ? null : NOT_FOUND_TITLE;
    case 'notFound':
      return NOT_FOUND_TITLE;
    default:
      return null;
  }
}
