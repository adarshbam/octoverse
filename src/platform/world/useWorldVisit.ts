import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LinkStage } from '../../engine/behavior/stageMachine';
import { entryState, goBack, insertOpener, navigate } from '../router/history';
import { type View, parseRoute } from '../router/routes';
import { type EngineSync, type Settling, type StageId, duringSettle, exitMove, reported, requested, settleLanded, settleMove, settleStarted, viewToRequest, worldHistoryStep } from './worldHistory';

/** How long a settling pop may take to land before a held step-down is judged anyway. */
const SETTLE_SAFETY_MS = 1500;

/** The world's exit control as the host takes it. */
export interface Exit {
  label: string;
  href: string;
}

/**
 * The history of ONE visit to a full-page world (platform spec 7.9), shared by a showcase world's page (`/@<handle>/<project>`) and the
 * creator's full preview (`/create/preview`): both are a page instance of the host with an `exit`, whose stage changes are `?view=`
 * entries and whose Back and Forward are stage requests. The caller gives the `view` its route says, the page that opens it
 * (`opener`: where a deep link's Back goes, null for none) and how that page turns into the exit control (`exitFrom`, stable). It
 * returns what to give the host (`initialStage`, `onStageChange`, `stageRequest`, `exit`) and the click handler for the exit control.
 *
 * The stage the engine moves to asks for the route (`onStageChange`: the overview and the detail are pushed as `?view=`, a technology
 * focus and the engine's own Escape never are), and the route asks for the stage (a browser Back or Forward to another view of this
 * visit is a `stageRequest`). The entrance plays once per session, by the engine; an entry deep-linked on the overview or the detail
 * opens on that stage with none.
 */
export function useWorldVisit({ view, opener, exitFrom }: { view: View; opener: string | null; exitFrom: (opener: string | null) => Exit | undefined }) {
  // The stage the page opens on: the view it was entered at. An intro entry opens as the engine decides (the entrance, once per session).
  const [opensOn] = useState<LinkStage | undefined>(view === 'intro' ? undefined : view);

  // A page that was deep-linked has none before it in this tab: the opener becomes the entry behind it (spec 7.9), so Back goes there.
  const [openedBy, setOpenedBy] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (opensOn !== undefined && opener) insertOpener(opener);
    setOpenedBy(entryState()?.opener || null);
  }, [opensOn, opener]);
  const exit = useMemo(() => (openedBy === undefined ? undefined : exitFrom(openedBy)), [exitFrom, openedBy]);

  // The route asks for the stage: a new view that the engine did not itself just push is a Back or a Forward, and the engine is asked for it.
  const viewNow = useRef(view);
  viewNow.current = view;
  const seen = useRef(view);
  const pushed = useRef<View | null>(null);
  // What the engine has been asked for and has told us: its reports that answer a request are not the visitor's moves (see EngineSync).
  const sync = useRef<EngineSync>({ engine: opensOn ?? 'intro', pending: false });
  // The address this page was opened at: a stage reported after the visitor has left it (a quick Back while the world is busy) is not an entry of any other page.
  const [path] = useState(() => (typeof window === 'undefined' ? '' : window.location.pathname));
  const settling = useRef<Settling>({ inflight: false, queued: null });
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const process = useRef<(stage: StageId) => void>(() => {});
  useEffect(() => () => clearTimeout(settleTimer.current), []);
  const [request, setRequest] = useState<{ id: number; stage: LinkStage } | undefined>();
  useEffect(() => {
    if (seen.current === view) return;
    seen.current = view;
    if (pushed.current === view) {
      pushed.current = null;
      // A settling pop has landed: a step-down held meanwhile is judged now, against the view and entry the visitor is on.
      const landed = settleLanded(settling.current);
      settling.current = landed.settling;
      clearTimeout(settleTimer.current);
      if (landed.replay !== null) process.current(landed.replay);
      return;
    }
    sync.current = requested(sync.current, view);
    setRequest(previous => viewToRequest(view, (previous?.id ?? 0) + 1));
  }, [view]);

  // The stage asks for the route.
  const processStage = useCallback(
    (stage: StageId) => {
      const step = worldHistoryStep({ view: viewNow.current }, stage);
      if (step?.settle) {
        // The engine stepped down itself: the address follows, without a new entry and without leaving the world's page.
        pushed.current = step.settle;
        const before = entryState()?.prev;
        const [prevPath, prevQuery] = (before ?? '').split('?');
        const previous = before && prevPath === path ? ((parseRoute(prevPath, prevQuery ? `?${prevQuery}` : '').route as { view?: View }).view ?? null) : null;
        if (settleMove(previous, step.settle) === 'back') {
          // The pop lands a popstate later: a second step-down in between is held until then (two quick Escapes). A safety timer lets go if it never lands.
          settling.current = settleStarted();
          clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(() => {
            const landed = settleLanded(settling.current);
            settling.current = landed.settling;
            if (landed.replay !== null) process.current(landed.replay);
          }, SETTLE_SAFETY_MS);
          goBack();
        } else {
          const params = new URLSearchParams(window.location.search);
          if (step.settle === 'intro') params.delete('view');
          else params.set('view', step.settle);
          const rest = params.toString();
          navigate(rest ? `${path}?${rest}` : path, { replace: true });
        }
        return;
      }
      if (!step?.push) return;
      pushed.current = step.push;
      const params = new URLSearchParams(window.location.search);
      params.set('view', step.push);
      navigate(`${path}?${params}`);
    },
    [path],
  );
  process.current = processStage;
  const onStageChange = useCallback(
    (stage: StageId) => {
      const heard = reported(sync.current, stage);
      sync.current = heard.sync;
      if (heard.echo || window.location.pathname !== path) return;
      const held = duringSettle(settling.current, stage);
      settling.current = held.settling;
      if (!held.hold) process.current(stage);
    },
    [path],
  );

  // The world's exit control is the engine's own anchor; the platform takes its press as a route change (Back when the page it names is
  // the entry before this one, otherwise a push), and leaves a modified click or a middle click to the browser.
  const onExitClick = (event: MouseEvent<HTMLElement>) => {
    const link = (event.target as Element).closest?.('a.exit-link');
    if (!link || !exit || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (exitMove(exit, entryState()) === 'back') goBack();
    else navigate(exit.href, { from: link });
  };

  return { opensOn, exit, request, onStageChange, onExitClick };
}
