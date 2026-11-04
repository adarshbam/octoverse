export type View = 'intro' | 'overview' | 'detail';

export type Route =
  | { name: 'landing' }
  | { name: 'howItWorks' }
  | { name: 'explore' }
  | { name: 'profile'; handle: string }
  | { name: 'world'; handle: string; project: string; view: View }
  | { name: 'create' }
  | { name: 'createPreview' }
  | { name: 'notFound'; path: string }
  | { name: 'review'; search: string };

export const RESERVED_HANDLES = [
  'explore',
  'create',
  'how-it-works',
  'about',
  'pricing',
  'signin',
  'api',
  'assets',
] as const;

const HANDLE_RE = /^[a-z][a-z0-9-]{1,23}$/;
const PROJECT_RE = /^[a-z0-9-]{1,40}$/;
const VIEWS: readonly View[] = ['intro', 'overview', 'detail'];

const isView = (v: string): v is View => (VIEWS as readonly string[]).includes(v);
const isReserved = (h: string) => (RESERVED_HANDLES as readonly string[]).includes(h);

export function parseRoute(
  pathname: string,
  search: string,
): { route: Route; replace?: string } {
  const notFound = (): { route: Route } => ({ route: { name: 'notFound', path: pathname } });
  // One trailing slash is tolerated, except on a path that is only slashes or has an empty segment ('//' is not the landing).
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (pathname.startsWith('//') || (path.endsWith('/') && path.length > 1)) return notFound();

  switch (path) {
    case '/': {
      const params = new URLSearchParams(search);
      if (params.has('world') || params.has('creator')) {
        return { route: { name: 'review', search } };
      }
      return { route: { name: 'landing' } };
    }
    case '/how-it-works':
      return { route: { name: 'howItWorks' } };
    case '/explore':
      return { route: { name: 'explore' } };
    case '/create':
      return { route: { name: 'create' } };
    case '/create/preview':
      return { route: { name: 'createPreview' } };
  }

  if (!path.startsWith('/@')) return notFound();
  const parts = path.slice(2).split('/');
  if (parts.length > 2) return notFound();
  const [handle, project] = parts;
  if (!HANDLE_RE.test(handle) || isReserved(handle)) return notFound();
  if (project === undefined) return { route: { name: 'profile', handle } };
  if (!PROJECT_RE.test(project)) return notFound();

  const params = new URLSearchParams(search);
  const raw = params.get('view');
  if (raw === null) {
    return { route: { name: 'world', handle, project, view: 'intro' } };
  }
  if (isView(raw)) {
    return { route: { name: 'world', handle, project, view: raw } };
  }
  params.delete('view');
  const rest = params.toString();
  return {
    route: { name: 'world', handle, project, view: 'intro' },
    replace: path + (rest ? `?${rest}` : ''),
  };
}

export function buildPath(route: Route): string {
  switch (route.name) {
    case 'landing':
      return '/';
    case 'howItWorks':
      return '/how-it-works';
    case 'explore':
      return '/explore';
    case 'profile':
      return `/@${route.handle}`;
    case 'world': {
      const base = `/@${route.handle}/${route.project}`;
      return route.view === 'intro' ? base : `${base}?view=${route.view}`;
    }
    case 'create':
      return '/create';
    case 'createPreview':
      return '/create/preview';
    case 'notFound':
      return route.path;
    case 'review':
      return '/' + route.search;
  }
}
