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

export interface DraftStore {
  /** The stored draft as it was saved (migrate it with migrateDraft), or null when there is none. */
  load(): Promise<CreatorDraft | null>;
  /** Keeps the draft. Never rejects: if the browser refuses, the draft is kept in memory and `persistent` turns false. */
  save(draft: CreatorDraft): Promise<void>;
  /** Keeps an image (at most 2 MB; PNG, JPEG or WebP by its first bytes) and returns its id. Rejects with a MediaError for an image it must refuse. */
  putMedia(blob: Blob): Promise<string>;
  getMedia(id: string): Promise<Blob | null>;
  /** Clears the draft and the images, in memory and in the browser. */
  discard(): Promise<void>;
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

/** The database, upgraded to the current version, or null when it cannot be opened (throws, errors, blocked, or too slow). */
function openDb(factory: IDBFactory, timeoutMs: number): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = (db: IDBDatabase | null) => {
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
      resolve(db);
    };
    timer = setTimeout(() => settle(null), timeoutMs);
    try {
      const request = factory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        try {
          upgrade(request.result);
        } catch {
          settle(null);
        }
      };
      request.onsuccess = () => settle(request.result);
      request.onerror = () => settle(null);
      request.onblocked = () => settle(null);
    } catch {
      settle(null);
    }
  });
}

/** The schema, one step per version: version 1 creates the two stores. */
function upgrade(db: IDBDatabase) {
  for (const name of [DRAFT_STORE, MEDIA_STORE]) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
}

/** One transaction over the named stores; `work` makes the requests and returns the one whose result is wanted. Rejects if the transaction fails. */
function run<T>(db: IDBDatabase, names: string[], mode: IDBTransactionMode, work: (store: (name: string) => IDBObjectStore) => IDBRequest | undefined): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(names, mode);
      let result: T | undefined;
      const request = work(name => tx.objectStore(name));
      if (request) request.onsuccess = () => (result = request.result as T);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    } catch (error) {
      reject(error);
    }
  });
}

// ---------------------------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------------------------

export interface StoreOptions {
  /** The IndexedDB factory (default: the global one); null for none. For tests. */
  factory?: IDBFactory | null;
  /** How long `open` may take before the store goes to memory. */
  openTimeoutMs?: number;
}

/**
 * The draft store. IndexedDB when the browser gives it, memory when it does not (`persistent: false`); a write the browser refuses
 * later (a full disk) switches the store to memory from then on, keeping what it was asked to keep. Never throws.
 */
export async function createDraftStore(options: StoreOptions = {}): Promise<DraftStore> {
  const factory = pickFactory(options);
  let db = factory ? await openDb(factory, options.openTimeoutMs ?? OPEN_TIMEOUT_MS) : null;
  // What the browser has not got: the latest draft, and the images saved after it stopped keeping them.
  const memory: { draft: CreatorDraft | null; media: Map<string, Blob> } = { draft: null, media: new Map() };

  const giveUp = () => {
    try {
      db?.close();
    } catch {
      // already closed
    }
    db = null;
  };
  if (db) {
    // Another tab upgrading the database must not be blocked by this one: step aside and carry on in memory.
    db.onversionchange = giveUp;
    db.onclose = giveUp;
  }

  return {
    get persistent() {
      return db !== null;
    },

    async load() {
      if (db) {
        try {
          const stored = await run<CreatorDraft>(db, [DRAFT_STORE], 'readonly', store => store(DRAFT_STORE).get(DRAFT_KEY));
          return stored ?? null;
        } catch {
          giveUp();
        }
      }
      return memory.draft;
    },

    async save(draft) {
      memory.draft = draft;
      if (!db) return;
      try {
        await run(db, [DRAFT_STORE], 'readwrite', store => store(DRAFT_STORE).put(draft, DRAFT_KEY));
        memory.draft = null;
      } catch {
        giveUp();
      }
    },

    async putMedia(blob) {
      await checkMedia(blob);
      const id = newMediaId();
      if (db) {
        try {
          await run(db, [MEDIA_STORE], 'readwrite', store => store(MEDIA_STORE).put(blob, id));
          return id;
        } catch {
          giveUp();
        }
      }
      memory.media.set(id, blob);
      return id;
    },

    async getMedia(id) {
      const held = memory.media.get(id);
      if (held) return held;
      if (!db) return null;
      try {
        const stored = await run<unknown>(db, [MEDIA_STORE], 'readonly', store => store(MEDIA_STORE).get(id));
        return stored instanceof Blob ? stored : null;
      } catch {
        giveUp();
        return null;
      }
    },

    async discard() {
      memory.draft = null;
      memory.media.clear();
      if (!db) return;
      try {
        await run(db, [DRAFT_STORE, MEDIA_STORE], 'readwrite', store => {
          store(MEDIA_STORE).clear();
          return store(DRAFT_STORE).clear();
        });
      } catch {
        giveUp();
      }
    },
  };
}
