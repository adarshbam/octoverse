import { describe, expect, it, vi } from 'vitest';
import { createPreviewSlot } from './previewSlot';

describe('the one-live-preview slot (spec 7.14)', () => {
  it('starts empty', () => {
    expect(createPreviewSlot().current()).toBeNull();
  });

  it('two requests leave only the second owner', () => {
    const slot = createPreviewSlot();
    expect(slot.request('veyra')).toBe(true);
    expect(slot.current()).toBe('veyra');
    expect(slot.request('flux')).toBe(true);
    expect(slot.current()).toBe('flux');
  });

  it('rapid request A, B, A, release B leaves A', () => {
    const slot = createPreviewSlot();
    slot.request('A');
    slot.request('B');
    slot.request('A');
    slot.release('B');
    expect(slot.current()).toBe('A');
  });

  it('a release by a non-owner is ignored; the owner releases it', () => {
    const slot = createPreviewSlot();
    slot.request('nox');
    slot.release('flux');
    expect(slot.current()).toBe('nox');
    slot.release('nox');
    expect(slot.current()).toBeNull();
  });

  it('notifies once per change, and not for a request by the owner or a release by a non-owner', () => {
    const slot = createPreviewSlot();
    const seen = vi.fn();
    slot.subscribe(seen);
    slot.request('a');
    expect(seen).toHaveBeenCalledTimes(1);
    slot.request('a');
    slot.release('b');
    expect(seen).toHaveBeenCalledTimes(1);
    slot.request('b');
    expect(seen).toHaveBeenCalledTimes(2);
    slot.release('b');
    expect(seen).toHaveBeenCalledTimes(3);
    slot.release('b');
    expect(seen).toHaveBeenCalledTimes(3);
  });

  it('unsubscribes: a callback that was removed hears nothing more, and the others still do', () => {
    const slot = createPreviewSlot();
    const first = vi.fn();
    const second = vi.fn();
    const off = slot.subscribe(first);
    slot.subscribe(second);
    slot.request('a');
    off();
    off();
    slot.request('b');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('a callback sees the new owner when it is told', () => {
    const slot = createPreviewSlot();
    const owners: (string | null)[] = [];
    slot.subscribe(() => owners.push(slot.current()));
    slot.request('a');
    slot.request('b');
    slot.release('b');
    expect(owners).toEqual(['a', 'b', null]);
  });

  it('slots are independent of each other (the platform has one, tests make their own)', () => {
    const one = createPreviewSlot();
    const two = createPreviewSlot();
    one.request('a');
    expect(two.current()).toBeNull();
  });
});
