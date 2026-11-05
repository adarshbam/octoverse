import { PALETTE_IDS, TEMPLATE_IDS, type PaletteId, type TemplateId } from './types';

// What the landing, How It Works and Explore may know of the visitor's own draft (platform spec 7.10, J01): its template, its palette
// and its name, read straight from the creator's IndexedDB database, never through storage.ts (that would pull the draft's validation
// into the landing; this file imports only the id lists, like reviewParam.ts). It only reads: it opens no transaction that writes,
// never creates the database (a visitor who has never opened the creator keeps none), never throws, never waits more than a moment.
// Anything wrong (no IndexedDB, no database, no draft, a draft of a shape it does not know, a timeout) is null, and the caller
// shows the sample octopus.

/** The creator's database, store and key (storage.ts owns them; localDraft.test.ts holds the two in step). */
export const LOCAL_DB_NAME = 'octoverse-creator';
export const LOCAL_DRAFT_STORE = 'draft';
export const LOCAL_DRAFT_KEY = 'current';
/** How long the read may take: a private window can leave `indexedDB.open` pending for ever. */
export const LOCAL_READ_TIMEOUT_MS = 1500;

export interface LocalDraft {
  template: TemplateId;
  palette: PaletteId;
  /** The octopus's name, trimmed; empty when the visitor has not named it. */
  name: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The template, palette and name of a stored draft, or null when it is not one this build knows. Pure. */
export function summariseDraft(stored: unknown): LocalDraft | null {
  if (!isRecord(stored) || !isRecord(stored.octopus)) return null;
  const { template, palette, name } = stored.octopus;
  if (!(TEMPLATE_IDS as readonly unknown[]).includes(template) || !(PALETTE_IDS as readonly unknown[]).includes(palette)) return null;
  return { template: template as TemplateId, palette: palette as PaletteId, name: typeof name === 'string' ? name.trim().slice(0, 24) : '' };
}

/**
 * The visitor's draft in this browser as it was stored (unvalidated: the caller summarises or migrates it), or null when there is none
 * or it cannot be read. `factory` is the IndexedDB factory (the browser's, by default). The database is opened without a version and its
 * upgrade is aborted, so a browser that has no such database is left without one; the connection is always closed. Shared by the
 * landing's summary (`readLocalDraft`) and the creator's full preview, which must not create the creator's database either.
 */
export function readStoredDraft(factory?: IDBFactory | null, timeoutMs = LOCAL_READ_TIMEOUT_MS): Promise<unknown> {
  return new Promise(resolve => {
    let settled = false;
    let db: IDBDatabase | null = null;
    const finish = (value: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      db?.close();
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    try {
      const idb = factory === undefined ? globalThis.indexedDB : factory;
      if (!idb) return finish(null);
      const request = idb.open(LOCAL_DB_NAME);
      // No database yet: the browser is creating an empty one. Abort that, so nothing is left behind for the creator to trip over.
      request.onupgradeneeded = () => {
        try {
          request.transaction?.abort();
        } catch {
          /* the open fails below */
        }
        finish(null);
      };
      request.onerror = () => finish(null);
      request.onblocked = () => finish(null);
      request.onsuccess = () => {
        db = request.result;
        // A late answer, after the timeout: the finish above has run and nothing reads it; close it here.
        if (settled) return db.close();
        try {
          if (!db.objectStoreNames.contains(LOCAL_DRAFT_STORE)) return finish(null);
          const get = db.transaction(LOCAL_DRAFT_STORE, 'readonly').objectStore(LOCAL_DRAFT_STORE).get(LOCAL_DRAFT_KEY);
          get.onsuccess = () => finish(get.result ?? null);
          get.onerror = () => finish(null);
        } catch {
          finish(null);
        }
      };
    } catch {
      finish(null);
    }
  });
}

/** The visitor's draft in this browser, summarised for the landing (template, palette, name), or null. */
export function readLocalDraft(factory?: IDBFactory | null, timeoutMs = LOCAL_READ_TIMEOUT_MS): Promise<LocalDraft | null> {
  return readStoredDraft(factory, timeoutMs).then(summariseDraft);
}
