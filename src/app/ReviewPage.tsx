import { useMemo } from 'react';
import { parseUrlState } from '../engine/behavior/urlState';
import { resolveWorld } from '../worlds';
import { Page } from './Page';

/**
 * The engine's own page for a review address (`/?world=<id>`, and the engine's review switches): the world the address picks
 * (an unknown id shows Nox, with a warning, not a blank page) in the engine's own page. It holds the registry, which names every
 * world, so it is a chunk of its own that only a review address loads (the platform's landing never does).
 */
export default function ReviewPage({ search }: { search: string }) {
  const { bundle, options } = useMemo(() => {
    const resolved = resolveWorld(search);
    if (resolved.warning) console.warn(resolved.warning);
    return { bundle: resolved.bundle, options: parseUrlState(search) };
  }, [search]);
  return <Page first={bundle} options={options} />;
}
