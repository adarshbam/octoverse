import { migrateDraft } from './draft';
import { SAMPLE_DRAFT } from './sampleDraft';
import { createDraftStore, type DraftStore } from './storage';
import type { CreatorDraft } from './types';

// The logic of useDraft without React (so it is tested without a DOM): the debounce, the loading of the stored draft, edits made
// before it is loaded, and the discard. useDraft.ts is a thin hook over `createDraftController`.

/** "saved" is kept in this browser, "saving" is waiting for or in a save, "memory" is kept in this tab only (the browser cannot save). */
export type SaveStatus = 'saved' | 'saving' | 'memory';

/** An edit autosaves this long after the last change (spec 7.13). */
export const AUTOSAVE_MS = 800;

/** What the screen says when Discard could not clear the browser's copy (the draft is still on screen). */
export const DISCARD_ERROR = "Could not clear this browser's copy. Your draft is still here. Try again.";

export interface Autosaver {
  /** The draft to keep: replaces any waiting one and restarts the wait. */
  schedule(draft: CreatorDraft): void;
  /** Saves the waiting draft now (nothing if none), after any save in flight. */
  flush(): Promise<void>;
  /** Drops the waiting draft and the timer; saves not yet started are skipped and one in flight no longer sets the status. */
  cancel(): void;
  pending(): boolean;
}

/**
 * The debounce as a plain object (tested with fake timers): changes wait `delayMs` after the last one, saves run one at a time in
 * order, a save that fails or finds the store not persistent reports "memory", and nothing here throws.
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
      // Cancelled (a discard) while waiting for an earlier save: the old draft must not be written after the clear.
      if (mine !== generation) return;
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

/**
 * The draft once the stored one is read. Edits made before then are functions of the draft, so they are applied ON TOP of the stored
 * draft (a draft is never replaced by the sample plus an edit). With nothing stored the draft on hand already holds the edits.
 */
export function resolveLoaded(stored: unknown, current: CreatorDraft, edits: readonly ((draft: CreatorDraft) => CreatorDraft)[]): CreatorDraft {
  if (stored === null || stored === undefined) return current;
  return edits.reduce((draft, edit) => edit(draft), migrateDraft(stored));
}

export interface DraftView {
  draft: CreatorDraft;
  status: SaveStatus;
  /** False until the stored draft has been read. */
  ready: boolean;
  /** Set when a discard could not clear the browser's copy; cleared by the next edit or successful discard. */
  discardError: string | null;
  /** True while a discard is under way: edits are refused then, so the screen should not offer them (the route makes the page inert). */
  discarding: boolean;
}

export const INITIAL_VIEW: DraftView = { draft: SAMPLE_DRAFT, status: 'saved', ready: false, discardError: null, discarding: false };

/** The words a screen reader hears: they change only between loading, saved, cannot-save and a failed discard (saving reads as saved). */
export function announcement(view: Pick<DraftView, 'ready' | 'status' | 'discardError'>): string {
  if (!view.ready) return 'Loading your draft';
  if (view.discardError !== null) return view.discardError;
  if (view.status === 'memory') return 'Cannot save in this browser; your changes stay in this tab only';
  return 'Saved in this browser';
}

export interface DraftController {
  getView(): DraftView;
  subscribe(listener: () => void): () => void;
  /** Opens the store and reads the stored draft. */
  start(): void;
  /** Changes the draft with a pure function of the current one; it autosaves 800 ms after the last change. */
  update(fn: (draft: CreatorDraft) => CreatorDraft): void;
  /** Waits for the store, then clears it; the draft goes back to the sample only when `cleared` is true. */
  discard(): Promise<{ cleared: boolean }>;
  /** Saves a pending change now. */
  flush(): void;
  /** Stops: a pending change is saved, and nothing is emitted again. */
  dispose(): void;
}

export function createDraftController(options: { createStore?: () => Promise<DraftStore>; delayMs?: number } = {}): DraftController {
  const createStore = options.createStore ?? createDraftStore;
  let view: DraftView = INITIAL_VIEW;
  const listeners = new Set<() => void>();
  let store: Promise<DraftStore> | null = null;
  let saver: Autosaver | null = null;
  let queued: ((draft: CreatorDraft) => CreatorDraft)[] = [];
  let disposed = false;
  let discarding = false;

  const set = (patch: Partial<DraftView>) => {
    view = { ...view, ...patch };
    if (!disposed) for (const listener of [...listeners]) listener();
  };

  return {
    getView: () => view,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },

    start() {
      if (store) return;
      // A store that cannot even be made is a memory store: the creator still works.
      const opening = createStore().catch(() => createDraftStore({ factory: null }));
      store = opening.then(async opened => {
        let stored: unknown = null;
        try {
          stored = await opened.load();
        } catch {
          stored = null;
        }
        const edits = queued;
        queued = [];
        const next = resolveLoaded(stored, view.draft, edits);
        if (disposed) {
          // Closed before it opened: an edit already made is kept, not lost.
          if (edits.length > 0) await opened.save(next).catch(() => undefined);
          return opened;
        }
        saver = createAutosaver({ save: d => opened.save(d), persistent: () => opened.persistent, onStatus: status => set({ status }), delayMs: options.delayMs });
        set({ draft: next, status: opened.persistent ? 'saved' : 'memory', ready: true });
        if (edits.length > 0) saver.schedule(next);
        return opened;
      });
    },

    update(fn) {
      // While a discard is under way an edit would be saved over what the discard clears; the view says `discarding` so none is offered.
      if (disposed || discarding) return;
      const next = fn(view.draft);
      if (saver) saver.schedule(next);
      else queued.push(fn);
      set({ draft: next, discardError: null });
    },

    async discard() {
      if (disposed || store === null) return { cleared: false };
      discarding = true;
      set({ discarding: true });
      try {
        const opened = await store;
        const hadPending = saver?.pending() ?? false;
        saver?.cancel();
        let cleared = false;
        try {
          ({ cleared } = await opened.discard());
        } catch {
          cleared = false;
        }
        if (!cleared) {
          // The browser still holds a copy: keep the draft on screen, keep a pending change pending, and let the user retry.
          // The status follows the store (it may have been left at "saving" by the change just cancelled), then a pending change is saved again.
          set({ discardError: DISCARD_ERROR, status: opened.persistent ? 'saved' : 'memory' });
          if (hadPending) saver?.schedule(view.draft);
          return { cleared: false };
        }
        queued = [];
        set({ draft: SAMPLE_DRAFT, discardError: null, status: opened.persistent ? 'saved' : 'memory' });
        return { cleared: true };
      } finally {
        discarding = false;
        set({ discarding: false });
      }
    },

    flush() {
      void saver?.flush();
    },

    dispose() {
      if (disposed) return;
      void saver?.flush();
      disposed = true;
      listeners.clear();
    },
  };
}
