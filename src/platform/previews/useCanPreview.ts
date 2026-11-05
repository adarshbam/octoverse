import { useCallback, useSyncExternalStore } from 'react';
import { layoutFor } from '../../engine/stage/framing';
import { useWindowSize } from '../pages/hooks';

/** One media query, kept up to date; `server` is what a server render (the tests) sees. */
function useMedia(query: string, server: boolean): boolean {
  const match = useCallback(() => typeof window.matchMedia === 'function' && window.matchMedia(query).matches, [query]);
  const subscribe = useCallback(
    (notify: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, match, () => server);
}

/** Reduced motion asked for (spec 7.15: no ripple, card previews as stills). Not asked for on a server render. */
export const usePrefersReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)', false);

/**
 * Whether live previews may run here (spec 7.14, 7.15): not on a phone (the same test as the landing's layout: under 768 px
 * wide), not on a touch screen (no hover to bring a card alive; a coarse primary pointer), and not with reduced motion.
 * Stills only otherwise. A server render is a desktop one, for the tests, and gets stills either way: nothing mounts there.
 */
export function useCanPreview(): boolean {
  const { width, height } = useWindowSize();
  const coarse = useMedia('(pointer: coarse)', false);
  const reduced = usePrefersReducedMotion();
  return layoutFor({ width, height }) !== 'phone' && !coarse && !reduced;
}
