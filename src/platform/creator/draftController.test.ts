import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DISCARD_ERROR, INITIAL_VIEW, announcement, createDraftController, resolveLoaded, statusLabel } from './draftController';
import { withOctopus } from './draftEdits';
import { SAMPLE_DRAFT } from './sampleDraft';
import type { DraftStore } from './storage';
import type { CreatorDraft } from './types';

// useDraft's logic without React: the controller over a fake store (jsdom is not installed, so the hook itself is not rendered).
const STORED: CreatorDraft = { ...SAMPLE_DRAFT, octopus: { template: 'nox', palette: 'teal', personality: 'mysterious', name: 'Stored One' }, profile: { ...SAMPLE_DRAFT.profile, handle: 'stored-one' } };

interface Fake {
  store: DraftStore;
  saves: CreatorDraft[];
  discards: () => number;
}

function fakeStore(over: { stored?: unknown; persistent?: boolean; discard?: () => Promise<{ cleared: boolean }> } = {}): Fake {
  const saves: CreatorDraft[] = [];
  let discards = 0;
  const store: DraftStore = {
    persistent: over.persistent ?? true,
    load: async () => (over.stored === undefined ? null : (over.stored as CreatorDraft | null)),
    save: async draft => void saves.push(draft),
    putMedia: async () => 'id',
    getMedia: async () => null,
    discard: async () => {
      discards += 1;
      return over.discard ? over.discard() : { cleared: true };
    },
  };
  return { store, saves, discards: () => discards };
}

const settle = () => vi.advanceTimersByTimeAsync(0);
const namePatch = (name: string) => (d: CreatorDraft) => withOctopus(d, { name });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('loading', () => {
  it('is not ready until the stored draft is read, then shows it (migrated), saved', async () => {
    const fake = fakeStore({ stored: STORED });
    const c = createDraftController({ createStore: async () => fake.store });
    expect(c.getView()).toEqual(INITIAL_VIEW);
    c.start();
    expect(c.getView().ready).toBe(false);
    await settle();
    expect(c.getView()).toMatchObject({ ready: true, status: 'saved', discardError: null });
    expect(c.getView().draft).toEqual(STORED);
  });

  it('with nothing stored it shows the sample and saves nothing until an edit', async () => {
    const fake = fakeStore();
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    await vi.advanceTimersByTimeAsync(2000);
    expect(c.getView().draft).toBe(SAMPLE_DRAFT);
    expect(c.getView().ready).toBe(true);
    expect(fake.saves).toHaveLength(0);
  });

  it('a damaged stored draft is repaired, an unknown version is the empty draft', async () => {
    const c = createDraftController({ createStore: async () => fakeStore({ stored: { version: 9, junk: true } }).store });
    c.start();
    await settle();
    expect(c.getView().draft.projects).toEqual([]);
    expect(c.getView().draft.octopus.name).toBe('');
  });

  it('a memory store says "memory" at once', async () => {
    const c = createDraftController({ createStore: async () => fakeStore({ persistent: false }).store });
    c.start();
    await settle();
    expect(c.getView().status).toBe('memory');
  });

  it('a store that cannot be made is a memory store, with no unhandled rejection', async () => {
    const c = createDraftController({ createStore: () => Promise.reject(new Error('no storage')) });
    c.start();
    await settle();
    expect(c.getView()).toMatchObject({ ready: true, status: 'memory' });
    c.update(namePatch('Mo'));
    expect(c.getView().draft.octopus.name).toBe('Mo');
  });
});

