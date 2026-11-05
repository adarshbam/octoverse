import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_MEDIA_BYTES } from './draft';
import { SAMPLE_DRAFT } from './sampleDraft';
import { MediaError, createDraftStore, sniffImageType } from './storage';

// A hand-written minimal IndexedDB (no dependency, no jsdom): just what storage.ts uses. Handlers are properties
// (onsuccess, onerror, ...), requests settle on a timer, a transaction completes after its last request. `mode` makes `open` fail
// the four ways a browser can (it throws, it errors, it is blocked, it never answers); `failWrites` makes every write fail the way
// a full disk does.
type Mode = 'ok' | 'throw' | 'error' | 'blocked' | 'never';
interface Stub {
  factory: IDBFactory;
  stores: { draft: Map<unknown, unknown>; media: Map<unknown, unknown> };
  opens: () => number;
  closed: () => number;
  failWrites: boolean;
}

function makeIdb(mode: Mode = 'ok'): Stub {
  const stores = { draft: new Map<unknown, unknown>(), media: new Map<unknown, unknown>() };
  const state = { opens: 0, closed: 0, created: false };
  const stub: Stub = { factory: undefined as never, stores, opens: () => state.opens, closed: () => state.closed, failWrites: false };

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
      const list = Array.isArray(names) ? names : [names];
      const tx: Record<string, unknown> = { oncomplete: null, onerror: null, onabort: null, error: null };
      let timer: ReturnType<typeof setTimeout> | undefined;
      const request = (write: boolean, run: () => unknown) => {
        const req: Record<string, unknown> = { result: undefined, error: null, onsuccess: null, onerror: null };
        setTimeout(() => {
          if (write && stub.failWrites) {
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
        timer = setTimeout(() => (tx.oncomplete as null | (() => void))?.(), 0);
        return req;
      };
      tx.objectStore = (name: string) => {
        if (!list.includes(name) || !(name in stores)) throw new Error(`store ${name} is not in this transaction`);
        const map = stores[name as 'draft' | 'media'];
        return {
          put: (value: unknown, key: unknown) => request(true, () => map.set(key, value) && key),
          get: (key: unknown) => request(false, () => map.get(key)),
          delete: (key: unknown) => request(true, () => map.delete(key)),
          clear: () => request(true, () => map.clear()),
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
        } else if (mode === 'blocked') {
          (req.onblocked as null | (() => void))?.();
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
    await expect(store.discard()).resolves.toBeUndefined();
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
