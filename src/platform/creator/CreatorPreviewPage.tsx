import { useEffect, useMemo, useState } from 'react';
import { parseUrlState } from '../../engine/behavior/urlState';
import { WorldHost } from '../../engine/host/WorldHost';
import type { WorldBundle } from '../../engine/types/bundle';
import type { View } from '../router/routes';
import { type Exit, useWorldVisit } from '../world/useWorldVisit';
import { readStoredDraft } from './localDraft';
import { chooseProject, mediaIdsOf, previewBundleFor, previewDraftFrom, projectIdFrom } from './previewDraft';
import { clearHandoff, peekHandoff } from './previewHandoff';
import { createDraftStore, type DraftStore } from './storage';
import '../ui/glass.css';

/** The preview's way out (spec 7.9): the creator it was opened from. */
const EXIT: Exit = { label: 'Back to the creator', href: '/create' };
/** Stable, so the visit's exit does not change between renders. */
const exitFrom = () => EXIT;

type State = { status: 'reading' } | { status: 'ready'; bundle: WorldBundle; project: string; technologies: number };

/**
 * The creator's full preview (`/create/preview`, spec 7.8, 7.13), loaded as its own chunk: the visitor's draft as a full world. It
 * takes the draft the creator handed over when it opened (the draft as it is on screen: an edit under 800 ms old, or a draft the browser
 * cannot keep, is not in the store yet; previewHandoff.ts), otherwise reads the stored draft ONCE without creating the creator's database
 * (localDraft.readStoredDraft: it saves, deletes and writes nothing; no stored draft, or an unreadable one, is the sample draft, as in the creator), takes the project the creator's "See live preview" named (`?project=<id>`;
 * the first project otherwise, also for an id the draft does not have), assembles the template's FULL world for it (assembleBundle:
 * a new bundle object, the template's and the showcase's own objects never assigned into) and mounts the host as the page instance
 * with an `exit` back to `/create`. There is no navigation bar: the engine's exit control is the only platform affordance.
 *
 * The history is a world visit's (useWorldVisit, shared with the showcase worlds' page): `?view=` entries for the overview and the
 * detail, Back and Forward as stage requests, the exit control the same as Back when `/create` is the entry before this one. A draft
 * with no project, or a project with no technologies or sections, still opens the intro with an empty overview (previewDraft.test.ts
 * holds that the engine accepts every such bundle). Nothing here reaches the network: the images of the project are object urls of
 * the browser's own stored files, revoked when the page is left.
 */
export default function CreatorPreviewPage({ view = 'intro' }: { view?: View }) {
  const [state, setState] = useState<State>({ status: 'reading' });
  useEffect(() => {
    document.title = 'Preview · OctoVerse'; // until the world is up and its host sets the draft's own title (the shell leaves this page's title to the host)
    let live = true;
    const urls: string[] = [];
    void (async () => {
      // The draft as the creator left it on screen (see previewHandoff.ts), else the stored one, read WITHOUT creating the creator's database.
      const handed = peekHandoff();
      const stored = handed ? null : await readStoredDraft();
      const draft = previewDraftFrom(handed?.draft ?? null, stored);
      const project = chooseProject(draft, projectIdFrom(window.location.search));
      // A stored image is read through the creator's store only when a stored draft exists (so the database exists and is not created).
      let store: DraftStore | null = null;
      const media: Record<string, string> = {};
      for (const id of mediaIdsOf(draft, project)) {
        try {
          let blob: Blob | null = null;
          if (handed) blob = (await handed.media[id]) ?? null;
          else if (stored !== null) blob = await (store ??= await createDraftStore()).getMedia(id);
          if (!live) return;
          if (blob) urls.push((media[id] = URL.createObjectURL(blob)));
        } catch {
          // an image that cannot be read is left out
        }
      }
      if (!live) return;
      clearHandoff();
      const bundle = previewBundleFor(draft, project, media);
      setState({ status: 'ready', bundle, project: project ?? '', technologies: bundle.content.technologies.length });
    })();
    return () => {
      live = false;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  // The review switches in the address (development builds only: the engine ignores them in a production build), read once.
  const options = useMemo(() => parseUrlState(typeof window === 'undefined' ? '' : window.location.search), []);
  const { opensOn, exit, request, onStageChange, onExitClick } = useWorldVisit({ view, opener: '/create', exitFrom });

  const ready = state.status === 'ready' ? state : null;
  return (
    <div data-world={ready?.bundle.id} data-preview="draft" data-project={ready?.project} data-tech-count={ready?.technologies} data-view={view} style={{ display: 'contents' }} onClickCapture={onExitClick}>
      {ready && exit ? (
        <WorldHost bundle={ready.bundle} options={options} initialStage={opensOn} onStageChange={onStageChange} stageRequest={request} exit={exit} />
      ) : (
        <main className="oct-root oct-unopened" id="oct-main" tabIndex={-1}>
          <div className="oct-glass oct-unopened-card" role="status">
            <h1>Loading preview</h1>
          </div>
        </main>
      )}
    </div>
  );
}
