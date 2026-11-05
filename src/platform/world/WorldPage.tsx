import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LinkStage } from '../../engine/behavior/stageMachine';
import { parseUrlState } from '../../engine/behavior/urlState';
import { WorldHost } from '../../engine/host/WorldHost';
import type { WorldBundle, WorldId } from '../../engine/types/bundle';
import { SHOWCASE } from '../fixtures/showcase';
import { entryState, goBack, insertOpener, navigate } from '../router/history';
import { type View, parseRoute } from '../router/routes';
import { loadWorld } from '../worlds/loadWorld';
import { type EngineSync, type StageId, exitFor, exitMove, reported, requested, viewToRequest, worldHistoryStep } from './worldHistory';
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
  // The stage the page opens on: the view it was entered at. An intro entry opens as the engine decides (the entrance, once per session).
  const [opensOn] = useState<LinkStage | undefined>(view === 'intro' ? undefined : view);

  // A page that was deep-linked has none before it in this tab: the profile becomes the entry behind it (spec 7.9), so Back goes there.
  const [opener, setOpener] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (opensOn !== undefined && profile) insertOpener(`/@${profile.handle}`);
    setOpener(entryState()?.opener || null);
  }, [opensOn, profile]);
  const exit = useMemo(() => {
    if (!profile || opener === undefined) return undefined;
    const [path, query] = (opener ?? '').split('?');
    return exitFor(opener ? parseRoute(path, query ? `?${query}` : '').route : null, profile);
  }, [profile, opener]);

  // The route asks for the stage: a new view that the engine did not itself just push is a Back or a Forward, and the engine is asked for it.
  const viewNow = useRef(view);
  viewNow.current = view;
  const seen = useRef(view);
  const pushed = useRef<View | null>(null);
  // What the engine has been asked for and has told us: its reports that answer a request are not the visitor's moves (see EngineSync).
  const sync = useRef<EngineSync>({ engine: opensOn ?? 'intro', pending: false });
  // The address this page was opened at: a stage reported after the visitor has left it (a quick Back while the world is busy) is not an entry of any other page.
  const [path] = useState(() => (typeof window === 'undefined' ? '' : window.location.pathname));
  const [request, setRequest] = useState<{ id: number; stage: LinkStage } | undefined>();
  useEffect(() => {
    if (seen.current === view) return;
    seen.current = view;
    if (pushed.current === view) {
      pushed.current = null;
      return;
    }
    sync.current = requested(sync.current, view);
    setRequest(previous => viewToRequest(view, (previous?.id ?? 0) + 1));
  }, [view]);

  // The stage asks for the route.
  const onStageChange = useCallback(
    (stage: StageId) => {
      const heard = reported(sync.current, stage);
      sync.current = heard.sync;
      if (heard.echo || window.location.pathname !== path) return;
      const step = worldHistoryStep({ view: viewNow.current }, stage);
      if (!step?.push) return;
      pushed.current = step.push;
      const params = new URLSearchParams(window.location.search);
      params.set('view', step.push);
      navigate(`${path}?${params}`);
    },
    [path],
  );

  // The world's exit control is the engine's own anchor; the platform takes its press as a route change (Back when the page it names is
  // the entry before this one, otherwise a push), and leaves a modified click or a middle click to the browser.
  const onExit = (event: MouseEvent<HTMLElement>) => {
    const link = (event.target as Element).closest?.('a.exit-link');
    if (!link || !exit || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (exitMove(exit, entryState()) === 'back') goBack();
    else navigate(exit.href, { from: link });
  };

  return (
    <div data-world={world} data-view={view} style={{ display: 'contents' }} onClickCapture={onExit}>
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
