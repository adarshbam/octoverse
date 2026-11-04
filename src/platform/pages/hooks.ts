import { type RefObject, useEffect, useRef, useSyncExternalStore } from 'react';
import type { InstanceApi } from '../../engine/host/useInstanceApi';
import type { Vec3 } from '../../engine/world/types';
import { type Size, hostBox } from './geometry';

// The page's own reads of the window and the live camera. The platform draws its HTML over the host
// (`ui: 'none'`) from the instance API alone: where the stage's points are at rest comes from the
// stage frames (geometry.ts), how far the hovering camera has moved them from `liveShift`.

/** What a server render (the tests) sees: the desktop size the compositions are designed at. */
const SERVER_WINDOW: Size = { width: 1536, height: 1024 };

let last: Size | null = null;
/** One snapshot per size, so the store hands React the same object until the window changes. */
function snapshot(): Size {
  const { innerWidth: width, innerHeight: height } = window;
  if (!last || last.width !== width || last.height !== height) last = { width, height };
  return last;
}
const subscribe = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
};
const serverSnapshot = () => SERVER_WINDOW;

/** The window's size, kept up to date as it resizes or turns. */
export function useWindowSize(): Size {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** The host's box on this window (the upper 55% on a phone, the whole window elsewhere). */
export function useHostBox() {
  return hostBox(useWindowSize());
}

/**
 * Keeps an element attached to a world point as the camera hovers: each frame it sets `translate`
 * to the point's shift on screen (the instance API's `liveShift`, against the stage camera at rest),
 * with no React render. The element's own layout and `transform` are left as they are. `enabled: false`
 * leaves the element alone (a phone's cards and buttons sit below the host and do not follow it).
 */
export function useShift(ref: RefObject<HTMLElement | null>, api: InstanceApi, world: Vec3, enabled = true) {
  const at = useRef({ api, world });
  useEffect(() => {
    at.current = { api, world };
  });
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    let last = '';
    const tick = () => {
      const el = ref.current;
      if (el) {
        const { dx, dy } = at.current.api.liveShift(at.current.world);
        const next = Math.abs(dx) < 0.005 && Math.abs(dy) < 0.005 ? '' : `${dx.toFixed(2)}px ${dy.toFixed(2)}px`;
        if (next !== last) {
          last = next;
          el.style.translate = next;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const el0 = ref.current;
    return () => {
      cancelAnimationFrame(frame);
      if (el0) el0.style.translate = '';
    };
  }, [ref, enabled]);
}
