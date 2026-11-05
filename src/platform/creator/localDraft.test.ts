import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DB_NAME } from './storage';
import { LOCAL_DB_NAME, LOCAL_DRAFT_KEY, LOCAL_DRAFT_STORE, readLocalDraft, readStoredDraft, summariseDraft } from './localDraft';
import { draftOrSample } from './previewDraft';
import { SAMPLE_DRAFT } from './sampleDraft';

// The landing's read of the visitor's draft: read-only, never throws, null for anything but a draft of a known template and palette.

describe('the constants', () => {
  it("name the creator's own database, store and key (storage.ts)", () => {
    expect(LOCAL_DB_NAME).toBe(DB_NAME);
    const source = readFileSync(resolve(__dirname, 'storage.ts'), 'utf8');
    expect(source).toContain(`const DRAFT_STORE = '${LOCAL_DRAFT_STORE}'`);
    expect(source).toContain(`const DRAFT_KEY = '${LOCAL_DRAFT_KEY}'`);
  });

  it('import nothing but the id lists (the landing must not load the draft, the templates or the storage)', () => {
    const imports = [...readFileSync(resolve(__dirname, 'localDraft.ts'), 'utf8').matchAll(/^import .* from '([^']+)'/gm)].map(m => m[1]);
    expect(imports).toEqual(['./types']);
  });
});

describe('summariseDraft', () => {
  it('reads template, palette and the trimmed name', () => {
    expect(summariseDraft({ octopus: { template: 'flux', palette: 'teal', name: '  Ada  ' } })).toEqual({ template: 'flux', palette: 'teal', name: 'Ada' });
    expect(summariseDraft({ octopus: { template: 'nox', palette: 'lilacGrey', name: 5 } })).toEqual({ template: 'nox', palette: 'lilacGrey', name: '' });
  });

  it.each([null, undefined, 'x', 3, [], {}, { octopus: null }, { octopus: [] }, { octopus: { template: 'kraken', palette: 'teal' } }, { octopus: { template: 'flux', palette: 'gold' } }, { octopus: { template: 'flux' } }])('is null for %j', stored => {
    expect(summariseDraft(stored)).toBeNull();
  });
});