describe('an edit before ready is applied on top of the loaded draft, not over it', () => {
  it('keeps the stored draft and adds the edit, then saves that', async () => {
    const fake = fakeStore({ stored: STORED });
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    c.update(d => withOctopus(d, { palette: 'rose' }));
    await settle();
    const { draft } = c.getView();
    expect(draft.octopus).toEqual({ ...STORED.octopus, palette: 'rose' });
    expect(draft.profile.handle).toBe('stored-one');
    await vi.advanceTimersByTimeAsync(800);
    expect(fake.saves).toHaveLength(1);
    expect(fake.saves[0].octopus.name).toBe('Stored One');
    expect(fake.saves[0].octopus.palette).toBe('rose');
  });

  it('several edits are applied in order', async () => {
    const fake = fakeStore({ stored: STORED });
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    c.update(namePatch('One'));
    c.update(d => withOctopus(d, { name: `${d.octopus.name} Two` }));
    await settle();
    expect(c.getView().draft.octopus.name).toBe('One Two');
    expect(c.getView().draft.octopus.template).toBe('nox');
  });

  it('with nothing stored the edit stays on the sample and is saved', async () => {
    const fake = fakeStore();
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    c.update(namePatch('Mo'));
    await vi.advanceTimersByTimeAsync(800);
    expect(c.getView().draft.octopus.name).toBe('Mo');
    expect(fake.saves.map(d => d.octopus.name)).toEqual(['Mo']);
  });

  it('resolveLoaded: edits go on the stored draft; nothing stored keeps the draft on hand', () => {
    const edit = (d: CreatorDraft) => withOctopus(d, { name: 'E' });
    expect(resolveLoaded(STORED, SAMPLE_DRAFT, [edit]).octopus).toEqual({ ...STORED.octopus, name: 'E' });
    expect(resolveLoaded(null, SAMPLE_DRAFT, [edit])).toBe(SAMPLE_DRAFT);
    expect(resolveLoaded(undefined, SAMPLE_DRAFT, [])).toBe(SAMPLE_DRAFT);
  });

  it('closed before the store opened: the edit is kept (saved on the stored draft) and nothing is emitted', async () => {
    const fake = fakeStore({ stored: STORED });
    let open: (s: DraftStore) => void = () => undefined;
    const c = createDraftController({ createStore: () => new Promise<DraftStore>(resolve => (open = resolve)) });
    const listener = vi.fn();
    c.subscribe(listener);
    c.start();
    c.update(namePatch('Early'));
    listener.mockClear();
    c.dispose();
    open(fake.store);
    await settle();
    expect(listener).not.toHaveBeenCalled();
    expect(fake.saves).toHaveLength(1);
    expect(fake.saves[0].octopus.name).toBe('Early');
    expect(fake.saves[0].profile.handle).toBe('stored-one');
  });
});

