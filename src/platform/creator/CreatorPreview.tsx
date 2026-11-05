import { type CSSProperties, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { defaultReviewOptions } from '../../engine/behavior/urlState';
import { WorldHost } from '../../engine/host/WorldHost';
import { type InstanceApi, useInstanceApi } from '../../engine/host/useInstanceApi';
import type { WorldBundle } from '../../engine/types/bundle';
import { Contained, type PreviewOptions, useDrawn, useSettled } from '../previews/LivePicture';
import { usePreviewSlot } from '../previews/previewSlot';
import { useCanPreview, usePrefersReducedMotion } from '../previews/useCanPreview';
import { stillFor } from '../stills/stills';
import { CreatorStill } from '../pages/parts';
import { assembleBundle } from './assembleBundle';
import { draftToContent } from './draftToContent';
import { PALETTE_NAMES, PERSONALITY_NAMES, TEMPLATE_NAMES, type CreatorDraft } from './types';
import { type ExpressionId, REMOUNT_FADE_MS, type PresetChange, type Reaction, reactionFor, wigglePath } from './reactions';
import { TEMPLATES } from './templates';
import '../previews/livePicture.css';

// The live preview in the centre of the creator (platform spec 7.13, 7.14): the octopus exactly as visitors will see it on its
// template's backdrop (water, fog and light; no kit), `stage: 'intro'`, ambient motion, artifacts settled, the chosen project's
// technologies, tier capped at low. The creator still of the template and palette is always under it and is all there is on a
// phone, with reduced motion, while another preview holds the slot, and when the preview fails.
//
// ENGINE LIMIT (E02b, recorded in reviews/platform.md): a running instance reads its bundle once, at mount, and is keyed on the bundle
// OBJECT, so a new character colour, personality, template or technology list is a NEW instance (a new canvas), never an update of the
// running one. The preview therefore does what the engine allows: the layer fades out in 200 ms, the still of the new colours shows
// at once (so the colour answer is immediate), and a new instance is mounted after the fade and fades in when it has drawn. A name
// is not drawn in the preview, so it never remounts. Rapid changes are coalesced: one new instance for a burst.

/** A burst of changes mounts one new instance: the old layer has faded out (REMOUNT_FADE_MS) by the time it is replaced. */
const COALESCE_MS = REMOUNT_FADE_MS;
/** A name reaction waits for the typing to pause. */
const NAME_PAUSE_MS = 500;
/** The face of a blink: the half-lidded `restful` one, held this long before the smile. */
const BLINK_MS = 150;
/** A reaction that needs the new instance (the wiggle, a face) is dropped if the instance has not drawn within this long. */
const PENDING_MS = 6000;

/** The one preview's drawing options (spec 7.13). The stage is read at mount: the toggle changes it with `stageRequest`. */
const previewFor = (overview: boolean): PreviewOptions => ({ stage: overview ? 'overview' : 'intro', tierCap: 'low', motion: 'ambient', place: 'backdrop', artifacts: 'settled' });

const ids = new WeakMap<WorldBundle, number>();
let nextId = 0;
/** A React key for a bundle object (a new object is a new instance, as in the engine's own key). */
const idOf = (bundle: WorldBundle) => {
  let id = ids.get(bundle);
  if (id === undefined) ids.set(bundle, (id = ++nextId));
  return id;
};

/** The value after it has held still for `ms`. */
function useCoalesced<T>(value: T, ms: number): T {
  const [held, setHeld] = useState(value);
  useEffect(() => {
    if (Object.is(held, value)) return;
    const timer = setTimeout(() => setHeld(value), ms);
    return () => clearTimeout(timer);
  }, [value, held, ms]);
  return held;
}

/** Gives the preview the running instance's API (inside the host: `useInstanceApi` needs it). */
function ApiTap({ onApi }: { onApi: (api: InstanceApi | null) => void }) {
  const api = useInstanceApi();
  useEffect(() => {
    onApi(api);
    return () => onApi(null);
  }, [api, onApi]);
  return null;
}

/** One live instance of one bundle, in its own layer; `show` fades it in once its canvas has drawn. */
function Layer({ bundle, size, options, request, overview, show, onDrawn, onFail, onApi }: { bundle: WorldBundle; size: { width: number; height: number }; options: ReturnType<typeof defaultReviewOptions>; request?: { id: number; stage: 'intro' | 'overview' }; overview: boolean; show: boolean; onDrawn: () => void; onFail: () => void; onApi: (api: InstanceApi | null) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const drawn = useDrawn(ref, true);
  const told = useRef(onDrawn);
  useEffect(() => {
    told.current = onDrawn;
  });
  useEffect(() => {
    if (drawn) told.current();
  }, [drawn]);
  const preview = useMemo(() => previewFor(overview), [overview]);
  return (
    <span ref={ref} className={`oct-live-layer${drawn && show ? ' is-on' : ''}`} style={{ '--oct-still-w': size.width, '--oct-still-h': size.height } as CSSProperties} aria-hidden="true" inert data-creator-layer="">
      <Contained onFail={onFail}>
        <WorldHost bundle={bundle} options={options} mode="preview" preview={preview} ui="none" stageRequest={request}>
          <ApiTap onApi={onApi} />
        </WorldHost>
      </Contained>
    </span>
  );
}

/**
 * The centre of the creator: the live preview of the assembled bundle over its still, a toggle for the overview pose, the caption
 * and the octopus's reactions to each preset change. `active` is false while the draft is not the visitor's yet (loading, discarding):
 * changes then are not reacted to.
 */
export function CreatorPreview({ draft, selectedProjectId, active = true }: { draft: CreatorDraft; selectedProjectId: string | null; active?: boolean }) {
  const { template, palette, personality, name } = draft.octopus;
  const owner = useId();
  const can = useCanPreview();
  const reduced = usePrefersReducedMotion();
  const settled = useSettled();
  const granted = usePreviewSlot(owner, can && settled, 0);

  // The bundle the preview draws. What the engine draws of it is the template, palette, personality and the project's technologies:
  // the name, handle and texts are not drawn (`ui: 'none'`), so they do not make a new bundle (typing a name must not remount).
  const chosen = draft.projects.find(p => p.id === selectedProjectId) ?? draft.projects[0];
  const techKey = chosen ? chosen.technologies.join(',') : '';
  const latest = useRef(draft);
  latest.current = draft;
  const target = useMemo(
    () => {
      const current = latest.current;
      return assembleBundle(TEMPLATES[template], { palette, personality, name: current.octopus.name, handle: current.profile.handle }, draftToContent(current, selectedProjectId));
    },
    // techKey stands for the chosen project's technologies (the only part of the content the preview draws)
    [template, palette, personality, techKey, chosen?.id],
  );
  const bundle = useCoalesced(target, COALESCE_MS);
  const stale = bundle !== target;

  const [failedFor, setFailedFor] = useState<WorldBundle | null>(null);
  const failed = failedFor === bundle;
  const mounted = granted && can && !failed;

  // The overview pose toggle: a request to the running instance (no remount); a new instance opens on the pose it was left in.
  const [overview, setOverview] = useState(false);
  const [request, setRequest] = useState<{ id: number; stage: 'intro' | 'overview' } | undefined>();
  const toggle = () => {
    const next = !overview;
    setOverview(next);
    setRequest(r => ({ id: (r?.id ?? 0) + 1, stage: next ? 'overview' : 'intro' }));
  };

  // ---- reactions (spec 7.13) ----
  const [face, setFace] = useState<ExpressionId | undefined>();
  const [shimmer, setShimmer] = useState(0);
  const [reacting, setReacting] = useState<PresetChange | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const labelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nameTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const api = useRef<InstanceApi | null>(null);
  const picture = useRef<HTMLDivElement>(null);
  const pending = useRef<{ reaction: Reaction; at: number } | null>(null);
  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  const onApi = useCallback((next: InstanceApi | null) => {
    api.current = next;
  }, []);

  /** The part of a reaction that needs a running instance: the face (with the blink before it) and the wiggle. */
  const playLive = useCallback(
    (r: Reaction) => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      const hold = r.expression ?? (r.blink ? 'happy' : undefined);
      if (r.blink) {
        setFace('restful');
        later(BLINK_MS, () => setFace(hold));
      } else if (hold) setFace(hold);
      if (hold) later(r.holdMs, () => setFace(undefined));
      if (r.wiggle) {
        const canvas = picture.current?.querySelector('canvas');
        const box = canvas?.getBoundingClientRect();
        if (box) for (const step of wigglePath(box.width, box.height)) later(step.at, () => api.current?.attend(step.target, { reach: false }));
      }
    },
    [later],
  );

  const react = useCallback(
    (change: PresetChange) => {
      const r = reactionFor(change);
      if (r === 'remount') return;
      setReacting(change);
      // Its own timer: playing the live part (a new instance has drawn) restarts the others, not the label.
      clearTimeout(labelTimer.current);
      labelTimer.current = setTimeout(() => setReacting(null), r.holdMs);
      if (r.shimmer && !reduced) setShimmer(n => n + 1);
      if (!r.wiggle && !r.expression && !r.blink) return;
      // A palette or personality is a new bundle: its instance does not exist yet, so the live part waits for it to have drawn.
      if (change === 'name') playLive(r);
      else pending.current = { reaction: r, at: performance.now() };
    },
    [playLive, reduced],
  );

  const previous = useRef(draft.octopus);
  useEffect(() => {
    const was = previous.current;
    previous.current = draft.octopus;
    if (!active || was === draft.octopus) return;
    if (was.template !== template) return;
    if (was.palette !== palette) react('palette');
    if (was.personality !== personality) react('personality');
    if (was.name !== name) {
      clearTimeout(nameTimer.current);
      nameTimer.current = setTimeout(() => react('name'), NAME_PAUSE_MS);
    }
  }, [draft.octopus, active, template, palette, personality, name, react]);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      clearTimeout(nameTimer.current);
      clearTimeout(labelTimer.current);
    },
    [],
  );

  const onDrawn = useCallback(() => {
    const waiting = pending.current;
    pending.current = null;
    if (waiting && performance.now() - waiting.at < PENDING_MS) playLive(waiting.reaction);
  }, [playLive]);

  const hostOptions = useMemo(() => ({ ...defaultReviewOptions(), ...(face ? { expression: face } : {}) }), [face]);
  const displayName = name.trim() === '' ? 'Your Octopus' : name.trim();
  const still = stillFor({ kind: 'creator', template, palette });

  return (
    <section className="oct-creator-preview" data-slot="preview" aria-label="Octopus preview">
      <div ref={picture} className="oct-creator-picture" data-state={mounted ? (stale ? 'changing' : 'live') : 'still'} data-template={template} data-palette={palette} data-personality={personality} data-still={still.src} data-reaction={reacting ?? ''}>
        <CreatorStill template={template} palette={palette} alt={`${displayName}, ${TEMPLATE_NAMES[template]} template in ${PALETTE_NAMES[palette]}`} />
        {mounted && <Layer key={`layer-${idOf(bundle)}`} bundle={bundle} size={still} options={hostOptions} request={request} overview={overview} show={!stale} onDrawn={onDrawn} onFail={() => setFailedFor(bundle)} onApi={onApi} />}
        {shimmer > 0 && (
          <span key={`shimmer-${shimmer}`} className="oct-shimmer" aria-hidden="true" data-shimmer={shimmer}>
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} style={{ '--i': i } as CSSProperties} />
            ))}
          </span>
        )}
        {can && !failed && (
          <button type="button" className="oct-creator-overview" aria-pressed={overview} onClick={toggle}>
            Overview
          </button>
        )}
      </div>
      <p className="oct-creator-caption">
        <b>{displayName}</b>
        <span>{`${TEMPLATE_NAMES[template]} · ${PALETTE_NAMES[palette]} · ${PERSONALITY_NAMES[personality]}`}</span>
      </p>
      <p className="oct-creator-note">{can ? 'Live: this is how visitors will see your octopus.' : 'A picture of your octopus. The live preview needs a desktop screen with motion allowed.'}</p>
    </section>
  );
}

