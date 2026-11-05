import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_MEDIA_BYTES } from './draft';
import { SAMPLE_DRAFT } from './sampleDraft';
import { MediaError, createDraftStore, sniffImageType } from './storage';

// A hand-written minimal IndexedDB (no dependency, no jsdom): just what storage.ts uses. Handlers are properties
// (onsuccess, onerror, ...), requests settle on a timer, a transaction completes after its last request. `mode` makes `open` fail
// the four ways a browser can (it throws, it errors, it is blocked, it never answers); `failWrites` makes every write fail the way
// a full disk does.
type Mode = 'ok' | 'throw' | 'error' | 'blocked' | 'blocked-then-ok' | 'never';
interface Stub {
  factory: IDBFactory;
  stores: { draft: Map<unknown, unknown>; media: Map<unknown, unknown> };
  opens: () => number;
  closed: () => number;
  /** Every write fails with a request error (a full disk). */
  failWrites: boolean;
  /** Only `clear` fails (the writes before it work). */
  failClear: boolean;
  /** Writes succeed and the transaction aborts at commit (the common quota case: no request error, `onabort` only). */
  abortOnCommit: boolean;
  /** `db.transaction()` itself throws. */
  throwTransaction: boolean;
  /** `deleteDatabase` fails with an error event. */
  failDelete: boolean;
  /** Transactions never answer (a hung database). */
  hang: boolean;
  deletes: () => number;
  fireVersionChange: () => void;
}

