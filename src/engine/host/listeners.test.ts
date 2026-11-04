import { afterEach, expect, test, vi } from 'vitest';
import { attachWindowListeners } from './listeners';

/** A window stand-in that counts live registrations per type and capture flag. */
function stubWindow() {
  const live = new Map<string, Set<unknown>>();
  const add = vi.fn((type: string, listener: unknown, capture?: boolean) => {
    const key = `${type}${capture ? ':capture' : ''}`;
    (live.get(key) ?? live.set(key, new Set()).get(key)!).add(listener);
  });
  const remove = vi.fn((type: string, listener: unknown, capture?: boolean) => {
    live.get(`${type}${capture ? ':capture' : ''}`)?.delete(listener);
  });
  vi.stubGlobal('window', { addEventListener: add, removeEventListener: remove });
  const count = () => [...live.values()].reduce((sum, set) => sum + set.size, 0);
  return { add, remove, live, count };
}

afterEach(() => vi.unstubAllGlobals());

test('a preview calls window.addEventListener zero times', () => {
  const w = stubWindow();
  const off = attachWindowListeners('preview', ['keydown', 'pointerdown'], () => {});
  off();
  expect(w.add).not.toHaveBeenCalled();
  expect(w.remove).not.toHaveBeenCalled();
});

test('a page attaches once per type and removes them all on cleanup', () => {
  const w = stubWindow();
  const off = attachWindowListeners('page', ['keydown', 'pointerdown'], () => {});
  expect(w.add.mock.calls.map(c => c[0]).sort()).toEqual(['keydown', 'pointerdown']);
  expect(w.count()).toBe(2);
  off();
  expect(w.count()).toBe(0);
  expect(w.remove).toHaveBeenCalledTimes(2);
});

test('capture is passed through to both the add and the remove', () => {
  const w = stubWindow();
  attachWindowListeners('page', ['pointermove'], () => {}, true)();
  expect(w.add).toHaveBeenCalledWith('pointermove', expect.any(Function), true);
  expect(w.remove).toHaveBeenCalledWith('pointermove', expect.any(Function), true);
  expect(w.count()).toBe(0);
});

test('mount, unmount, mount leaves exactly one registration live', () => {
  const w = stubWindow();
  const first = attachWindowListeners('page', ['keydown'], () => {});
  first();
  const second = attachWindowListeners('page', ['keydown'], () => {});
  expect(w.count()).toBe(1);
  second();
  expect(w.count()).toBe(0);
});

test('a listener tells its type and the event to the caller', () => {
  const w = stubWindow();
  const seen: [string, string][] = [];
  attachWindowListeners('page', ['keydown', 'pointerdown'], (type, event) => seen.push([type, event.type]));
  for (const [, listener] of w.add.mock.calls.map(c => [c[0], c[1]] as const)) (listener as (event: Event) => void)(new Event('x'));
  expect(seen).toEqual([['keydown', 'x'], ['pointerdown', 'x']]);
});
