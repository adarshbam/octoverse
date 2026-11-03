import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../nox3d/App';
import { type ReviewOptions, parseUrlState } from '../nox3d/behavior/urlState';

/**
 * Development only: a page that mounts two instances of Nox side by side, for the isolation specs
 * (tests/e2e/isolation.spec.ts). The URL says how:
 *   ?a=<options>   the review options of instance A, URL-encoded (`stage=intro&freeze`)
 *   ?b=<options>   the same for B
 *   ?amode=preview|page   (default page)    ?bmode=page|preview   (default preview)
 *   ?showb=0       B starts unmounted; the button mounts and unmounts it
 * It also counts the window's listeners (`window.__listenerCount(type)`) and the storage calls
 * (`window.__storageCalls`), which the specs read.
 */
declare global {
  interface Window {
    __listenerCount?: (type: string) => number;
    __storageCalls?: string[];
  }
}

export function Multi({ a, b, aMode, bMode, startWithB }: { a: ReviewOptions; b: ReviewOptions; aMode: 'page' | 'preview'; bMode: 'page' | 'preview'; startWithB: boolean }) {
  const [showB, setShowB] = useState(startWithB);
  return (
    <>
      <button type="button" className="multi-bar" onClick={() => setShowB(on => !on)}>
        {showB ? 'Unmount B' : 'Mount B'}
      </button>
      <div className="cell" data-slot="a">
        <App options={a} mode={aMode} />
      </div>
      {showB && (
        <div className="cell" data-slot="b">
          <App options={b} mode={bMode} />
        </div>
      )}
    </>
  );
}

if (import.meta.env.DEV) {
  const live = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const capture = (options?: boolean | AddEventListenerOptions | EventListenerOptions) => (typeof options === 'boolean' ? options : Boolean(options?.capture));
  const add = window.addEventListener.bind(window);
  const remove = window.removeEventListener.bind(window);
  window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
    if (listener) {
      const key = `${type}|${capture(options)}`;
      (live.get(key) ?? live.set(key, new Set()).get(key)!).add(listener);
    }
    add(type, listener as EventListenerOrEventListenerObject, options);
  }) as typeof window.addEventListener;
  window.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) => {
    if (listener) live.get(`${type}|${capture(options)}`)?.delete(listener);
    remove(type, listener as EventListenerOrEventListenerObject, options);
  }) as typeof window.removeEventListener;
  window.__listenerCount = type => (live.get(`${type}|false`)?.size ?? 0) + (live.get(`${type}|true`)?.size ?? 0);

  // Every storage call is noted; a preview must make none.
  window.__storageCalls = [];
  for (const method of ['getItem', 'setItem', 'removeItem', 'clear', 'key'] as const) {
    const original = Storage.prototype[method] as (...args: unknown[]) => unknown;
    Storage.prototype[method] = function (this: Storage, ...args: unknown[]) {
      window.__storageCalls!.push(`${method} ${String(args[0] ?? '')}`.trim());
      return original.apply(this, args);
    } as never;
  }

  const params = new URLSearchParams(location.search);
  const modeOf = (key: string, fallback: 'page' | 'preview') => (params.get(key) === 'page' || params.get(key) === 'preview' ? (params.get(key) as 'page' | 'preview') : fallback);
  createRoot(document.getElementById('root')!).render(
    <Multi
      a={parseUrlState(params.get('a') ?? '')}
      b={parseUrlState(params.get('b') ?? '')}
      aMode={modeOf('amode', 'page')}
      bMode={modeOf('bmode', 'preview')}
      startWithB={params.get('showb') !== '0'}
    />,
  );
}
