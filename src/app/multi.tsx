import { Fragment, StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../nox3d/App';
import { type ReviewOptions, parseUrlState } from '../nox3d/behavior/urlState';
import { Embedding } from './embedding';

/**
 * Development only: a page that mounts two instances of Nox side by side, for the isolation specs
 * (tests/e2e/isolation.spec.ts). The URL says how:
 *   ?a=<options>   the review options of instance A, URL-encoded (`stage=intro&freeze`)
 *   ?b=<options>   the same for B
 *   ?amode=preview|page   (default page)    ?bmode=page|preview   (default preview)
 *   ?showb=0       B starts unmounted; the button mounts and unmounts it
 *   ?strict=0      render without StrictMode (the default is with it), for the spec that compares the two
 *   ?embed=1       the embedding page instead (src/app/embedding.tsx, for tests/e2e/embedding.spec.ts; its own switches are there)
 * It also counts the window's listeners (`window.__listenerCount(type)`) and the storage calls
 * (`window.__storageCalls`), which the specs read.
 *
 * It renders under StrictMode (unless `?strict=0`), which runs every effect twice on mount (mount,
 * clean up, mount again): so the isolation specs also show that an instance cleans up what it set
 * up, registers its listeners once, and makes its Theatre project once. The real page (main.tsx)
 * is not wrapped.
 */
declare global {
  interface Window {
    __listenerCount?: (type: string) => number;
    /** How many times the window's listeners of `type` were added and removed in all: added - removed is the live count. */
    __listenerCalls?: (type: string) => { added: number; removed: number };
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
  const calls = new Map<string, { added: number; removed: number }>();
  const callsOf = (type: string) => calls.get(type) ?? calls.set(type, { added: 0, removed: 0 }).get(type)!;
  const capture = (options?: boolean | AddEventListenerOptions | EventListenerOptions) => (typeof options === 'boolean' ? options : Boolean(options?.capture));
  const add = window.addEventListener.bind(window);
  const remove = window.removeEventListener.bind(window);
  window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
    if (listener) {
      const key = `${type}|${capture(options)}`;
      (live.get(key) ?? live.set(key, new Set()).get(key)!).add(listener);
      callsOf(type).added++;
    }
    add(type, listener as EventListenerOrEventListenerObject, options);
  }) as typeof window.addEventListener;
  window.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) => {
    if (listener) {
      if (live.get(`${type}|${capture(options)}`)?.delete(listener)) callsOf(type).removed++;
    }
    remove(type, listener as EventListenerOrEventListenerObject, options);
  }) as typeof window.removeEventListener;
  window.__listenerCalls = type => ({ ...callsOf(type) });
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
  const Strict = params.get('strict') === '0' ? Fragment : StrictMode;
  createRoot(document.getElementById('root')!).render(
    <Strict>
      {params.has('embed') ? (
        <Embedding params={params} />
      ) : (
        <Multi
          a={parseUrlState(params.get('a') ?? '')}
          b={parseUrlState(params.get('b') ?? '')}
          aMode={modeOf('amode', 'page')}
          bMode={modeOf('bmode', 'preview')}
          startWithB={params.get('showb') !== '0'}
        />
      )}
    </Strict>,
  );
}
