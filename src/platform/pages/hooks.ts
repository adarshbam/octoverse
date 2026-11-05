import { type RefObject, useEffect, useRef, useSyncExternalStore } from 'react';
import type { InstanceApi } from '../../engine/host/useInstanceApi';
import type { Vec3 } from '../../engine/world/types';
import { type Size, clampShift, hostBox } from './geometry';

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
 *
 * `keepOn`: the camera's hover drift is wide on a narrow window (about 80 px either way at 768 px), so an element that follows it
 * could leave the window and be cut off (platform Task 21a: the intro's description at 768 x 1024, the left card on How It Works).
 * With `keepOn` the horizontal shift is held so that every rectangle `measure` returns (the element's own box by default, as it is
 * on screen NOW) stays at least `margin` px inside the host box; the vertical shift is untouched.
 */
export function useShift(ref: RefObject<HTMLElement | null>, api: InstanceApi, world: Vec3, enabled = true, keepOn?: { margin: number; measure?: (el: HTMLElement) => { left: number; right: number }[] }) {
  const at = useRef({ api, world });
  useEffect(() => {
    at.current = { api, world };
  });
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    let last = '';
    let applied = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const shift = at.current.api.liveShift(at.current.world);
        const { dy } = shift;
        let { dx } = shift;
        if (keepOn) {
          // Where the content is without the shift: what is on screen now, less what was applied.
          const parts = (keepOn.measure ? keepOn.measure(el) : [el.getBoundingClientRect()]).filter(r => r.right > r.left);
          if (parts.length) {
            const left = Math.min(...parts.map(r => r.left)) - applied;
            const right = Math.max(...parts.map(r => r.right)) - applied;
            dx = clampShift({ left, right }, dx, el.ownerDocument.defaultView?.innerWidth ?? Infinity, keepOn.margin);
          }
        }
        applied = Math.abs(dx) < 0.005 && Math.abs(dy) < 0.005 ? 0 : dx;
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
  // `keepOn` is a literal at each call: its margin is read from the first render.
  }, [ref, enabled]);
}
