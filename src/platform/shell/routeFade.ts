/**
 * The route fade (platform spec 7.9): between two platform pages an HTML overlay in the reef's deep indigo covers the page
 * for half the time, the page is swapped under it, and the overlay uncovers: 250 ms in all. With reduced motion the swap is
 * an instant cut and no overlay is drawn. Canvases are never cross-faded; the overlay is plain HTML above everything.
 *
 * This is the timeline alone (no React, no DOM), so its clean-up can be tested: it owns at most one timer, and `dispose`
 * clears it, so nothing is left running after the route changes during a fade or the app unmounts.
 */

export const FADE_MS = 250;
const HALF_MS = FADE_MS / 2;

export type FadePhase = 'idle' | 'in' | 'out';

export interface RouteFade {
  readonly phase: FadePhase;
  /** A page change is wanted: fade (or, with reduced motion, cut) to the latest route. */
  request(): void;
  dispose(): void;
}

export function createRouteFade(options: {
  reduced: () => boolean;
  /** Puts the latest route on screen; called once per fade, at its middle (or at once for a cut). */
  swap: () => void;
  /** Shows the overlay's phase: 'in' (covering), 'out' (uncovering) or 'idle' (gone). */
  paint: (phase: FadePhase) => void;
}): RouteFade {
  let phase: FadePhase = 'idle';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const set = (next: FadePhase) => {
    if (next === phase) return;
    phase = next;
    options.paint(next);
  };

  return {
    get phase() {
      return phase;
    },
    request() {
      if (disposed) return;
      if (options.reduced()) {
        clear();
        options.swap();
        set('idle');
        return;
      }
      // Already covering: the swap at the middle reads the latest route, so this request is already served.
      if (phase === 'in') return;
      clear();
      set('in');
      timer = setTimeout(() => {
        options.swap();
        set('out');
        timer = setTimeout(() => {
          timer = undefined;
          set('idle');
        }, HALF_MS);
      }, HALF_MS);
    },
    dispose() {
      disposed = true;
      clear();
    },
  };
}
