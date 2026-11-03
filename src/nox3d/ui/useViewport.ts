import { useSyncExternalStore } from 'react';
import { layoutFor } from '../stage/framing';

/** The window's size and the layout it makes, kept up to date as the window resizes or turns. */
export interface Viewport {
  width: number;
  height: number;
  layout: ReturnType<typeof layoutFor>;
  /** A phone held upright: the orbs are too small to pick out, and panels are bottom sheets. */
  phonePortrait: boolean;
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
};
// One snapshot per size, so the store hands React the same object until the window changes.
let last: Viewport | null = null;
function snapshot(): Viewport {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (last && last.width === width && last.height === height) return last;
  const layout = layoutFor({ width, height });
  last = { width, height, layout, phonePortrait: layout === 'phone' && height > width };
  return last;
}

export const useViewport = () => useSyncExternalStore(subscribe, snapshot, snapshot);

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
