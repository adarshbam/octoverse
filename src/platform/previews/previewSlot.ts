import { useEffect, useSyncExternalStore } from 'react';

/**
 * The preview slot (spec 7.14, the context budget): the platform holds ONE live preview at a time, because the page instance
 * (the host or a world) is one WebGL context and a preview is the only other one allowed (spec 2.4). A preview owns the slot
 * while it is mounted: asking for a second one hands the slot over and the first, told by `subscribe`, unmounts.
 */
export interface PreviewSlot {
  /** Takes the slot for `owner`, replacing whoever held it. Always true: a request is never refused, the old owner is. */
  request(owner: string): boolean;
  /** Gives the slot up. Does nothing unless `owner` holds it (a preview that was replaced cannot empty its successor's slot). */
  release(owner: string): void;
  /** Who holds the slot now, or null. */
  current(): string | null;
  /** Calls `cb` once per change of owner; the returned function stops it. */
  subscribe(cb: () => void): () => void;
}

export function createPreviewSlot(): PreviewSlot {
  let owner: string | null = null;
  const listeners = new Set<() => void>();
  const set = (next: string | null) => {
    if (next === owner) return;
    owner = next;
    // A listener may unsubscribe (or subscribe) while it is told: iterate over a copy.
    for (const cb of [...listeners]) cb();
  };
  return {
    request(who) {
      set(who);
      return true;
    },
    release(who) {
      if (owner === who) set(null);
    },
    current: () => owner,
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

/** The platform's slot: one per page, shared by every card, tile and hero. */
export const previewSlot: PreviewSlot = createPreviewSlot();

/**
 * Asks the platform's slot for `owner` while `wanted` is true and says whether `owner` holds it now. `wanted` turning false gives
 * it up after `lingerMs` (0: at once; a `wanted` that comes back before then keeps it), unmounting gives it up at once, and being
 * replaced by another owner is seen as `false` straight away. `slot` is for tests.
 */
export function usePreviewSlot(owner: string, wanted: boolean, lingerMs = 0, slot: PreviewSlot = previewSlot): boolean {
  useEffect(() => {
    if (wanted) {
      slot.request(owner);
      return;
    }
    if (slot.current() !== owner) return;
    if (lingerMs <= 0) {
      slot.release(owner);
      return;
    }
    const timer = setTimeout(() => slot.release(owner), lingerMs);
    return () => clearTimeout(timer);
  }, [owner, wanted, lingerMs, slot]);
  useEffect(() => () => slot.release(owner), [owner, slot]);
  return useSyncExternalStore(
    slot.subscribe,
    () => slot.current() === owner,
    () => false,
  );
}
