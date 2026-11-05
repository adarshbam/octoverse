import { Component, type CSSProperties, type ReactNode, type RefObject, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { defaultReviewOptions } from '../../engine/behavior/urlState';
import { WorldHost, type HostProps } from '../../engine/host/WorldHost';
import type { WorldBundle, WorldId } from '../../engine/types/bundle';
import { type StillKey, stillFor } from '../stills/stills';
import { loadWorld } from '../worlds/loadWorld';
import { usePreviewSlot } from './previewSlot';
import { useCanPreview } from './useCanPreview';
import './livePicture.css';

/** A preview's drawing options: the host's own type, taken from its props (the platform reaches the engine through a short list of modules). */
export type PreviewOptions = NonNullable<HostProps['preview']>;

/** Leaving a card unmounts its preview after this long (spec 7.10: moving between neighbours does not thrash). */
export const UNMOUNT_AFTER_MS = 300;
/** The cross-fade between the still and the preview (spec 7.10: within 400 ms; the CSS says the same). */
export const FADE_MS = 250;
/** How many animation frames the preview's canvas must have been through before it is shown: the first ones carry the shader compiles. */
const SETTLE_FRAMES = 3;
/** A preview that has not drawn by then is left hidden: the still stays. */
const GIVE_UP_MS = 4000;

/** A preview that throws (a bundle that cannot be drawn, a lost context) leaves its still, not a broken card. */
class Contained extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('A live preview failed; its still stays.', error);
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** The longest the page may stay busy before a preview starts anyway (the idle callback's own timeout). */
const IDLE_TIMEOUT_MS = 1000;

/**
 * Whether the page has settled since this picture mounted: the route fade's overlay (`.oct-route-fade`, the shell's: spec 7.9) is gone,
 * two frames have been drawn after that, and the browser had an idle moment (or a second went by). A preview's start (the world's
 * chunk, a WebGL context, the shader compiles) is long main-thread work; begun under the fade it would hold the fade's 250 ms
 * for seconds, so the still shows until the page is quiet. Under a server render, or with no animation frames, it is not settled.
 */
function useSettled(): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let frame = 0;
    let idle = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frames = 0;
    const tick = () => {
      // The overlay can come back (a second route change); only a clear page counts, two frames running.
      frames = document.querySelector('.oct-route-fade') ? 0 : frames + 1;
      if (frames < 2) {
        frame = requestAnimationFrame(tick);
        return;
      }
      if (typeof requestIdleCallback === 'function') idle = requestIdleCallback(() => setSettled(true), { timeout: IDLE_TIMEOUT_MS });
      else timer = setTimeout(() => setSettled(true), 100);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      if (idle && typeof cancelIdleCallback === 'function') cancelIdleCallback(idle);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);
  return settled;
}

/** The world's bundle, asked for from `want` on (a failed or slow load leaves it null: the still stays). */
function useBundle(world: WorldId, want: boolean): WorldBundle | null {
  const [loaded, setLoaded] = useState<{ world: WorldId; bundle: WorldBundle } | null>(null);
  useEffect(() => {
    if (!want || loaded?.world === world) return;
    let live = true;
    loadWorld(world).then(
      bundle => live && setLoaded({ world, bundle }),
      () => {
        /* a failed fetch is forgotten by the loader: the next hover tries again; the still stays meanwhile */
      },
    );
    return () => {
      live = false;
    };
  }, [world, want, loaded]);
  return loaded?.world === world ? loaded.bundle : null;
}

/** Whether the preview's canvas has drawn a few frames (so the fade shows a picture, not the water it starts as). */
function useDrawn(layer: RefObject<HTMLElement | null>, mounted: boolean): boolean {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!mounted) {
      setDrawn(false);
      return;
    }
    let frame = 0;
    let frames = 0;
    const started = performance.now();
    const tick = () => {
      if (layer.current?.querySelector('canvas')) {
        if (++frames >= SETTLE_FRAMES) return setDrawn(true);
      } else if (performance.now() - started > GIVE_UP_MS) return;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [layer, mounted]);
  return drawn;
}

/**
 * A picture that is an engine still at rest and a live preview of its world while it is `live` (spec 7.10, 7.14): the still is
 * always there; once `live` is true and the platform's one preview slot is granted, the world's bundle is fetched (`loadWorld`,
 * the platform's only door to a bundle) and a `mode: 'preview'` instance cross-fades in over the still; when `live` turns false
 * the preview fades out at once and is unmounted 300 ms later (a card entered again before then keeps it). Asking for the slot
 * unmounts whoever held it. Nothing starts until the page has settled (`useSettled`: the route fade is over and the page is idle),
 * the still shows meanwhile. Phones, touch screens and reduced motion get the still only, always. The picture fills its parent
 * (which is positioned and clips; the CSS covers the stills' crop for the preview too).
 *
 * `into`: where the preview's layer goes when it cannot sit beside the still. The engine's instance holds buttons of its own
 * (its closed detail panel), and a card is itself a button: a card gives an element beside it, over its picture, and the layer
 * is drawn there (nothing until that element exists). Left out, the layer sits in the picture.
 *
 * The brief's `bundle: WorldBundle` is the world's id here: the platform must not import a bundle statically (spec 2.4), so
 * the picture asks `loadWorld` for it.
 */
export function LivePicture({ still, world, options, live, into }: { still: StillKey; world: WorldId; options: PreviewOptions; live: boolean; into?: Element | null }) {
  const owner = useId();
  const image = stillFor(still);
  const can = useCanPreview();
  const settled = useSettled();
  const wanted = live && can && settled;
  const granted = usePreviewSlot(owner, wanted, UNMOUNT_AFTER_MS);
  const bundle = useBundle(world, wanted);
  const [failed, setFailed] = useState(false);
  const mounted = granted && can && bundle !== null && !failed;
  const layer = useRef<HTMLSpanElement>(null);
  const drawn = useDrawn(layer, mounted);
  // The host reads these at mount; one object per picture.
  const hostOptions = useMemo(() => defaultReviewOptions(), []);
  const layerNode = mounted && (
    <span ref={layer} className={`oct-live-layer${live && drawn ? ' is-on' : ''}`} style={{ '--oct-still-w': image.width, '--oct-still-h': image.height } as CSSProperties} aria-hidden="true" inert>
      <Contained onFail={() => setFailed(true)}>
        <WorldHost bundle={bundle} options={hostOptions} mode="preview" preview={options} ui="none" />
      </Contained>
    </span>
  );
  return (
    <>
      <span className="oct-live-picture" data-state={mounted ? (live && drawn ? 'live' : 'loading') : 'still'}>
        <img className="oct-still" src={image.src} width={image.width} height={image.height} alt="" decoding="async" draggable={false} />
        {into === undefined && layerNode}
      </span>
      {into && layerNode && createPortal(layerNode, into)}
    </>
  );
}
