import { type ReactNode, useState } from 'react';
import type { WorldBundle } from '../types/bundle';
import { createInstanceState } from './instance';
import { InstanceContext } from './instanceContext';

// The context and the useInstance hook live in instanceContext.ts: a file of components exports only components (fast refresh; the lint rule).

/**
 * Creates one instance's state, once per mount, and gives it to everything below (the Canvas's
 * scene too, which React bridges). `bundle` should already be validated (WorldHost does it); the
 * host keys the instance on the bundle itself (`instanceKey`), so a new world, or a new bundle object of the
 * same world, is a new instance: the state below is made once per mount from the bundle it was given.
 */
export function EngineInstance({ bundle, mode, children }: { bundle: WorldBundle; mode: 'page' | 'preview'; children: ReactNode }) {
  const [state] = useState(() => createInstanceState(bundle, mode));
  return <InstanceContext.Provider value={state}>{children}</InstanceContext.Provider>;
}
