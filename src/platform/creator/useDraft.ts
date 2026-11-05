import { useCallback, useEffect, useRef, useState } from 'react';
import { INITIAL_VIEW, createDraftController, type DraftController, type DraftView } from './draftController';
import type { DraftStore } from './storage';
import type { CreatorDraft } from './types';

export { AUTOSAVE_MS, DISCARD_ERROR, announcement, createAutosaver, statusLabel, type Autosaver, type SaveStatus } from './draftController';

export interface UseDraft extends DraftView {
  /** Changes the draft with a pure function (the helpers of draftEdits.ts); it autosaves 800 ms after the last change. */
  update(fn: (draft: CreatorDraft) => CreatorDraft): void;
  /**
   * Clears the stored draft and its images, and goes back to the sample, but only when the browser's copy is really cleared; if not,
   * the draft stays and `discardError` says so (the caller retries). The caller asks for confirmation first.
   */
  discard(): Promise<{ cleared: boolean }>;
  /** Keeps an image in this browser (the media store) and returns its id; rejects with a MediaError for a file it must refuse. */
  putMedia(blob: Blob): Promise<string>;
  /** The stored image with this id, or null. */
  getMedia(id: string): Promise<Blob | null>;
}

/**
 * The creator's draft (spec 7.13): the stored one (migrated) or the sample; every change autosaves. If IndexedDB is not available
 * the creator still works in memory and `status` is "memory". The pending change is saved on unmount and when the page is hidden.
 * `createStore` is for tests. The logic is draftController.ts (tested without a DOM); this is the React binding.
 */
export function useDraft(createStore?: () => Promise<DraftStore>): UseDraft {
  const [view, setView] = useState<DraftView>(INITIAL_VIEW);
  const controller = useRef<DraftController | null>(null);

  useEffect(() => {
    const own = createDraftController({ createStore });
    controller.current = own;
    const off = own.subscribe(() => setView(own.getView()));
    own.start();
    const flush = () => own.flush();
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hidden);
      off();
      own.dispose();
      controller.current = null;
    };
  }, [createStore]);

  const update = useCallback((fn: (draft: CreatorDraft) => CreatorDraft) => controller.current?.update(fn), []);
  const discard = useCallback(() => controller.current?.discard() ?? Promise.resolve({ cleared: false }), []);
  const putMedia = useCallback((blob: Blob) => controller.current?.putMedia(blob) ?? Promise.reject(new Error('The draft is not open.')), []);
  const getMedia = useCallback((id: string) => controller.current?.getMedia(id) ?? Promise.resolve(null), []);
  return { ...view, update, discard, putMedia, getMedia };
}
