import { useEffect, useRef, useState } from 'react';
import type { StageId } from '../engine/config/types';
import type { LinkStage } from '../engine/behavior/stageMachine';
import { type ReviewOptions, parseUrlState } from '../engine/behavior/urlState';
import { NOX_BUNDLE } from '../nox3d/bundle.nox';
import { WorldHost } from '../nox3d/host/WorldHost';
import { useInstanceApi } from '../nox3d/host/useInstanceApi';
import type { WorldBundle } from '../nox3d/types/bundle';

/**
 * Development only (reached from multi.html with `?embed=1`; nothing in the production build imports
 * it): a page that hosts the way the platform will, for tests/e2e/embedding.spec.ts. A page instance
 * of Nox with the options below, its own buttons and cards reading the instance (`useInstanceApi`),
 * and, when asked, one preview beside it. The URL says how:
 *   ?ui=none|engine         the page instance's UI (default none)
 *   ?exit=1                 gives it an exit link
 *   ?init=intro|overview|detail   its initialStage (default intro)
 *   ?opts=<options>         the page instance's review options, URL-encoded (`freeze`)
 *   ?prev=hidden|settled    mounts a preview beside it, with those artifacts (none: no preview)
 *   ?pstage=intro|overview|detail  the preview's stage (default overview)
 * The page logs each stage it is told of in `window.__embed.stages`.
 */
declare global {
  interface Window {
    __embed?: { stages: StageId[] };
  }
}

const STAGES: readonly LinkStage[] = ['intro', 'overview', 'detail'];
const linkStage = (value: string | null, fallback: LinkStage): LinkStage => (STAGES as readonly (string | null)[]).includes(value) ? (value as LinkStage) : fallback;

/** The page's own controls, in the instance: they read and drive it through the API alone. */
function Controls() {
  const api = useInstanceApi();
  return (
    <>
      <output data-testid="stage" style={{ position: 'absolute', left: 8, bottom: 8 }}>{api.stage}</output>
      <button type="button" data-testid="explore" style={{ position: 'absolute', left: 8, bottom: 40 }} onClick={api.explore}>
        Explore
      </button>
      <button type="button" data-testid="back" style={{ position: 'absolute', left: 100, bottom: 40 }} onClick={api.back}>
        Back
      </button>
    </>
  );
}

/** Two HTML cards, one at each side: hovering or focusing one makes the character look at it and reach for it. */
function Cards() {
  const { attend } = useInstanceApi();
  const root = useRef<HTMLDivElement>(null);
  const aim = (card: HTMLElement) => {
    const canvas = root.current?.closest('.spike')?.querySelector('canvas')?.getBoundingClientRect();
    const box = card.getBoundingClientRect();
    if (canvas) attend({ x: box.left + box.width / 2 - canvas.left, y: box.top + box.height / 2 - canvas.top }, { reach: true });
  };
  return (
    <div ref={root}>
      {(['left', 'right'] as const).map(side => (
        <button
          key={side}
          type="button"
          data-card={side}
          style={{ position: 'absolute', top: '58%', [side]: '3%', width: 120, height: 90 }}
          onFocus={event => aim(event.currentTarget)}
          onBlur={() => attend(null)}
          onPointerEnter={event => aim(event.currentTarget)}
          onPointerLeave={() => attend(null)}
        >
          {side} card
        </button>
      ))}
    </div>
  );
}

/** The same Nox with one colour of its theme changed: a new bundle object with the same id. */
const edited = (): WorldBundle => ({ ...NOX_BUNDLE, theme: { ...NOX_BUNDLE.theme, accent: '#00c2ff' } });

export function Embedding({ params }: { params: URLSearchParams }) {
  const ui = params.get('ui') === 'engine' ? 'engine' : 'none';
  const exit = params.has('exit') ? { label: 'Back to the hub', href: '#hub' } : undefined;
  const initial = linkStage(params.get('init'), 'intro');
  // Made once: the host reads its options by identity.
  const [options] = useState<ReviewOptions>(() => parseUrlState(params.get('opts') ?? ''));
  const [previewOptions] = useState<ReviewOptions>(() => parseUrlState(''));
  const artifacts = params.get('prev');
  const [bundle, setBundle] = useState<WorldBundle>(NOX_BUNDLE);
  const [request, setRequest] = useState<{ id: number; stage: LinkStage } | undefined>();
  const [told, setTold] = useState<StageId[]>([]);
  useEffect(() => {
    window.__embed = { stages: told };
  }, [told]);
  return (
    <>
      <div className="multi-bar" style={{ display: 'flex', gap: 6 }}>
        {STAGES.map(stage => (
          <button key={stage} type="button" data-request={stage} onClick={() => setRequest(r => ({ id: (r?.id ?? 0) + 1, stage }))}>
            request {stage}
          </button>
        ))}
        <button type="button" data-testid="replace" onClick={() => setBundle(edited())}>
          replace bundle
        </button>
      </div>
      <div className="cell" data-slot="a">
        <WorldHost
          bundle={bundle}
          options={options}
          ui={ui}
          exit={exit}
          initialStage={initial}
          stageRequest={request}
          onStageChange={stage => setTold(list => [...list, stage])}
        >
          <Controls />
          <Cards />
        </WorldHost>
      </div>
      {(artifacts === 'hidden' || artifacts === 'settled') && (
        <div className="cell" data-slot="b">
          <WorldHost
            bundle={NOX_BUNDLE}
            options={previewOptions}
            mode="preview"
            preview={{ stage: linkStage(params.get('pstage'), 'overview'), motion: 'still', place: 'backdrop', artifacts }}
          />
        </div>
      )}
    </>
  );
}
