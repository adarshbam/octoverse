import { createContext, useCallback, useContext } from 'react';

/** The URL's say over the world's clock. */
export interface WorldTimeFlags {
  freeze: boolean;
  t?: number;
}

/** Seconds of world time a frozen world shows when the URL gives none. */
export const FROZEN_TIME = 6;

/** The world's clock: running normally, or held at one moment (`t`, else 6 s) for a still capture. */
export function worldTime(clockSeconds: number, url: WorldTimeFlags) {
  return url.freeze ? (url.t ?? FROZEN_TIME) : clockSeconds;
}

const WorldTimeContext = createContext<WorldTimeFlags>({ freeze: false });
export const WorldTimeProvider = WorldTimeContext.Provider;

/** The world's time for a frame, for `useFrame` callbacks inside a `WorldScene`. */
export function useWorldTime() {
  const flags = useContext(WorldTimeContext);
  return useCallback((state: { clock: { elapsedTime: number } }) => worldTime(state.clock.elapsedTime, flags), [flags]);
}
