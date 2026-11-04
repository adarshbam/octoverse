import { useEffect, useState } from 'react';
import { type HostProps, WorldHost } from '../engine/host/WorldHost';
import type { WorldBundle } from '../engine/types/bundle';
import { NOX_BUNDLE } from '../worlds/nox/bundle';

// A page that hosts one world: the bundle main.tsx resolved from the address (`?world=`), or Nox's.

/**
 * One world's page. `bundle` is the world to host (default: Nox's, for the pages that mount Nox
 * only: multi.html, the embedding page). `?variant=dummy` (development only) hosts the dummy
 * character and world, config alone, made over the bundle (the world id stays the bundle's, so the
 * page's probes keep their names). The dynamic import sits behind the literal DEV check, so the
 * production bundle holds neither fixture.
 */
export function App({ bundle = NOX_BUNDLE, options, mode = 'page', ...host }: Omit<HostProps, 'bundle'> & { bundle?: WorldBundle }) {
  const [variant, setVariant] = useState<WorldBundle | null>(null);
  const wantsVariant = import.meta.env.DEV && options.variant === 'dummy';
  useEffect(() => {
    if (import.meta.env.DEV && options.variant === 'dummy') {
      void Promise.all([import('../engine/config/fixtures/dummy.character'), import('../engine/world/fixtures/dummy.world')]).then(([c, w]) =>
        setVariant({ ...bundle, character: c.dummyCharacter(bundle.character), place: w.dummyWorld(bundle.place) }),
      );
    }
  }, [options.variant, bundle]);
  if (wantsVariant) return variant ? <WorldHost {...host} bundle={variant} options={options} mode={mode} /> : null;
  return <WorldHost {...host} bundle={bundle} options={options} mode={mode} />;
}
