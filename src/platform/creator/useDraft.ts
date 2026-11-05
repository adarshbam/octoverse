import { useCallback, useEffect, useRef, useState } from 'react';
import { migrateDraft } from './draft';
import { SAMPLE_DRAFT } from './sampleDraft';
import { createDraftStore, type DraftStore } from './storage';
import type { CreatorDraft } from './types';

/** "saved" is kept in this browser, "saving" is waiting for or in a save, "memory" is kept in this tab only (the browser cannot save). */
export type SaveStatus = 'saved' | 'saving' | 'memory';

/** An edit autosaves this long after the last change (spec 7.13). */
export const AUTOSAVE_MS = 800;

export interface Autosaver {
  /** The draft to keep: replaces any waiting one and restarts the wait. */
  schedule(draft: CreatorDraft): void;
  /** Saves the waiting draft now (nothing if none), after any save in flight. */
  flush(): Promise<void>;
  /** Drops the waiting draft and the timer; a save already in flight no longer sets the status. */
  cancel(): void;
  pending(): boolean;
}

/**
 * The debounce of useDraft as a plain object (so it is tested with fake timers): changes wait `delayMs` after the last one, saves run
 * one at a time in order, a save that fails or finds the store not persistent reports "memory", and nothing here throws.
 */
export function createAutosaver(options: { save: (draft: CreatorDraft) => Promise<void>; persistent: () => boolean; onStatus: (status: SaveStatus) => void; delayMs?: number }): Autosaver {
  const { save, persistent, onStatus, delayMs = AUTOSAVE_MS } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest: CreatorDraft | null = null;
  let generation = 0;
  let chain: Promise<void> = Promise.resolve();

  const run = (): Promise<void> => {
    clearTimeout(timer);
    timer = undefined;
    if (latest === null) return chain;
    const draft = latest;
    latest = null;
    const mine = generation;
    chain = chain.then(async () => {
      let status: SaveStatus;
      try {
        await save(draft);
        status = persistent() ? 'saved' : 'memory';
      } catch {
        status = 'memory';
      }
      // Another change is waiting: it is "saving" still, unless the browser cannot save at all.
      if (mine === generation) onStatus(latest !== null && status === 'saved' ? 'saving' : status);
    });
    return chain;
  };

  return {
    schedule(draft) {
      latest = draft;
      onStatus(persistent() ? 'saving' : 'memory');
      clearTimeout(timer);
      timer = setTimeout(() => void run(), delayMs);
    },
    flush: run,
    cancel() {
      generation += 1;
      latest = null;
      clearTimeout(timer);
      timer = undefined;
    },
    pending: () => latest !== null,
  };
}

export interface UseDraft {
  draft: CreatorDraft;
  /** Changes the draft with a pure function (the helpers of draftEdits.ts); it autosaves 800 ms after the last change. */
  update(fn: (draft: CreatorDraft) => CreatorDraft): void;
  status: SaveStatus;
  /** Clears the stored draft and its images, and goes back to the sample. The caller asks for confirmation first. */
  discard(): Promise<void>;
  /** False until the stored draft has been read (an edit before then is applied on top of it). */
  ready: boolean;
}

/**
 * The creator's draft (spec 7.13): the stored one (migrated) or the sample; every change autosaves. If IndexedDB is not available
 * the creator still works in memory and `status` is "memory". The pending change is saved on unmount and when the page is hidden.
 * `createStore` is for tests.
 */
export function useDraft(createStore: () => Promise<DraftStore> = createDraftStore): UseDraft {
  const [draft, setDraft] = useState<CreatorDraft>(SAMPLE_DRAFT);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [ready, setReady] = useState(false);
  const latest = useRef<CreatorDraft>(SAMPLE_DRAFT);
  const store = useRef<DraftStore | null>(null);
  const saver = useRef<Autosaver | null>(null);
  /** Edits made before the stored draft was read: applied on top of it. */
  const queued = useRef<((draft: CreatorDraft) => CreatorDraft)[]>([]);

  useEffect(() => {
    let alive = true;
    void createStore().then(async opened => {
      let stored: CreatorDraft | null = null;
      try {
        stored = await opened.load();
      } catch {
        stored = null;
      }
      if (!alive) return;
      store.current = opened;
      const autosaver = createAutosaver({ save: d => opened.save(d), persistent: () => opened.persistent, onStatus: setStatus });
      saver.current = autosaver;
      const edits = queued.current;
      queued.current = [];
      let next = latest.current;
      if (stored !== null) next = edits.reduce((d, fn) => fn(d), migrateDraft(stored));
      latest.current = next;
      setDraft(next);
      setStatus(opened.persistent ? 'saved' : 'memory');
      setReady(true);
      if (edits.length > 0) autosaver.schedule(next);
    });
    const flush = () => void saver.current?.flush();
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      alive = false;
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hidden);
      flush();
    };
  }, [createStore]);

  const update = useCallback((fn: (draft: CreatorDraft) => CreatorDraft) => {
    const next = fn(latest.current);
    latest.current = next;
    setDraft(next);
    if (saver.current) saver.current.schedule(next);
    else queued.current.push(fn);
  }, []);

  const discard = useCallback(async () => {
    saver.current?.cancel();
    queued.current = [];
    latest.current = SAMPLE_DRAFT;
    setDraft(SAMPLE_DRAFT);
    try {
      await store.current?.discard();
    } catch {
      // The store never rejects; this only keeps the screen working if a replacement does.
    }
    setStatus(store.current && !store.current.persistent ? 'memory' : 'saved');
  }, []);

  return { draft, update, status, discard, ready };
}