function makeIdb(mode: Mode = 'ok'): Stub {
  const stores = { draft: new Map<unknown, unknown>(), media: new Map<unknown, unknown>() };
  const state = { opens: 0, closed: 0, created: false, deletes: 0 };
  const stub: Stub = { factory: undefined as never, stores, opens: () => state.opens, closed: () => state.closed, failWrites: false, failClear: false, abortOnCommit: false, throwTransaction: false, failDelete: false, hang: false, deletes: () => state.deletes, fireVersionChange: () => db.onversionchange?.() };

  const db = {
    objectStoreNames: { contains: (name: string) => state.created && name in stores },
    createObjectStore: (name: string) => {
      if (!(name in stores)) throw new Error(`no store ${name} in this stub`);
      return {};
    },
    close: () => {
      state.closed += 1;
    },
    onversionchange: null as null | (() => void),
    transaction(names: string | string[], _mode: string) {
      if (stub.throwTransaction) throw new Error('InvalidStateError: the connection is closing');
      const list = Array.isArray(names) ? names : [names];
      const tx: Record<string, unknown> = { oncomplete: null, onerror: null, onabort: null, error: null };
      let timer: ReturnType<typeof setTimeout> | undefined;
      const request = (write: boolean, run: () => unknown, fails = false) => {
        const req: Record<string, unknown> = { result: undefined, error: null, onsuccess: null, onerror: null };
        if (stub.hang) return req;
        setTimeout(() => {
          if (write && (stub.failWrites || fails)) {
            const error = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
            req.error = error;
            tx.error = error;
            (req.onerror as null | (() => void))?.();
            (tx.onerror as null | (() => void))?.();
            (tx.onabort as null | (() => void))?.();
            clearTimeout(timer);
            return;
          }
          req.result = run();
          (req.onsuccess as null | (() => void))?.();
        }, 0);
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (write && stub.abortOnCommit) {
            tx.error = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
            (tx.onabort as null | (() => void))?.();
          } else (tx.oncomplete as null | (() => void))?.();
        }, 0);
        return req;
      };
      tx.objectStore = (name: string) => {
        if (!list.includes(name) || !(name in stores)) throw new Error(`store ${name} is not in this transaction`);
        const map = stores[name as 'draft' | 'media'];
        return {
          put: (value: unknown, key: unknown) => request(true, () => (stub.abortOnCommit ? key : map.set(key, structuredClone(value)) && key)),
          get: (key: unknown) => request(false, () => map.get(key)),
          delete: (key: unknown) => request(true, () => map.delete(key)),
          clear: () => request(true, () => map.clear(), stub.failClear),
        };
      };
      return tx;
    },
  };

  stub.factory = {
    open(_name: string, _version?: number) {
      state.opens += 1;
      if (mode === 'throw') throw new Error('SecurityError: access denied');
      const req: Record<string, unknown> = { result: db, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      setTimeout(() => {
        if (mode === 'error') {
          req.error = new Error('UnknownError');
          (req.onerror as null | (() => void))?.();
        } else if (mode === 'blocked' || mode === 'blocked-then-ok') {
          (req.onblocked as null | (() => void))?.();
          if (mode === 'blocked-then-ok') {
            setTimeout(() => {
              (req.onupgradeneeded as null | (() => void))?.();
              state.created = true;
              (req.onsuccess as null | (() => void))?.();
            }, 30);
          }
        } else if (mode === 'ok') {
          if (!state.created) {
            (req.onupgradeneeded as null | (() => void))?.();
            state.created = true;
          }
          (req.onsuccess as null | (() => void))?.();
        }
      }, 0);
      return req as unknown as IDBOpenDBRequest;
    },
    deleteDatabase(_name: string) {
      const req: Record<string, unknown> = { error: null, onsuccess: null, onerror: null, onblocked: null };
      setTimeout(() => {
        if (stub.failDelete) {
          req.error = new Error('UnknownError');
          (req.onerror as null | (() => void))?.();
          return;
        }
        state.deletes += 1;
        stores.draft.clear();
        stores.media.clear();
        state.created = false;
        (req.onsuccess as null | (() => void))?.();
      }, 0);
      return req as unknown as IDBOpenDBRequest;
    },
  } as unknown as IDBFactory;
  return stub;
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
const blobOf = (header: number[], total = 64, type = '') => new Blob([new Uint8Array([...header, ...new Array(Math.max(0, total - header.length)).fill(7)])], { type });

afterEach(() => vi.unstubAllGlobals());

describe('the draft store on IndexedDB', () => {
  it('opens octoverse-creator with a draft store and a media store', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    expect(store.persistent).toBe(true);
    expect(idb.opens()).toBe(1);
  });

  it('load gives null before any save, then save and load round-trip the draft', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    expect(await store.load()).toBeNull();
    const draft = { ...SAMPLE_DRAFT, octopus: { ...SAMPLE_DRAFT.octopus, name: 'Mo' } };
    await store.save(draft);
    expect(idb.stores.draft.size).toBe(1);
    expect(await store.load()).toEqual(draft);
    expect(store.persistent).toBe(true);
  });

  it('a draft saved by one store is loaded by the next one (a reload)', async () => {
    const idb = makeIdb();
    await (await createDraftStore({ factory: idb.factory })).save(SAMPLE_DRAFT);
    expect(await (await createDraftStore({ factory: idb.factory })).load()).toEqual(SAMPLE_DRAFT);
  });

  it('media round-trip: putMedia gives an id and getMedia the same bytes back; an unknown id is null', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    const blob = blobOf(PNG, 100);
    const id = await store.putMedia(blob);
    expect(typeof id).toBe('string');
    expect(idb.stores.media.size).toBe(1);
    const back = await store.getMedia(id);
    expect(back?.size).toBe(100);
    expect(await store.getMedia('nope')).toBeNull();
  });

  it('discard leaves both stores empty (and a reload finds nothing)', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    await store.save(SAMPLE_DRAFT);
    const id = await store.putMedia(blobOf(JPEG));
    expect(idb.stores.draft.size).toBe(1);
    expect(idb.stores.media.size).toBe(1);
    await store.discard();
    expect(idb.stores.draft.size).toBe(0);
    expect(idb.stores.media.size).toBe(0);
    expect(await store.load()).toBeNull();
    expect(await store.getMedia(id)).toBeNull();
    expect(await (await createDraftStore({ factory: idb.factory })).load()).toBeNull();
  });

  it('uses the global indexedDB when no factory is given', async () => {
    const idb = makeIdb();
    vi.stubGlobal('indexedDB', idb.factory);
    const store = await createDraftStore();
    await store.save(SAMPLE_DRAFT);
    expect(store.persistent).toBe(true);
    expect(idb.stores.draft.size).toBe(1);
  });
});

