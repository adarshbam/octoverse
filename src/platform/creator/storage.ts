import { MAX_MEDIA_BYTES } from './draft';
import type { CreatorDraft, DraftMediaType } from './types';

// The creator's browser storage (platform spec 7.13): one IndexedDB database, `octoverse-creator`, with a `draft` store (the JSON)
// and a `media` store (image blobs). It is a convenience, never a requirement: when IndexedDB is missing, blocked, slow, denied or
// full the store keeps everything in memory, says `persistent: false` and carries on. Nothing here throws except putMedia, which
// refuses an image it must not keep with a typed MediaError.

export const DB_NAME = 'octoverse-creator';
/** The database version; a later version adds its steps to `upgrade` below (the migration hook). */
export const DB_VERSION = 1;
const DRAFT_STORE = 'draft';
const MEDIA_STORE = 'media';
const DRAFT_KEY = 'current';
/** How long `indexedDB.open` may take before the store goes to memory (a private window can leave it pending forever). */
const OPEN_TIMEOUT_MS = 4000;

export interface DiscardResult {
  cleared: boolean;
}

export interface DraftStore {
  /** The stored draft as it was saved (migrate it with migrateDraft), or null when there is none. */
  load(): Promise<CreatorDraft | null>;
  /** Keeps the draft. Never rejects: if the browser refuses, the draft is kept in memory and `persistent` turns false. */
  save(draft: CreatorDraft): Promise<void>;
  /** Keeps an image (at most 2 MB; PNG, JPEG or WebP by its first bytes) and returns its id. Rejects with a MediaError for an image it must refuse. */
  putMedia(blob: Blob): Promise<string>;
  getMedia(id: string): Promise<Blob | null>;
  /**
   * Clears the draft and the images, in memory and in the browser (after any save already asked for). `cleared` is false when the
   * browser holds a copy it would neither clear nor delete: the caller keeps the draft on screen and lets the user try again.
   */
  discard(): Promise<DiscardResult>;
  /** Whether the browser is keeping what is saved. False means "in this tab only": the status says it cannot save. */
  readonly persistent: boolean;
}

/** Why putMedia refused an image: too big, not a PNG, JPEG or WebP, or its bytes could not be read. */
export class MediaError extends Error {
  readonly code: 'too-large' | 'bad-type' | 'unreadable';

