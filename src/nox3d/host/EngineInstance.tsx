import { type ReactNode, useState } from 'react';
import { createInstanceState } from './instance';
import { InstanceContext } from './instanceContext';

// The context and the useInstance hook live in instanceContext.ts: a file of components exports only components (fast refresh; the lint rule).

/** Creates one instance's state, once per mount, and gives it to everything below (the Canvas's scene too, which React bridges). */
export function EngineInstance({ id, mode, children }: { id: string; mode: 'page' | 'preview'; children: ReactNode }) {
  const [state] = useState(() => createInstanceState(id, mode));
  return <InstanceContext.Provider value={state}>{children}</InstanceContext.Provider>;
}