describe('when IndexedDB is not available the creator works in memory and never throws', () => {
  const memoryWorks = async (store: Awaited<ReturnType<typeof createDraftStore>>) => {
    expect(store.persistent).toBe(false);
    expect(await store.load()).toBeNull();
    await expect(store.save(SAMPLE_DRAFT)).resolves.toBeUndefined();
    expect(await store.load()).toEqual(SAMPLE_DRAFT);
    const id = await store.putMedia(blobOf(WEBP));
    expect((await store.getMedia(id))?.size).toBe(64);
    await expect(store.discard()).resolves.toEqual({ cleared: true });
    expect(await store.load()).toBeNull();
    expect(await store.getMedia(id)).toBeNull();
    expect(store.persistent).toBe(false);
  };

  it('open throws', async () => {
    await memoryWorks(await createDraftStore({ factory: makeIdb('throw').factory }));
  });

  it('open raises an error event', async () => {
    await memoryWorks(await createDraftStore({ factory: makeIdb('error').factory }));
  });

  it('open is blocked', async () => {
    await memoryWorks(await createDraftStore({ factory: makeIdb('blocked').factory }));
  });

  it('open never answers (it times out)', async () => {
    await memoryWorks(await createDraftStore({ factory: makeIdb('never').factory, openTimeoutMs: 30 }));
  });

  it('there is no indexedDB at all (the global is undefined, or a null factory is given)', async () => {
    expect((globalThis as { indexedDB?: unknown }).indexedDB).toBeUndefined();
    await memoryWorks(await createDraftStore());
    await memoryWorks(await createDraftStore({ factory: null }));
  });

  it('reading the global indexedDB throws (a locked-down browser)', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get: () => {
        throw new Error('SecurityError');
      },
    });
    try {
      await memoryWorks(await createDraftStore());
    } finally {
      delete (globalThis as { indexedDB?: unknown }).indexedDB;
    }
  });

  it('the disk is full: a save that fails keeps the draft in memory, says it cannot save, and does not throw', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    expect(store.persistent).toBe(true);
    idb.failWrites = true;
    await expect(store.save(SAMPLE_DRAFT)).resolves.toBeUndefined();
    expect(store.persistent).toBe(false);
    expect(await store.load()).toEqual(SAMPLE_DRAFT);
    const id = await store.putMedia(blobOf(PNG));
    expect((await store.getMedia(id))?.size).toBe(64);
  });

  it('a full disk on a media write falls back to memory too', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    idb.failWrites = true;
    const id = await store.putMedia(blobOf(JPEG));
    expect(store.persistent).toBe(false);
    expect((await store.getMedia(id))?.size).toBe(64);
  });
});

describe('media is checked by its first bytes, at most 2 MB', () => {
  const rejects = async (blob: Blob, code: MediaError['code']) => {
    for (const store of [await createDraftStore({ factory: makeIdb().factory }), await createDraftStore({ factory: null })]) {
      const error = await store.putMedia(blob).then(() => null, (e: unknown) => e);
      expect(error).toBeInstanceOf(MediaError);
      expect((error as MediaError).code).toBe(code);
    }
  };

  it('a 3 MB file is rejected, even with a real PNG header', async () => {
    await rejects(blobOf(PNG, 3 * 1024 * 1024, 'image/png'), 'too-large');
  });

  it('a text file named .png (and typed image/png) is rejected', async () => {
    await rejects(new File(['this is not an image, only text'], 'cat.png', { type: 'image/png' }), 'bad-type');
  });

  it('a GIF, an empty blob and a blob that is not a blob are rejected', async () => {
    await rejects(blobOf([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 40, 'image/png'), 'bad-type');
    await rejects(new Blob([]), 'bad-type');
    const store = await createDraftStore({ factory: null });
    await expect(store.putMedia(null as never)).rejects.toBeInstanceOf(MediaError);
  });

  it('a real PNG, JPEG and WebP header is accepted, whatever the blob type says', async () => {
    const store = await createDraftStore({ factory: makeIdb().factory });
    for (const header of [PNG, JPEG, WEBP]) {
      await expect(store.putMedia(blobOf(header, 64, 'text/plain'))).resolves.toEqual(expect.any(String));
    }
  });

  it('exactly 2 MB is accepted, and ids are unique', async () => {
    const store = await createDraftStore({ factory: null });
    const a = await store.putMedia(blobOf(PNG, MAX_MEDIA_BYTES));
    const b = await store.putMedia(blobOf(PNG, 64));
    expect(a).not.toBe(b);
  });

  it('sniffImageType reads the signature only', () => {
    expect(sniffImageType(new Uint8Array(PNG))).toBe('image/png');
    expect(sniffImageType(new Uint8Array(JPEG))).toBe('image/jpeg');
    expect(sniffImageType(new Uint8Array(WEBP))).toBe('image/webp');
    expect(sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20]))).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
    expect(sniffImageType(new Uint8Array([0x89, 0x50]))).toBeNull();
  });
});

