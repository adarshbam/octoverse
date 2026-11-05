import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_DRAFT } from './sampleDraft';
import { AUTOSAVE_MS, createAutosaver, type SaveStatus } from './useDraft';
import type { CreatorDraft } from './types';

// useDraft's debounce, as the pure helper the hook is built on (jsdom is not installed, so the hook itself is not rendered here).
const draftNamed = (name: string): CreatorDraft => ({ ...SAMPLE_DRAFT, octopus: { ...SAMPLE_DRAFT.octopus, name } });

function setup(options: { persistent?: () => boolean; save?: (d: CreatorDraft) => Promise<void> } = {}) {
  const saved: CreatorDraft[] = [];
  const statuses: SaveStatus[] = [];
  const save = options.save ?? (async (d: CreatorDraft) => void saved.push(d));
  const saver = createAutosaver({ save, persistent: options.persistent ?? (() => true), onStatus: s => statuses.push(s) });
  return { saver, saved, statuses };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createAutosaver', () => {
  it('waits 800 ms after the last change, then saves the latest draft once', async () => {
    expect(AUTOSAVE_MS).toBe(800);
    const { saver, saved, statuses } = setup();
    saver.schedule(draftNamed('a'));
    await vi.advanceTimersByTimeAsync(799);
    expect(saved).toHaveLength(0);
    saver.schedule(draftNamed('b'));
    await vi.advanceTimersByTimeAsync(799);
    expect(saved).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(saved.map(d => d.octopus.name)).toEqual(['b']);
    expect(statuses).toEqual(['saving', 'saving', 'saved']);
  });

  it('a change after a save starts a new wait', async () => {
    const { saver, saved } = setup();
    saver.schedule(draftNamed('a'));
    await vi.advanceTimersByTimeAsync(800);
    saver.schedule(draftNamed('b'));
    await vi.advanceTimersByTimeAsync(800);
    expect(saved.map(d => d.octopus.name)).toEqual(['a', 'b']);
  });

  it('says "memory" when the store cannot keep it, before and after the save', async () => {
    const { saver, statuses } = setup({ persistent: () => false });
    saver.schedule(draftNamed('a'));
    await vi.advanceTimersByTimeAsync(800);
    expect(statuses).toEqual(['memory', 'memory']);
  });

  it('turns to "memory" when the store stops being persistent during the save', async () => {
    let persistent = true;
    const { saver, statuses } = setup({ persistent: () => persistent, save: async () => void (persistent = false) });
    saver.schedule(draftNamed('a'));
    await vi.advanceTimersByTimeAsync(800);
    expect(statuses.at(-1)).toBe('memory');
  });

  it('a save that rejects is "memory", not a crash', async () => {
    const { saver, statuses } = setup({ save: () => Promise.reject(new Error('boom')) });
    saver.schedule(draftNamed('a'));
    await vi.advanceTimersByTimeAsync(800);
    expect(statuses.at(-1)).toBe('memory');
  });

  it('flush saves a pending draft at once (and nothing when there is none)', async () => {
    const { saver, saved } = setup();
    await saver.flush();
    expect(saved).toHaveLength(0);
    saver.schedule(draftNamed('a'));
    expect(saver.pending()).toBe(true);
    await saver.flush();
    expect(saved.map(d => d.octopus.name)).toEqual(['a']);
    expect(saver.pending()).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(saved).toHaveLength(1);
  });

  it('cancel drops the pending save and the timer (unmount, discard) and a save in flight does not set the status after it', async () => {
    const { saver, saved, statuses } = setup();
    saver.schedule(draftNamed('a'));
    saver.cancel();
    expect(saver.pending()).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(saved).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);

    let release: () => void = () => undefined;
    const slow = setup({ save: () => new Promise<void>(resolve => (release = resolve)) });
    slow.saver.schedule(draftNamed('b'));
    await vi.advanceTimersByTimeAsync(800);
    slow.saver.cancel();
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(slow.statuses).toEqual(['saving']);
    void statuses;
  });

  it('saves one at a time, in order, when a change arrives during a save', async () => {
    const order: string[] = [];
    let release: () => void = () => undefined;
    let first = true;
    const { saver } = setup({
      save: d => {
        order.push(`start ${d.octopus.name}`);
        const gate = first ? new Promise<void>(resolve => (release = resolve)) : Promise.resolve();
        first = false;
        return gate.then(() => void order.push(`end ${d.octopus.name}`));
      },
    });
    saver.schedule(draftNamed('a'));
    await vi.advanceTimersByTimeAsync(800);
    saver.schedule(draftNamed('b'));
    await vi.advanceTimersByTimeAsync(800);
    expect(order).toEqual(['start a']);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual(['start a', 'end a', 'start b', 'end b']);
  });
});
