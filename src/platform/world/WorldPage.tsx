import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseUrlState } from '../../engine/behavior/urlState';
import { WorldHost } from '../../engine/host/WorldHost';
import type { WorldBundle, WorldId } from '../../engine/types/bundle';
import { SHOWCASE } from '../fixtures/showcase';
import { type View, parseRoute } from '../router/routes';
import { loadWorld } from '../worlds/loadWorld';
import { exitFor } from './worldHistory';
import { useWorldVisit } from './useWorldVisit';
import '../ui/glass.css';

type State = { status: 'loading' } | { status: 'ready'; bundle: WorldBundle } | { status: 'failed' };

/**
 * A world's route (`/@<handle>/<project>`, spec 7.8): the world's own page instance, with the world's own UI and its `exit`
 * control, loaded as its own chunk (the bundle comes through `loadWorld`, one dynamic import per world). It has no navigation bar.
 *
 * The history of a visit is spec 7.9: the stage the engine moves to asks for the route (`onStageChange`: the overview and the detail
 * are pushed as `?view=`, a technology focus and the engine's own Escape never are), and the route asks for the stage (a browser
 * Back or Forward to another view of this world is a `stageRequest`). The entrance plays once per session, by the engine; an entry
 * deep-linked on the overview or the detail opens on that stage with none.
 */
export default function WorldPage({ world, view }: { world: WorldId; view: View }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    loadWorld(world).then(
      bundle => live && setState({ status: 'ready', bundle }),
      () => live && setState({ status: 'failed' }),
    );
    return () => {
      live = false;
    };
  }, [world]);

  const profile = useMemo(() => SHOWCASE.find(p => p.world === world), [world]);
  // The review switches in the address (development builds only: the engine ignores them in a production build), read once.
  const options = useMemo(() => parseUrlState(typeof window === 'undefined' ? '' : window.location.search), []);
  const exitFrom = useCallback(
    (opener: string | null) => {
      if (!profile) return undefined;
      const [path, query] = (opener ?? '').split('?');
      return exitFor(opener ? parseRoute(path, query ? `?${query}` : '').route : null, profile);
    },
    [profile],
  );
  const { opensOn, exit, request, onStageChange, onExitClick } = useWorldVisit({ view, opener: profile ? `/@${profile.handle}` : null, exitFrom });

  return (
    <div data-world={world} data-view={view} style={{ display: 'contents' }} onClickCapture={onExitClick}>
      {state.status === 'ready' && exit ? (
        <WorldHost bundle={state.bundle} options={options} initialStage={opensOn} onStageChange={onStageChange} stageRequest={request} exit={exit} />
      ) : (
        <main className="oct-root oct-unopened" id="oct-main" tabIndex={-1}>
          <div className="oct-glass oct-unopened-card" role="status">
            {state.status === 'failed' ? <h1>This world did not load</h1> : <h1>Loading world</h1>}
          </div>
        </main>
      )}
    </div>
  );
}
