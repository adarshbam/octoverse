import { useSyncExternalStore } from 'react';
import { buildPath, parseRoute, type Route } from './routes';

const listeners = new Set<() => void>();
let popstateAttached = false;

let cachedKey = '';
let cachedRoute: Route | null = null;

const notify = () => {
  listeners.forEach((fn) => fn());
};

/** If the current URL is not canonical, replace it (never push). Returns true when it did. */
export function canonicalise(): boolean {
  const { location, history } = window;
  const { replace } = parseRoute(location.pathname, location.search);
  if (replace === undefined) return false;
  history.replaceState(history.state, '', replace);
  return true;
}

const onPopState = () => {
  canonicalise();
  notify();
};

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (!popstateAttached) {
    window.addEventListener('popstate', onPopState);
    popstateAttached = true;
    canonicalise();
  }
  return () => {
    if (!listeners.delete(cb)) return;
    if (listeners.size === 0 && popstateAttached) {
      window.removeEventListener('popstate', onPopState);
      popstateAttached = false;
    }
  };
}

/** Current route; the same object is returned while the route is unchanged. */
export function getRoute(): Route {
  const { route } = parseRoute(window.location.pathname, window.location.search);
  const key = buildPath(route);
  if (cachedRoute === null || key !== cachedKey) {
    cachedKey = key;
    cachedRoute = route;
  }
  return cachedRoute;
}

const serverRoute: Route = { name: 'landing' };
const getServerRoute = () => serverRoute;

export function navigate(to: string, opts?: { replace?: boolean }): void {
  if (opts?.replace) window.history.replaceState(window.history.state, '', to);
  else window.history.pushState(null, '', to);
  canonicalise();
  notify();
}

export function goBack(): void {
  window.history.back();
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getRoute, getServerRoute);
}