// A hand-written IndexedDB stub: just enough of open / transaction / get, answering after a microtask.
interface StubOptions {
  exists?: boolean;
  stores?: string[];
  value?: unknown;
  openThrows?: boolean;
  openNever?: boolean;
  getError?: boolean;
  transactionThrows?: boolean;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;
function stub(options: StubOptions = {}) {
  const log = { opened: 0, aborted: 0, closed: 0, writes: 0, transactions: [] as unknown[][] };
  const { exists = true, stores = [LOCAL_DRAFT_STORE], value } = options;
  const factory = {
    open(name: string, ...rest: unknown[]) {
      log.opened += 1;
      expect(name).toBe(LOCAL_DB_NAME);
      expect(rest, 'opened without a version').toEqual([]);
      if (options.openThrows) throw new Error('denied');
      const request: Loose = { result: undefined, transaction: { abort: () => (log.aborted += 1) } };
      if (options.openNever) return request;
      queueMicrotask(() => {
        if (!exists) {
          request.onupgradeneeded?.({});
          request.onerror?.({});
          return;
        }
        request.result = {
          objectStoreNames: { contains: (n: string) => stores.includes(n) },
          close: () => (log.closed += 1),
          transaction(names: unknown, mode: unknown) {
            log.transactions.push([names, mode]);
            if (options.transactionThrows) throw new Error('nope');
            return {
              objectStore: () => ({
                get(key: unknown) {
                  expect(key).toBe(LOCAL_DRAFT_KEY);
                  const get: Loose = { result: value };
                  queueMicrotask(() => (options.getError ? get.onerror?.({}) : get.onsuccess?.({})));
                  return get;
                },
                put: () => (log.writes += 1),
                clear: () => (log.writes += 1),
              }),
            };
          },
        };
        request.onsuccess?.({});
      });
      return request;
    },
  };
  return { factory: factory as unknown as IDBFactory, log };
}

describe('readLocalDraft', () => {
  const draft = { octopus: { template: 'veyra', palette: 'rose', name: 'Kai' } };

  it('returns the stored draft, read-only, and closes the connection', async () => {
    const { factory, log } = stub({ value: draft });
    expect(await readLocalDraft(factory)).toEqual({ template: 'veyra', palette: 'rose', name: 'Kai' });
    expect(log.transactions).toEqual([[LOCAL_DRAFT_STORE, 'readonly']]);
    expect(log.writes).toBe(0);
    expect(log.closed).toBe(1);
  });

  it('is null with no stored draft, with an unknown shape and without a draft store', async () => {
    expect(await readLocalDraft(stub({ value: undefined }).factory)).toBeNull();
    expect(await readLocalDraft(stub({ value: { octopus: { template: 'x', palette: 'rose' } } }).factory)).toBeNull();
    const none = stub({ stores: [], value: draft });
    expect(await readLocalDraft(none.factory)).toBeNull();
    expect(none.log.closed).toBe(1);
  });

  it('leaves no database behind when there was none: the upgrade is aborted', async () => {
    const { factory, log } = stub({ exists: false });
    expect(await readLocalDraft(factory)).toBeNull();
    expect(log.aborted).toBe(1);
  });

  it('never throws: no IndexedDB, open throwing, a failing read, a transaction that throws', async () => {
    expect(await readLocalDraft(null)).toBeNull();
    expect(await readLocalDraft(stub({ openThrows: true }).factory)).toBeNull();
    expect(await readLocalDraft(stub({ getError: true, value: draft }).factory)).toBeNull();
    const t = stub({ transactionThrows: true, value: draft });
    expect(await readLocalDraft(t.factory)).toBeNull();
    expect(t.log.closed).toBe(1);
  });

  it('gives up when the browser never answers', async () => {
    expect(await readLocalDraft(stub({ openNever: true }).factory, 20)).toBeNull();
  });

  it('is null where the global indexedDB is missing (the server, tests without a browser)', async () => {
    expect(await readLocalDraft()).toBeNull();
  });
});

// The full preview reads the whole stored draft through the same non-creating reader.
describe('readStoredDraft (the full preview read)', () => {
  const stored = { version: 1, octopus: { template: 'flux', palette: 'rose', personality: 'calm', name: 'Kai' }, profile: { handle: 'kai', tagline: '', about: '' }, projects: [], updatedAt: 'x' };

  it('returns the stored draft whole and untouched, read-only, and closes the connection', async () => {
    const { factory, log } = stub({ value: stored });
    expect(await readStoredDraft(factory)).toEqual(stored);
    expect(log.transactions).toEqual([[LOCAL_DRAFT_STORE, 'readonly']]);
    expect(log.writes).toBe(0);
    expect(log.closed).toBe(1);
  });

  it('creates no database when the browser has none (the upgrade is aborted), and the preview then shows the sample', async () => {
    const { factory, log } = stub({ exists: false });
    expect(await readStoredDraft(factory)).toBeNull();
    expect(log.aborted).toBe(1);
    expect(draftOrSample(await readStoredDraft(stub({ exists: false }).factory))).toBe(SAMPLE_DRAFT);
  });

  it('is null (the sample) for no stored draft, no draft store, no IndexedDB, a failing read, a throwing open and a browser that never answers', async () => {
    expect(await readStoredDraft(stub({ value: undefined }).factory)).toBeNull();
    expect(await readStoredDraft(stub({ stores: [], value: stored }).factory)).toBeNull();
    expect(await readStoredDraft(null)).toBeNull();
    expect(await readStoredDraft(stub({ getError: true, value: stored }).factory)).toBeNull();
    expect(await readStoredDraft(stub({ openThrows: true }).factory)).toBeNull();
    expect(await readStoredDraft(stub({ openNever: true }).factory, 20)).toBeNull();
    expect(draftOrSample(await readStoredDraft(null))).toBe(SAMPLE_DRAFT);
  });

  it('hands hostile stored values on unvalidated, and the preview survives every one of them', async () => {
    for (const value of ['x', 42, [], { version: 99 }, { version: 1, octopus: 'no', projects: 'no' }, JSON.parse(String.raw`{"version":1,"__proto__":{"p":1},"octopus":{"template":"__proto__"}}`)]) {
      const read = await readStoredDraft(stub({ value }).factory);
      expect(() => draftOrSample(read)).not.toThrow();
      expect(draftOrSample(read).version).toBe(1);
    }
  });
});