describe('the browser refuses in other ways', () => {
  it('a commit-time abort after the put (no request error: the common quota case) is memory, not a crash', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    idb.abortOnCommit = true;
    await expect(store.save(SAMPLE_DRAFT)).resolves.toBeUndefined();
    expect(store.persistent).toBe(false);
    expect(await store.load()).toEqual(SAMPLE_DRAFT);
    expect(idb.stores.draft.size).toBe(0);
  });

  it('db.transaction() throwing is memory, not a crash, for save, media and reads', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    idb.throwTransaction = true;
    await expect(store.save(SAMPLE_DRAFT)).resolves.toBeUndefined();
    expect(store.persistent).toBe(false);
    const id = await store.putMedia(blobOf(PNG));
    expect((await store.getMedia(id))?.size).toBe(64);
    expect(await store.getMedia('other')).toBeNull();
    expect(await store.load()).toEqual(SAMPLE_DRAFT);
  });

  it('a versionchange (another tab upgrading) closes the connection and the store carries on in memory', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    expect(idb.closed()).toBe(0);
    idb.fireVersionChange();
    expect(idb.closed()).toBe(1);
    expect(store.persistent).toBe(false);
    await expect(store.save(SAMPLE_DRAFT)).resolves.toBeUndefined();
    expect(await store.load()).toEqual(SAMPLE_DRAFT);
    expect(idb.stores.draft.size).toBe(0);
  });

  it('a blocked open that succeeds later is closed, not used (the store already went to memory)', async () => {
    const idb = makeIdb('blocked-then-ok');
    const store = await createDraftStore({ factory: idb.factory });
    expect(store.persistent).toBe(false);
    expect(idb.closed()).toBe(0);
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(idb.closed()).toBe(1);
    expect(store.persistent).toBe(false);
  });

  it('an open that answers after the timeout is closed too', async () => {
    const idb = makeIdb('blocked-then-ok');
    const store = await createDraftStore({ factory: idb.factory, openTimeoutMs: 5 });
    expect(store.persistent).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(idb.closed()).toBe(1);
  });

  it('images already stored can still be read after a write failed', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    const id = await store.putMedia(blobOf(JPEG, 90));
    idb.failWrites = true;
    await store.save(SAMPLE_DRAFT);
    expect(store.persistent).toBe(false);
    expect((await store.getMedia(id))?.size).toBe(90);
  });

  it('a draft changed after save() does not change what was saved (IndexedDB or memory)', async () => {
    for (const factory of [makeIdb().factory, null]) {
      const store = await createDraftStore({ factory });
      const draft = structuredClone(SAMPLE_DRAFT);
      await store.save(draft);
      draft.octopus.name = 'changed after saving';
      draft.projects.length = 0;
      expect((await store.load())?.octopus.name).toBe(SAMPLE_DRAFT.octopus.name);
      expect((await store.load())?.projects).toHaveLength(1);
    }
  });
});

