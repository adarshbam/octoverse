import { useEffect } from 'react';

/** Anything three.js holds on the GPU for us: geometries, materials, textures, render targets, instanced meshes. */
export interface Disposable {
  dispose(): void;
}

/** Disposals waiting for the tick after a cleanup, keyed by the list they belong to. */
const pending = new WeakMap<readonly Disposable[], ReturnType<typeof setTimeout>>();

/** Disposes each item once. One that throws does not stop the rest; the first error is rethrown at the end. */
export function disposeAll(items: readonly Disposable[]) {
  let failure: unknown;
  let failed = false;
  for (const item of new Set(items)) {
    try {
      item.dispose();
    } catch (error) {
      if (!failed) failure = error;
      failed = true;
    }
  }
  if (failed) throw failure;
}

/** Disposes the list after the current tick, unless `reclaim` is called for it first. */
export function retire(items: readonly Disposable[]) {
  if (pending.has(items)) return;
  pending.set(
    items,
    setTimeout(() => {
      pending.delete(items);
      disposeAll(items);
    }, 0),
  );
}

/** Calls off a pending `retire` of this list (a re-run of the same effect found it still in use). */
export function reclaim(items: readonly Disposable[]) {
  const timer = pending.get(items);
  if (timer === undefined) return;
  clearTimeout(timer);
  pending.delete(items);
}

/**
 * Frees what a `useMemo` built, when that value is replaced or the component unmounts. React
 * Three Fiber does not dispose objects passed as props or `<primitive>`s, so a component that
 * makes its own geometries, materials and textures hands them over here. Pass the array from the
 * memo itself (the same array every render). List only what the component owns: never geometry
 * or materials from the `useGLTF` cache, which the cache shares.
 *
 * Disposal waits for the next tick, so the unmount-and-remount StrictMode simulates in
 * development, which re-runs this effect on the same value at once, disposes nothing.
 */
export function useDisposables(items: readonly Disposable[]) {
  useEffect(() => {
    reclaim(items);
    return () => retire(items);
  }, [items]);
}