  constructor(code: MediaError['code'], message: string) {
    super(message);
    this.name = 'MediaError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------------------------
// Images, by signature
// ---------------------------------------------------------------------------------------------

const ascii = (bytes: Uint8Array, from: number, text: string) => text.split('').every((ch, i) => bytes[from + i] === ch.charCodeAt(0));

/** The image type a file's first bytes say (PNG, JPEG or WebP), or null. The file name and the blob's own `type` are never read. */
export function sniffImageType(bytes: Uint8Array): DraftMediaType | null {
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')) return 'image/webp';
  return null;
}

/** The type of an image blob by its signature, or null if it is not a PNG, JPEG or WebP (or cannot be read). */
export async function sniffBlob(blob: Blob): Promise<DraftMediaType | null> {
  try {
    return sniffImageType(new Uint8Array(await blob.slice(0, 12).arrayBuffer()));
  } catch {
    return null;
  }
}

async function checkMedia(blob: unknown): Promise<void> {
  if (!(blob instanceof Blob)) throw new MediaError('bad-type', 'This is not a file.');
  if (blob.size > MAX_MEDIA_BYTES) throw new MediaError('too-large', 'Images are at most 2 MB.');
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  } catch {
    throw new MediaError('unreadable', 'This file could not be read.');
  }
  if (sniffImageType(bytes) === null) throw new MediaError('bad-type', 'Images must be PNG, JPEG or WebP.');
}

let counter = 0;
function newMediaId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  } catch {
    // fall through to the counter
  }
  counter += 1;
  return `m-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------------------------
// IndexedDB, in small promises
// ---------------------------------------------------------------------------------------------

/** The factory to use: the one given, or the global (reading it can throw in a locked-down browser). Null when there is none. */
function pickFactory(options: StoreOptions): IDBFactory | null {
  if ('factory' in options) return options.factory ?? null;
  try {
    return globalThis.indexedDB ?? null;
  } catch {
    return null;
  }
}

/** How an open ended: it worked, `indexedDB.open` threw at once (the browser denies it), or it errored, was blocked or never answered. */
type OpenReason = 'opened' | 'threw' | 'error' | 'blocked' | 'timeout';

interface Opened {
  db: IDBDatabase | null;
  reason: OpenReason;
}

/** The database, upgraded to the current version, or `db: null` with the reason it cannot be opened. */
function openDb(factory: IDBFactory, timeoutMs: number): Promise<Opened> {
  return new Promise(resolve => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = (db: IDBDatabase | null, reason: OpenReason = db ? 'opened' : 'error') => {
      if (settled) {
        // A late answer after we gave up: close it, so it does not block a later upgrade.
        try {
          db?.close();
        } catch {
          // nothing to close
        }
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({ db, reason });
    };
    timer = setTimeout(() => settle(null, 'timeout'), timeoutMs);
    try {
      const request = factory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        try {
          upgrade(request.result);
        } catch {
          settle(null, 'error');
        }
      };
      request.onsuccess = () => settle(request.result);
      request.onerror = () => settle(null, 'error');
      request.onblocked = () => settle(null, 'blocked');
    } catch {
      settle(null, 'threw');
    }
  });
}

/** The schema, one step per version: version 1 creates the two stores. */
function upgrade(db: IDBDatabase) {
  for (const name of [DRAFT_STORE, MEDIA_STORE]) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
}

/**
 * One transaction over the named stores; `work` makes the requests and returns the one whose result is wanted. Rejects if the
 * transaction fails, throws, or does not finish within `timeoutMs` (a hung database must not keep the creator waiting for ever).
 */
function run<T>(db: IDBDatabase, names: string[], mode: IDBTransactionMode, work: (store: (name: string) => IDBObjectStore) => IDBRequest | undefined, timeoutMs: number): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('IndexedDB did not answer in time')), timeoutMs);
    const done = () => clearTimeout(timer);
    try {
      const tx = db.transaction(names, mode);
      let result: T | undefined;
      const request = work(name => tx.objectStore(name));
      if (request) request.onsuccess = () => (result = request.result as T);
      tx.oncomplete = () => (done(), resolve(result));
      tx.onerror = () => (done(), reject(tx.error ?? new Error('IndexedDB transaction failed')));
      tx.onabort = () => (done(), reject(tx.error ?? new Error('IndexedDB transaction aborted')));
    } catch (error) {
      done();
      reject(error);
    }
  });
}

/** Deletes the whole database: true when the browser says it is gone, false when it errors, is blocked, throws or is too slow. */
function deleteDb(factory: IDBFactory, timeoutMs: number): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false;
    const settle = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => settle(false), timeoutMs);
    try {
      const request = factory.deleteDatabase(DB_NAME);
      request.onsuccess = () => settle(true);
      request.onerror = () => settle(false);
      request.onblocked = () => settle(false);
    } catch {
      settle(false);
    }
  });
}

// ---------------------------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------------------------

export interface StoreOptions {
  /** The IndexedDB factory (default: the global one); null for none. For tests. */
  factory?: IDBFactory | null;
  /** How long `open` and `deleteDatabase` may take before the store goes on without them. */
  openTimeoutMs?: number;
}

/**
 * The draft store. IndexedDB when the browser gives it, memory when it does not (`persistent: false`); a write the browser refuses
 * later (a full disk) makes the store memory-only for writes from then on, keeping what it was asked to keep, while reads of what
 * the browser already holds still work. Writes (save, putMedia, discard) run one at a time in the order called, so a discard is
 * never overtaken by a save that was asked before it. Nothing throws except putMedia refusing an image.
 */
export async function createDraftStore(options: StoreOptions = {}): Promise<DraftStore> {
  const factory = pickFactory(options);
  const timeoutMs = options.openTimeoutMs ?? OPEN_TIMEOUT_MS;
  let db: IDBDatabase | null = factory ? (await openDb(factory, timeoutMs)).db : null;
  /** Whether writes still reach the browser (false after a refused write or a lost connection). */
  let writable = db !== null;
  // What the browser has not got: the latest draft, and the images saved after it stopped keeping them.
  const memory: { draft: CreatorDraft | null; media: Map<string, Blob> } = { draft: null, media: new Map() };

  /** Drops the connection (another tab upgrading, a failed read, the browser closing it): memory from here on. */
  const giveUp = () => {
    try {
      db?.close();
    } catch {
      // already closed
    }
    db = null;
    writable = false;
  };
  /** Takes a connection as the store's own. */
  const adopt = (opened: IDBDatabase) => {
    db = opened;
    writable = true;
    // Another tab upgrading the database must not be blocked by this one: step aside and carry on in memory.
    opened.onversionchange = giveUp;
    opened.onclose = giveUp;
  };
  if (db) adopt(db);

  const exec = <T>(connection: IDBDatabase, names: string[], mode: IDBTransactionMode, work: (store: (name: string) => IDBObjectStore) => IDBRequest | undefined) => run<T>(connection, names, mode, work, timeoutMs);

  let queue: Promise<unknown> = Promise.resolve();
  /** Runs `work` after every earlier write has finished (whether it worked or not). */
  const inOrder = <T>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  /**
   * Clears both stores. Through the open connection first; if that fails, by deleting the database (this tab's connection closed so
   * it does not block it) and opening a fresh one. `cleared` is true only when the browser's copy is really gone: the clear worked,
   * or the delete did, or this tab has no way to hold one (there is no IndexedDB, or `open` threw at once: the browser denies it).
   * A database that errored, was blocked or never answered MAY still hold the old draft: with a failed delete too, that is not cleared.
   */
  async function clearBrowser(): Promise<{ cleared: boolean }> {
    if (!factory) return { cleared: true };
    let connection = db;
    let reason: OpenReason = 'opened';
    if (!connection) ({ db: connection, reason } = await openDb(factory, timeoutMs));
    if (connection) {
      try {
        await exec(connection, [DRAFT_STORE, MEDIA_STORE], 'readwrite', store => {
          store(MEDIA_STORE).clear();
          return store(DRAFT_STORE).clear();
        });
        if (connection !== db) adopt(connection);
        writable = true;
        return { cleared: true };
      } catch {
        // fall through to deleting the database
      }
      try {
        connection.close();
      } catch {
        // already closed
      }
      if (connection === db) db = null;
    }
    const deleted = await deleteDb(factory, timeoutMs);
    const { db: fresh } = await openDb(factory, timeoutMs);
    if (fresh) adopt(fresh);
    return { cleared: deleted || reason === 'threw' };
  }

  return {
    get persistent() {
      return db !== null && writable;
    },

    async load() {
      // A draft the browser refused to keep is newer than anything it holds.
      if (memory.draft) return structuredClone(memory.draft);
      if (db) {
        try {
          const stored = await exec<CreatorDraft>(db, [DRAFT_STORE], 'readonly', store => store(DRAFT_STORE).get(DRAFT_KEY));
          return stored ?? null;
        } catch {
          giveUp();
        }
      }
      return null;
    },

    save(draft) {
      // A copy, so a later edit of the caller's object can never change what was saved.
      const copy = structuredClone(draft);
      return inOrder(async () => {
        if (!db || !writable) {
          memory.draft = copy;
          return;
        }
        try {
          await exec(db, [DRAFT_STORE], 'readwrite', store => store(DRAFT_STORE).put(copy, DRAFT_KEY));
          memory.draft = null;
        } catch {
          memory.draft = copy;
          writable = false;
        }
      });
    },

    putMedia(blob) {
      // The check is inside the queue: an image asked for before a discard is never stored after it.
      return inOrder(async () => {
        await checkMedia(blob);
        const id = newMediaId();
        if (db && writable) {
          try {
            await exec(db, [MEDIA_STORE], 'readwrite', store => store(MEDIA_STORE).put(blob, id));
            return id;
          } catch {
            writable = false;
          }
        }
        memory.media.set(id, blob);
        return id;
      });
    },

    async getMedia(id) {
      const held = memory.media.get(id);
      if (held) return held;
      if (!db) return null;
      // Reads can still work after writes stopped (a full disk): images already stored stay visible.
      try {
        const stored = await exec<unknown>(db, [MEDIA_STORE], 'readonly', store => store(MEDIA_STORE).get(id));
        return stored instanceof Blob ? stored : null;
      } catch {
        giveUp();
        return null;
      }
    },

    discard() {
      return inOrder(async () => {
        let result: { cleared: boolean };
        try {
          result = await clearBrowser();
        } catch {
          result = { cleared: false };
        }
        // The copy in memory goes only with the browser's: a failed discard keeps the draft whole.
        if (result.cleared) {
          memory.draft = null;
          memory.media.clear();
        }
        return result;
      });
    },
  };
}