describe('discard', () => {
  it('before the store is ready waits for it, then clears and goes back to the sample', async () => {
    const fake = fakeStore({ stored: STORED });
    let open: (s: DraftStore) => void = () => undefined;
    const c = createDraftController({ createStore: () => new Promise<DraftStore>(resolve => (open = resolve)) });
    c.start();
    let result: { cleared: boolean } | null = null;
    void c.discard().then(r => (result = r));
    await settle();
    expect(result).toBeNull();
    expect(fake.discards()).toBe(0);
    open(fake.store);
    await settle();
    expect(result).toEqual({ cleared: true });
    expect(fake.discards()).toBe(1);
    expect(c.getView().draft).toBe(SAMPLE_DRAFT);
  });

  it('cleared: the draft is the sample again and the error is gone', async () => {
    const fake = fakeStore({ stored: STORED });
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    await settle();
    expect(await c.discard()).toEqual({ cleared: true });
    expect(c.getView()).toMatchObject({ discardError: null, ready: true });
    expect(c.getView().draft).toBe(SAMPLE_DRAFT);
  });

  it('not cleared: the draft stays on screen, the error says so, the status is unchanged, and a retry that works clears it', async () => {
    let works = false;
    const fake = fakeStore({ stored: STORED, discard: async () => ({ cleared: works }) });
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    await settle();
    const before = c.getView();
    expect(await c.discard()).toEqual({ cleared: false });
    expect(c.getView().discardError).toBe(DISCARD_ERROR);
    expect(c.getView().draft).toBe(before.draft);
    expect(c.getView().status).toBe(before.status);
    works = true;
    expect(await c.discard()).toEqual({ cleared: true });
    expect(c.getView().discardError).toBeNull();
    expect(c.getView().draft).toBe(SAMPLE_DRAFT);
  });

  it('a store whose discard throws counts as not cleared', async () => {
    const fake = fakeStore({ stored: STORED, discard: () => Promise.reject(new Error('boom')) });
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    await settle();
    expect(await c.discard()).toEqual({ cleared: false });
    expect(c.getView().draft).toEqual(STORED);
    expect(c.getView().discardError).toBe(DISCARD_ERROR);
  });

  it('the next edit clears the error', async () => {
    const fake = fakeStore({ stored: STORED, discard: async () => ({ cleared: false }) });
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    await settle();
    await c.discard();
    expect(c.getView().discardError).not.toBeNull();
    c.update(namePatch('Again'));
    expect(c.getView().discardError).toBeNull();
  });

  it('a change waiting to be saved is never saved over a successful discard (the old draft is not rewritten)', async () => {
    const fake = fakeStore({ stored: STORED });
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    await settle();
    c.update(namePatch('Pending'));
    expect(await c.discard()).toEqual({ cleared: true });
    await vi.advanceTimersByTimeAsync(3000);
    expect(fake.saves).toHaveLength(0);
    expect(c.getView().draft).toBe(SAMPLE_DRAFT);
  });

  it('a change waiting when the discard fails stays pending and is still saved', async () => {
    const fake = fakeStore({ stored: STORED, discard: async () => ({ cleared: false }) });
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    await settle();
    c.update(namePatch('Pending'));
    await c.discard();
    await vi.advanceTimersByTimeAsync(800);
    expect(fake.saves.map(d => d.octopus.name)).toEqual(['Pending']);
  });

  it('an edit made while the discard is under way is ignored (it would be saved over the clear)', async () => {
    let release: (r: { cleared: boolean }) => void = () => undefined;
    const fake = fakeStore({ stored: STORED, discard: () => new Promise(resolve => (release = resolve)) });
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    await settle();
    const done = c.discard();
    await settle();
    c.update(namePatch('During'));
    release({ cleared: true });
    await done;
    await vi.advanceTimersByTimeAsync(3000);
    expect(fake.saves).toHaveLength(0);
    expect(c.getView().draft).toBe(SAMPLE_DRAFT);
  });

  it('in memory mode a cleared discard keeps the status "memory"', async () => {
    const fake = fakeStore({ persistent: false });
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    await settle();
    await c.discard();
    expect(c.getView().status).toBe('memory');
  });

  it('a second discard while one is under way does nothing: not cleared, the store is asked once, the first still finishes it', async () => {
    let release: (r: { cleared: boolean }) => void = () => undefined;
    const fake = fakeStore({ stored: STORED, discard: () => new Promise(resolve => (release = resolve)) });
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    await settle();
    const first = c.discard();
    await settle();
    expect(await c.discard()).toEqual({ cleared: false });
    // The refused call must not end the first one's "discarding" state or touch the view.
    expect(c.getView().discarding).toBe(true);
    expect(fake.discards()).toBe(1);
    release({ cleared: true });
    expect(await first).toEqual({ cleared: true });
    expect(c.getView()).toMatchObject({ discarding: false, discardError: null });
    expect(c.getView().draft).toBe(SAMPLE_DRAFT);
    expect(fake.discards()).toBe(1);
  });

  it('a discard after a failed one is allowed (Retry)', async () => {
    let tries = 0;
    const fake = fakeStore({ stored: STORED, discard: async () => ({ cleared: ++tries > 1 }) });
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    await settle();
    expect(await c.discard()).toEqual({ cleared: false });
    expect(c.getView().discardError).toBe(DISCARD_ERROR);
    expect(await c.discard()).toEqual({ cleared: true });
    expect(c.getView().discardError).toBeNull();
  });

  it('after dispose a discard does nothing', async () => {
    const fake = fakeStore();
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    await settle();
    c.dispose();
    expect(await c.discard()).toEqual({ cleared: false });
    expect(fake.discards()).toBe(0);
  });
});

describe('dispose', () => {
  it('after ready, saves a pending debounced edit at once and emits nothing afterwards', async () => {
    const fake = fakeStore({ stored: STORED });
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    await settle();
    c.update(namePatch('Last words'));
    expect(fake.saves).toHaveLength(0);
    const listener = vi.fn();
    c.subscribe(listener);
    c.dispose();
    await vi.advanceTimersByTimeAsync(3000);
    expect(fake.saves.map(d => d.octopus.name)).toEqual(['Last words']);
    expect(listener).not.toHaveBeenCalled();
    c.update(namePatch('Too late'));
    await vi.advanceTimersByTimeAsync(3000);
    expect(fake.saves).toHaveLength(1);
  });

  it('with nothing pending it saves nothing', async () => {
    const fake = fakeStore({ stored: STORED });
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    await settle();
    c.dispose();
    await vi.advanceTimersByTimeAsync(3000);
    expect(fake.saves).toHaveLength(0);
  });
});

