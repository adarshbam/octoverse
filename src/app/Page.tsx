import { useEffect, useState } from 'react';
import { App } from './App';
import type { ReviewOptions } from '../engine/behavior/urlState';
import type { WorldBundle } from '../engine/types/bundle';
import { resolveWorld } from '../worlds';

declare global {
  interface Window {
    /** Development only: shows another world (by id, `?testworld=1`'s clone included) as a full remount, for the world-switch spec. */
    __octoSwitchWorld?: (id: string) => void;
  }
}

/**
 * The page: one world, keyed on its id, so another world is a full unmount and remount (stage,
 * timers, selection, sequences, listeners and uniforms reset by construction; spec 8.3). Nothing
 * in the shipped page changes the world after load; the development build's `__octoSwitchWorld`
 * does, for the switch spec (tests/e2e/worldSwitch.spec.ts). The literal DEV check keeps it out
 * of the production bundle.
 */
export function Page({ first, options }: { first: WorldBundle; options: ReviewOptions }) {
  const [bundle, setBundle] = useState<WorldBundle>(first);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__octoSwitchWorld = id => {
      const next = resolveWorld(`?world=${encodeURIComponent(id)}&testworld=1`);
      if (next.warning) console.warn(next.warning);
      else setBundle(next.bundle);
    };
    return () => {
      delete window.__octoSwitchWorld;
    };
  }, []);
  return <App key={bundle.id} bundle={bundle} options={options} />;
}
