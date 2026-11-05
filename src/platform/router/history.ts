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
  arrival = 'pop';
  cancelRestore?.();
  cancelRestore = null;
  canonicalise();
  notify();
};

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (!popstateAttached) {
    window.addEventListener('popstate', onPopState);
    popstateAttached = true;
    // The browser would restore a page's scroll at once, before the route fade has swapped the page in: restoreArrival does it then.
    window.history.scrollRestoration = 'manual';
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

export function navigate(to: string, opts?: { replace?: boolean; from?: Element | null }): void {
  // The address already shown is replaced, never pushed again (a second click on the current page's link must not add a Back step).
  const here = window.location.pathname + window.location.search;
  cancelRestore?.();
  cancelRestore = null;
  if (opts?.replace || to === here) {
    arrival = 'replace';
    window.history.replaceState(window.history.state, '', to);
  } else {
    arrival = 'push';
    saveLeaving(opts?.from);
    window.history.pushState(newEntry(here, to), '', to);
  }
  canonicalise();
  notify();
}

export function goBack(): void {
  window.history.back();
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getRoute, getServerRoute);
}

// ---- What a history entry remembers (spec 7.9) -------------------------------------------------------------------------------
// `history.state.platform` goes with the entry (it survives a reload, Back and Forward): where the page was scrolled and which
// control had focus when it was left (put back when Back lands on it), and, for a world, the page that opened it and how many of
// the world's own entries (its overview, its detail) are above its first.

export interface EntryState {
  scrollY: number;
  /** A key for the control that was in use (`focusKeyOf`), or null. */
  focusId: string | null;
  /** The address of the page that opened this entry's page, and how many entries of the same path were pushed since (0 on the first). */
  opener?: string;
  depth?: number;
  /** The address of the entry before this one when it is on the same path (the world's previous view), so an engine step-down can tell whether Back lands where the stage went. */
  prev?: string;
}

/** The static pages are each their own scroller (index.html fixes the document at the window's height): see pages.css `.oct-page`. */
const SCROLLER = '.oct-page';

type Stored = Record<string, unknown> & { platform?: EntryState };
const stored = (): Stored => (window.history.state !== null && typeof window.history.state === 'object' && !Array.isArray(window.history.state) ? (window.history.state as Stored) : {});

/**
 * What the current entry remembers, or null for an entry the platform did not make (a typed address, a reload of one, another
 * feature's state alone) or one whose state is not in the shape this module writes (the state is whatever the page or the browser
 * left there: anything malformed is no state, and a field of the wrong type is dropped).
 */
export function entryState(): EntryState | null {
  const raw = stored().platform as unknown;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { scrollY, focusId, opener, depth, prev } = raw as Record<string, unknown>;
  if (typeof scrollY !== 'number' || !Number.isFinite(scrollY) || (focusId !== null && typeof focusId !== 'string')) return null;
  return {
    scrollY,
    focusId,
    ...(typeof opener === 'string' && { opener }),
    ...(typeof depth === 'number' && Number.isFinite(depth) && { depth }),
    ...(typeof prev === 'string' && { prev }),
  };
}

const pathOf = (url: string) => url.split('?')[0];

/** A link is named by its address and its place among the links to the same address (a profile has two to its world); another control by its id. */
export function focusKeyOf(el: Element | null | undefined): string | null {
  if (!el || typeof document === 'undefined' || el === document.body) return null;
  const href = el.tagName === 'A' ? el.getAttribute('href') : null;
  if (href !== null) {
    const same = [...document.querySelectorAll('a[href]')].filter(a => a.getAttribute('href') === href);
    const at = same.indexOf(el);
    return at < 0 ? null : `${href}|${at}`;
  }
  return el.id ? `#${el.id}` : null;
}

/** The control a key (`focusKeyOf`) names on the page now, or null. */
export function elementForFocusKey(key: string): HTMLElement | null {
  if (key.startsWith('#')) return document.getElementById?.(key.slice(1)) ?? null;
  const cut = key.lastIndexOf('|');
  if (cut < 0) return null;
  const [href, at] = [key.slice(0, cut), Number(key.slice(cut + 1))];
  const same = [...document.querySelectorAll('a[href]')].filter(a => a.getAttribute('href') === href);
  return (same[at] as HTMLElement | undefined) ?? null;
}

