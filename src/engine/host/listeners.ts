import { useEffect, useRef } from 'react';

/** Window event handlers by event type. */
export type WindowHandlers = { [K in keyof WindowEventMap]?: (event: WindowEventMap[K]) => void };

/**
 * Puts one listener per type on the window, each calling `call(type, event)`, and returns the way to
 * take them off. Only a page instance listens on the window (`mode: 'page'`): a preview shares the
 * document with a page and must not skip its entrance, close its detail or read its keys, so it
 * attaches nothing.
 */
export function attachWindowListeners(mode: 'page' | 'preview', types: readonly string[], call: (type: string, event: Event) => void, capture = false): () => void {
  if (mode !== 'page') return () => {};
  const attached = types.map(type => {
    const listener = (event: Event) => call(type, event);
    window.addEventListener(type, listener, capture);
    return [type, listener] as const;
  });
  return () => {
    for (const [type, listener] of attached) window.removeEventListener(type, listener, capture);
  };
}

/**
 * Window listeners for a page instance, none for a preview (see attachWindowListeners). The listeners
 * stay on for as long as the set of event types does, and call the handlers of the latest render, so
 * a handler that reads state never needs the listener re-registered. A type left out of `handlers`
 * (the skip listeners are given only while the entrance plays) is taken off.
 */
export function useWindowListeners(mode: 'page' | 'preview', handlers: WindowHandlers, capture = false) {
  const latest = useRef(handlers);
  // Declared before the attach effect, so it is current before any event the new listeners could get.
  useEffect(() => {
    latest.current = handlers;
  });
  const types = Object.keys(handlers).sort().join(',');
  useEffect(
    () => attachWindowListeners(mode, types ? types.split(',') : [], (type, event) => (latest.current as Record<string, ((event: Event) => void) | undefined>)[type]?.(event), capture),
    [mode, types, capture],
  );
}