describe('a failed discard', () => {
  it('leaves the status from the store, not stuck at "saving" by the save it cancelled', async () => {
    let finish: () => void = () => undefined;
    const fake = fakeStore({ stored: STORED, discard: async () => ({ cleared: false }) });
    fake.store.save = () => new Promise<void>(resolve => (finish = resolve));
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    await settle();
    c.update(namePatch('In flight'));
    await vi.advanceTimersByTimeAsync(800);
    expect(c.getView().status).toBe('saving');
    await c.discard();
    expect(c.getView().discardError).toBe(DISCARD_ERROR);
    expect(c.getView().status).toBe('saved');
    finish();
    await settle();
    expect(c.getView().status).toBe('saved');
  });

  it('on a memory store the status is "memory"', async () => {
    const fake = fakeStore({ persistent: false, discard: async () => ({ cleared: false }) });
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    await settle();
    await c.discard();
    expect(c.getView().status).toBe('memory');
  });

  it('says it is discarding while it waits, so the screen can refuse edits (they are not silently dropped)', async () => {
    let release: (r: { cleared: boolean }) => void = () => undefined;
    const fake = fakeStore({ stored: STORED, discard: () => new Promise(resolve => (release = resolve)) });
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    await settle();
    const done = c.discard();
    await settle();
    expect(c.getView().discarding).toBe(true);
    release({ cleared: false });
    await done;
    expect(c.getView().discarding).toBe(false);
  });
});

describe('what a screen reader hears', () => {
  it('says loading until ready, then saved or cannot-save or the discard error; saving reads as saved', () => {
    const base = { ready: true, status: 'saved' as const, discardError: null };
    expect(announcement({ ...base, ready: false })).toBe('Loading your draft');
    expect(announcement(base)).toBe('Saved in this browser');
    expect(announcement({ ...base, status: 'saving' })).toBe(announcement(base));
    expect(announcement({ ...base, status: 'memory' })).toMatch(/Cannot save/);
    expect(announcement({ ...base, discardError: DISCARD_ERROR })).toBe(DISCARD_ERROR);
    expect(announcement({ ready: false, status: 'memory', discardError: DISCARD_ERROR })).toBe('Loading your draft');
  });
});

describe('the visible status line', () => {
  const base = { ready: true, status: 'saved' as const, discardError: null, discarding: false };
  it('says Loading, Saving, Saved in this browser, Cannot save in this browser, Discarding', () => {
    expect(statusLabel({ ...base, ready: false })).toBe('Loading…');
    expect(statusLabel(base)).toBe('Saved in this browser');
    expect(statusLabel({ ...base, status: 'saving' })).toBe('Saving…');
    expect(statusLabel({ ...base, status: 'memory' })).toBe("Can't save in this browser");
    expect(statusLabel({ ...base, discarding: true })).toBe('Discarding…');
    expect(statusLabel({ ...base, ready: false, discarding: true })).toBe('Loading…');
  });

  it('a failed discard leaves the status of the store (the message is its own line)', () => {
    expect(statusLabel({ ...base, discardError: DISCARD_ERROR })).toBe('Saved in this browser');
  });

  it('the announcement says a discard is under way, and still reads saving as saved', () => {
    expect(announcement({ ...base, discarding: true })).toBe('Discarding your draft');
    expect(announcement({ ...base, status: 'saving', discarding: false })).toBe('Saved in this browser');
  });
});

describe('images through the store', () => {
  it('putMedia waits for the store and returns its id; getMedia returns the blob', async () => {
    const blob = new Blob(['x']);
    const fake = fakeStore();
    fake.store.putMedia = async () => 'media-7';
    fake.store.getMedia = async id => (id === 'media-7' ? blob : null);
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    const early = c.putMedia(blob);
    await settle();
    expect(await early).toBe('media-7');
    expect(await c.getMedia('media-7')).toBe(blob);
    expect(await c.getMedia('other')).toBeNull();
  });

  it('a refused image rejects with the store error', async () => {
    const fake = fakeStore();
    fake.store.putMedia = async () => {
      throw new Error('refused');
    };
    const c = createDraftController({ createStore: async () => fake.store });
    c.start();
    await settle();
    await expect(c.putMedia(new Blob(['x']))).rejects.toThrow('refused');
  });

  it('before start or after dispose there is no store: putMedia rejects, getMedia gives null', async () => {
    const c = createDraftController({ createStore: async () => fakeStore().store });
    await expect(c.putMedia(new Blob(['x']))).rejects.toThrow();
    expect(await c.getMedia('x')).toBeNull();
  });
});