/** Stores the page's scroll and focus in the entry being left, when there is any to keep (a plain push stays one history call). */
function saveLeaving(from?: Element | null) {
  if (typeof document === 'undefined') return;
  const scrollY = document.querySelector<HTMLElement>(SCROLLER)?.scrollTop ?? 0;
  const focusId = focusKeyOf(from ?? document.activeElement);
  const before = entryState();
  if (scrollY === (before?.scrollY ?? 0) && focusId === (before?.focusId ?? null)) return;
  window.history.replaceState({ ...stored(), platform: { ...before, scrollY, focusId } }, '');
}

/** The state of a new entry: the page it left as its opener (kept while the push stays on the same path), and its depth in that. */
function newEntry(here: string, to: string): Stored {
  const before = entryState();
  const within = before?.opener !== undefined && pathOf(here) === pathOf(to);
  return { platform: { scrollY: 0, focusId: null, opener: within ? before.opener : here, depth: within ? (before.depth ?? 0) + 1 : 0, ...(within && { prev: here }) } };
}

/**
 * A deep link has no page behind it in this tab: the page that should have opened it becomes the entry before this one (this entry
 * is replaced by it and pushed again), so Back goes there. Nothing happens on an entry the platform already made (a reload of one, or
 * a development effect run twice). The route shown does not change, so nothing is notified.
 */
export function insertOpener(opener: string): void {
  if (entryState() !== null) return;
  const here = window.location.pathname + window.location.search;
  window.history.replaceState({ ...stored(), platform: { scrollY: 0, focusId: null, opener: '', depth: 0 } }, '', opener);
  window.history.pushState({ platform: { scrollY: 0, focusId: null, opener, depth: 0 } } satisfies Stored, '', here);
}

type Arrival = 'load' | 'push' | 'replace' | 'pop';
let arrival: Arrival = 'load';

/** How long a page may take to mount (a lazy chunk on a cold cache) before what it remembers is put back anyway, as far as the page allows. */
export const RESTORE_WAIT_MS = 4000;
let cancelRestore: (() => void) | null = null;

/** Puts back what the entry remembers; true when everything it names is on the page (the scroller, and the control when it names one). */
function applyEntry(entry: EntryState): boolean {
  const scroller = document.querySelector<HTMLElement>(SCROLLER);
  const control = entry.focusId !== null ? elementForFocusKey(entry.focusId) : null;
  control?.focus({ preventScroll: true });
  if (scroller) scroller.scrollTop = entry.scrollY;
  return scroller !== null && (entry.focusId === null || control !== null);
}

/**
 * Called when a new page is on screen: after the browser's Back or Forward, the scroll and the focus the entry remembers are put
 * back (focus on the control that opened the world). After a push or a load a page starts at its top. A page behind Suspense (a lazy
 * chunk on a cold cache) may not be mounted yet: the restore waits for it, watching the document, for at most RESTORE_WAIT_MS, and a
 * newer navigation cancels it. It is done once, as soon as everything the entry names is there.
 */
export function restoreArrival(): void {
  cancelRestore?.();
  cancelRestore = null;
  if (arrival !== 'pop' || typeof document === 'undefined') return;
  const entry = entryState();
  // Nothing to put back (a world's own entries): nothing to wait for.
  if (!entry || (entry.scrollY === 0 && entry.focusId === null) || applyEntry(entry)) return;
  if (typeof MutationObserver === 'undefined') return;
  const stop = () => {
    observer.disconnect();
    clearTimeout(timer);
    if (cancelRestore === stop) cancelRestore = null;
  };
  const observer = new MutationObserver(() => {
    if (applyEntry(entry)) stop();
  });
  const timer = setTimeout(() => {
    applyEntry(entry);
    stop();
  }, RESTORE_WAIT_MS);
  cancelRestore = stop;
  observer.observe(document.body, { childList: true, subtree: true });
}
