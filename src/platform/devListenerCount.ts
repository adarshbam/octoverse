// Development builds only (the caller guards the call with `import.meta.env.DEV`, so the production bundle holds none of this):
// `window.__listenerCount(type)`, the number of listeners of that type attached to the window right now (`'*'`: of every type), for the
// end-to-end specs; the same name and shape as the engine test page's own counter (src/app/multi.tsx). A world visit must
// leave the window as it found it (spec 7.9: "Back during the entrance ... no listener left"); the spec reads the count before the
// visit and after it. It wraps the window's own addEventListener and removeEventListener and keeps one entry per
// (type, listener, capture), as the DOM does, so a listener added twice counts once. A listener added with `once` or a `signal`
// removes itself without a call, so those are not counted.

declare global {
  interface Window {
    /** Development only: how many listeners of `type` are on the window (`'*'`: all of them). */
    __listenerCount?: (type: string) => number;
  }
}

type Listener = EventListenerOrEventListenerObject | null;

export function installListenerCount(): void {
  if (typeof window === 'undefined' || window.__listenerCount !== undefined) return;
  const ids = new WeakMap<object, number>();
  const live = new Set<string>();
  let next = 0;
  const key = (type: string, listener: Listener, options?: boolean | AddEventListenerOptions | EventListenerOptions) => {
    // A call with no listener (null, undefined or not an object) is a native no-op: nothing to count, and nothing to give an id.
    if (listener === null || (typeof listener !== 'object' && typeof listener !== 'function')) return null;
    let id = ids.get(listener);
    if (id === undefined) ids.set(listener, (id = ++next));
    const capture = typeof options === 'boolean' ? options : options?.capture === true;
    return `${type}|${id}|${capture}`;
  };
  const add = window.addEventListener.bind(window);
  const remove = window.removeEventListener.bind(window);
  window.addEventListener = ((type: string, listener: Listener, options?: boolean | AddEventListenerOptions) => {
    const k = key(type, listener, options);
    const own = typeof options === 'object' && (options.once === true || options.signal !== undefined);
    if (k !== null && !own) live.add(k);
    add(type, listener as EventListenerOrEventListenerObject, options);
  }) as typeof window.addEventListener;
  window.removeEventListener = ((type: string, listener: Listener, options?: boolean | EventListenerOptions) => {
    const k = key(type, listener, options);
    if (k !== null) live.delete(k);
    remove(type, listener as EventListenerOrEventListenerObject, options);
  }) as typeof window.removeEventListener;
  window.__listenerCount = type => (type === '*' ? live.size : [...live].filter(k => k.startsWith(`${type}|`)).length);
}
