import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { disposeAll, reclaim, retire, type Disposable } from './useDisposables';

const thing = () => ({ dispose: vi.fn() }) satisfies Disposable;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('disposeAll disposes every item once, and carries on past one that throws', () => {
  const a = thing();
  const bad = { dispose: vi.fn(() => { throw new Error('gone'); }) };
  const b = thing();
  expect(() => disposeAll([a, bad, a, b])).toThrow('gone');
  expect(a.dispose).toHaveBeenCalledTimes(1);
  expect(b.dispose).toHaveBeenCalledTimes(1);
});

test('retired items are disposed after the current tick, not before', () => {
  const items = [thing(), thing()];
  retire(items);
  expect(items[0].dispose).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(items[0].dispose).toHaveBeenCalledTimes(1);
  expect(items[1].dispose).toHaveBeenCalledTimes(1);
});

test('reclaimed items survive: a StrictMode cleanup and re-run leaves nothing disposed', () => {
  const items = [thing()];
  retire(items); // the simulated unmount
  reclaim(items); // the simulated mount straight after, on the same memo value
  vi.runAllTimers();
  expect(items[0].dispose).not.toHaveBeenCalled();
  // A later real unmount still disposes them.
  retire(items);
  vi.runAllTimers();
  expect(items[0].dispose).toHaveBeenCalledTimes(1);
});

test('a replaced list is disposed and its replacement is not', () => {
  const old = [thing()];
  const next = [thing()];
  retire(old); // the effect's cleanup for the old memo value
  reclaim(next); // the effect for the new one
  vi.runAllTimers();
  expect(old[0].dispose).toHaveBeenCalledTimes(1);
  expect(next[0].dispose).not.toHaveBeenCalled();
});

test('retiring twice disposes once', () => {
  const items = [thing()];
  retire(items);
  retire(items);
  vi.runAllTimers();
  expect(items[0].dispose).toHaveBeenCalledTimes(1);
});
