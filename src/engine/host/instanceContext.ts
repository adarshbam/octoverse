import { createContext, useContext } from 'react';
import type { InstanceState } from './instance';

export const InstanceContext = createContext<InstanceState | null>(null);

/** The instance the component is under; throws outside an EngineInstance, so a missing provider is named, not a read of undefined. */
export function useInstance(): InstanceState {
  const state = useContext(InstanceContext);
  if (!state) throw new Error('useInstance: no <EngineInstance> above this component');
  return state;
}
