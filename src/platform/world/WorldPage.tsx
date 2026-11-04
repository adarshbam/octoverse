import { useEffect, useState } from 'react';
import type { WorldId } from '../../engine/types/bundle';
import type { View } from '../router/routes';
import { loadWorld } from '../worlds/loadWorld';
import '../ui/glass.css';

type State = { status: 'loading' } | { status: 'ready'; name: string } | { status: 'failed' };

/**
 * A world's route (`/@<handle>/<project>`), loaded as its own chunk. A placeholder until the world page task: it loads the
 * world's bundle through `loadWorld` (one dynamic import per world) and names the world. It has no navigation bar (spec 7.8).
 */
export default function WorldPage({ world, view }: { world: WorldId; view: View }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    loadWorld(world).then(
      bundle => live && setState({ status: 'ready', name: bundle.content.project.characterName }),
      () => live && setState({ status: 'failed' }),
    );
    return () => {
      live = false;
    };
  }, [world]);
  return (
    <main className="oct-root oct-unopened" id="oct-main" tabIndex={-1} data-world={world} data-view={view}>
      <div className="oct-glass oct-unopened-card" role="status">
        {state.status === 'loading' && <h1>Loading world</h1>}
        {state.status === 'ready' && <h1>{state.name}</h1>}
        {state.status === 'failed' && <h1>This world did not load</h1>}
      </div>
    </main>
  );
}
