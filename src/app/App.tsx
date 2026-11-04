import { useEffect, useState } from 'react';
import { NOX_BUNDLE } from '../worlds/nox/bundle';
import { type HostProps, WorldHost } from '../engine/host/WorldHost';
import type { WorldBundle } from '../engine/types/bundle';

// The page's world until the world registry (Task 10): Nox's bundle, hosted by WorldHost.

/**
 * Nox's page. `?variant=dummy` (development only) hosts the dummy character and world, config
 * alone, made over Nox's bundle (the world id stays `nox`, so the page's probes keep their names).
 * The dynamic import sits behind the literal DEV check, so the production bundle holds neither
 * fixture.
 */
export function App({ options, mode = 'page', ...host }: Omit<HostProps, 'bundle'>) {
  const [variant, setVariant] = useState<WorldBundle | null>(null);
  const wantsVariant = import.meta.env.DEV && options.variant === 'dummy';
  useEffect(() => {
    if (import.meta.env.DEV && options.variant === 'dummy') {
      void Promise.all([import('../engine/config/fixtures/dummy.character'), import('../engine/world/fixtures/dummy.world')]).then(([c, w]) =>
        setVariant({ ...NOX_BUNDLE, character: c.dummyCharacter(NOX_BUNDLE.character), place: w.dummyWorld(NOX_BUNDLE.place) }),
      );
    }
  }, [options.variant]);
  if (wantsVariant) return variant ? <WorldHost {...host} bundle={variant} options={options} mode={mode} /> : null;
  return <WorldHost {...host} bundle={NOX_BUNDLE} options={options} mode={mode} />;
}
