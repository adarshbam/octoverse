import { useCallback, useSyncExternalStore } from 'react';
import { attachWindowListeners } from '../host/listeners';
import { useInstance } from '../host/instanceContext';
import { layoutFor } from '../stage/framing';

/** The window's size and the layout it makes, kept up to date as the window resizes or turns. */
export interface Viewport {
  width: number;
  height: number;
  layout: ReturnType<typeof layoutFor>;
  /** A phone held upright: the orbs are too small to pick out, and panels are bottom sheets. */
  phonePortrait: boolean;
}

// One snapshot per size, so the store hands React the same object until the window changes. This is a memo of a
// pure function of the window's size, not instance state: every instance on the page reads the same one.
let last: Viewport | null = null;
function snapshot(): Viewport {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (last && last.width === width && last.height === height) return last;
  const layout = layoutFor({ width, height });
  last = { width, height, layout, phonePortrait: layout === 'phone' && height > width };
  return last;
}

/** The window's size and layout; a page instance follows its changes, a preview (which attaches no window listener) reads the size when it renders. */
export function useViewport() {
  const { mode } = useInstance();
  const subscribe = useCallback((onChange: () => void) => attachWindowListeners(mode, ['resize'], onChange), [mode]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Whether the browser can make a WebGL 2 context at all (three.js 0.186 needs one). */
export function hasWebgl2() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}
