import type { WorldBundle, WorldId } from '../../engine/types/bundle';

/**
 * The only file in the platform that reaches for a world's bundle (the boundary test, src/engine/boundary.test.ts, allows
 * dynamic imports of src/worlds/<id>/bundle from this file alone). Each world has ONE `import()` here, so the bundler cuts
 * each world, with its kit and its Theatre state, into its own chunk that loads only when its route is entered (spec 2.4: the
 * landing route loads no other world's code). Never import the registry (src/worlds/index.ts): it names every world statically.
 */
const LOADERS = {
  nox: async () => (await import('../../worlds/nox/bundle')).NOX_BUNDLE,
  veyra: async () => (await import('../../worlds/veyra/bundle')).VEYRA_BUNDLE,
  flux: async () => (await import('../../worlds/flux/bundle')).FLUX_BUNDLE,
  aether: async () => (await import('../../worlds/aether/bundle')).AETHER_BUNDLE,
} satisfies Record<string, () => Promise<WorldBundle>>;

/** The worlds this loader can fetch, in showcase order. */
export const LOADABLE_WORLDS = Object.keys(LOADERS) as readonly (keyof typeof LOADERS)[];

const loaded = new Map<WorldId, Promise<WorldBundle>>();

/**
 * One world's bundle, fetched on first use and kept (a second call, from a second visit to the route, is the same promise).
 * An id that is not a showcase world rejects; a failed fetch is forgotten so the next visit tries again.
 */
export function loadWorld(id: WorldId): Promise<WorldBundle> {
  if (!Object.hasOwn(LOADERS, id)) return Promise.reject(new Error(`Unknown world "${id}"`));
  let pending = loaded.get(id);
  if (!pending) {
    pending = LOADERS[id as keyof typeof LOADERS]();
    loaded.set(id, pending);
    pending.catch(() => loaded.delete(id));
  }
  return pending;
}