describe('discard never claims what it did not do', () => {
  it('a failing clear (transaction error) falls back to deleting the database, and the store works again', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    await store.save(SAMPLE_DRAFT);
    await store.putMedia(blobOf(PNG));
    idb.failClear = true;
    await expect(store.discard()).resolves.toEqual({ cleared: true });
    expect(idb.deletes()).toBe(1);
    expect(idb.stores.draft.size).toBe(0);
    expect(idb.stores.media.size).toBe(0);
    expect(store.persistent).toBe(true);
    await store.save(SAMPLE_DRAFT);
    expect(idb.stores.draft.size).toBe(1);
  });

  it('a failing clear and a failing deleteDatabase report cleared:false, keep the stored copy readable, and a retry succeeds', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    await store.save(SAMPLE_DRAFT);
    idb.failClear = true;
    idb.failDelete = true;
    await expect(store.discard()).resolves.toEqual({ cleared: false });
    expect(idb.stores.draft.size).toBe(1);
    expect(await store.load()).toEqual(SAMPLE_DRAFT);
    idb.failClear = false;
    idb.failDelete = false;
    await expect(store.discard()).resolves.toEqual({ cleared: true });
    expect(idb.stores.draft.size).toBe(0);
    expect(await store.load()).toBeNull();
  });

  it('after the connection was given up (memory mode) it reopens, clears the browser copy and reports cleared', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    await store.save(SAMPLE_DRAFT);
    idb.fireVersionChange();
    expect(store.persistent).toBe(false);
    await store.save({ ...SAMPLE_DRAFT, updatedAt: 'memory only' });
    await expect(store.discard()).resolves.toEqual({ cleared: true });
    expect(idb.stores.draft.size).toBe(0);
    expect(await store.load()).toBeNull();
    expect(store.persistent).toBe(true);
  });

  it('a memory-only store (no IndexedDB, or one that never opens) clears its memory and reports cleared', async () => {
    for (const factory of [null, makeIdb('throw').factory, makeIdb('error').factory]) {
      const store = await createDraftStore({ factory });
      await store.save(SAMPLE_DRAFT);
      const id = await store.putMedia(blobOf(PNG));
      await expect(store.discard()).resolves.toEqual({ cleared: true });
      expect(await store.load()).toBeNull();
      expect(await store.getMedia(id)).toBeNull();
    }
  });

  it('a save asked before the discard finishes first, so the old draft is not rewritten after the clear', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    const saving = store.save(SAMPLE_DRAFT);
    const media = store.putMedia(blobOf(PNG));
    const discarding = store.discard();
    await Promise.all([saving, media]);
    await expect(discarding).resolves.toEqual({ cleared: true });
    expect(idb.stores.draft.size).toBe(0);
    expect(idb.stores.media.size).toBe(0);
    expect(await store.load()).toBeNull();
  });

  it('a discard whose database is full still clears (a clear is a write: the fallback deletes the database)', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    await store.save(SAMPLE_DRAFT);
    idb.failWrites = true;
    await store.save({ ...SAMPLE_DRAFT, updatedAt: 'x' });
    expect(store.persistent).toBe(false);
    idb.failWrites = false;
    await expect(store.discard()).resolves.toEqual({ cleared: true });
    expect(idb.stores.draft.size).toBe(0);
    expect(await store.load()).toBeNull();
  });
});

