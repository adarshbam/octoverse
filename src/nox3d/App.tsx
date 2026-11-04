import { useEffect, useState } from 'react';
import type { ReviewOptions } from './behavior/urlState';
import { NOX_BUNDLE } from './bundle.nox';
import { WorldHost } from './host/WorldHost';
import type { WorldBundle } from './types/bundle';

// The page's world until the world registry (Task 10): Nox's bundle, hosted by WorldHost.

/**
 * Nox's page. `?variant=dummy` (development only) hosts the dummy character and world, config
 * alone, made over Nox's bundle (the world id stays `nox`, so the page's probes keep their names).
 * The dynamic import sits behind the literal DEV check, so the production bundle holds neither
 * fixture.
 */
export function App({ options, mode = 'page' }: { options: ReviewOptions; mode?: 'page' | 'preview' }) {
  const [variant, setVariant] = useState<WorldBundle | null>(null);
  const wantsVariant = import.meta.env.DEV && options.variant === 'dummy';
  useEffect(() => {
    if (import.meta.env.DEV && options.variant === 'dummy') {
      void Promise.all([import('./config/fixtures/dummy.character'), import('./world/fixtures/dummy.world')]).then(([c, w]) =>
        setVariant({ ...NOX_BUNDLE, character: c.dummyCharacter(NOX_BUNDLE.character), place: w.dummyWorld(NOX_BUNDLE.place) }),
      );
    }
  }, [options.variant]);
  if (wantsVariant) return variant ? <WorldHost bundle={variant} options={options} mode={mode} /> : null;
  return <WorldHost bundle={NOX_BUNDLE} options={options} mode={mode} />;
}