describe('discard honesty by the reason the database cannot be opened (R23)', () => {
  const cases: { reason: string; make: () => Stub; options: object; cleared: boolean }[] = [
    { reason: 'open threw', make: () => makeIdb('throw'), options: {}, cleared: true },
    { reason: 'open errored', make: () => makeIdb('error'), options: {}, cleared: false },
    { reason: 'open blocked', make: () => makeIdb('blocked'), options: {}, cleared: false },
    { reason: 'open timed out', make: () => makeIdb('never'), options: { openTimeoutMs: 20 }, cleared: false },
  ];

  it.each(cases)('$reason and deleteDatabase fails: cleared is $cleared; the memory draft survives a failed discard', async ({ make, options, cleared }) => {
    const idb = make();
    idb.failDelete = true;
    const store = await createDraftStore({ factory: idb.factory, ...options });
    await store.save(SAMPLE_DRAFT);
    await expect(store.discard()).resolves.toEqual({ cleared });
    // Only a cleared discard may take the draft held in memory.
    expect(await store.load()).toEqual(cleared ? null : SAMPLE_DRAFT);
  });

  it.each(cases)('$reason and deleteDatabase works: cleared', async ({ make, options }) => {
    const store = await createDraftStore({ factory: make().factory, ...options });
    await store.save(SAMPLE_DRAFT);
    await expect(store.discard()).resolves.toEqual({ cleared: true });
    expect(await store.load()).toBeNull();
  });

  it('a retry after a failed discard succeeds once the browser lets it', async () => {
    const idb = makeIdb('error');
    idb.failDelete = true;
    const store = await createDraftStore({ factory: idb.factory });
    await store.save(SAMPLE_DRAFT);
    await expect(store.discard()).resolves.toEqual({ cleared: false });
    idb.failDelete = false;
    await expect(store.discard()).resolves.toEqual({ cleared: true });
  });

  it('no IndexedDB at all is cleared', async () => {
    await expect((await createDraftStore({ factory: null })).discard()).resolves.toEqual({ cleared: true });
  });
});

describe('a database that never answers does not hold the creator for ever', () => {
  it('load() and save() give up after the timeout and the store goes to memory', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory, openTimeoutMs: 30 });
    idb.hang = true;
    expect(await store.load()).toBeNull();
    expect(store.persistent).toBe(false);
    await expect(store.save(SAMPLE_DRAFT)).resolves.toBeUndefined();
    expect(await store.load()).toEqual(SAMPLE_DRAFT);
  });

  it('discard() gives up on the clear, deletes the database instead, and is cleared if that works', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory, openTimeoutMs: 30 });
    idb.hang = true;
    await expect(store.discard()).resolves.toEqual({ cleared: true });
    expect(idb.deletes()).toBe(1);
  });

  it('discard() with a hung clear and a failing delete is not cleared', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory, openTimeoutMs: 30 });
    idb.hang = true;
    idb.failDelete = true;
    await expect(store.discard()).resolves.toEqual({ cleared: false });
  });

  it('an image read that hangs is null, not a hang', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory, openTimeoutMs: 30 });
    idb.hang = true;
    expect(await store.getMedia('x')).toBeNull();
  });
});

describe('deleteMedia (one blob, never throws)', () => {
  it('removes one image from the browser and keeps the others and the draft', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    await store.save(SAMPLE_DRAFT);
    const a = await store.putMedia(blobOf(PNG, 50));
    const b = await store.putMedia(blobOf(JPEG, 60));
    await store.deleteMedia(a);
    expect(idb.stores.media.size).toBe(1);
    expect(await store.getMedia(a)).toBeNull();
    expect((await store.getMedia(b))?.size).toBe(60);
    expect(await store.load()).toEqual(SAMPLE_DRAFT);
  });

  it('an unknown id is nothing to do', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    await expect(store.deleteMedia('nope')).resolves.toBeUndefined();
  });

  it('removes an image held in memory (IndexedDB blocked)', async () => {
    const store = await createDraftStore({ factory: null });
    const id = await store.putMedia(blobOf(PNG, 40));
    expect(await store.getMedia(id)).not.toBeNull();
    await store.deleteMedia(id);
    expect(await store.getMedia(id)).toBeNull();
  });

  it('a delete the browser refuses does not throw, and does not make the store give up writing', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    const id = await store.putMedia(blobOf(PNG, 50));
    idb.failWrites = true;
    await expect(store.deleteMedia(id)).resolves.toBeUndefined();
    idb.failWrites = false;
    expect(store.persistent).toBe(true);
    await store.discard();
    expect(idb.stores.media.size).toBe(0);
  });

  it('runs in order with the writes before it: an image put before the delete is gone after it', async () => {
    const idb = makeIdb();
    const store = await createDraftStore({ factory: idb.factory });
    const put = store.putMedia(blobOf(PNG, 50));
    const gone = put.then(id => store.deleteMedia(id).then(() => id));
    const id = await gone;
    expect(await store.getMedia(id)).toBeNull();
    expect(idb.stores.media.size).toBe(0);
  });
});
