import { afterEach, expect, test, vi } from 'vitest';
import { entranceSeenKey, readEntranceSeen, rememberEntranceSeen } from './useStage';

afterEach(() => vi.unstubAllGlobals());

/** A sessionStorage stand-in that records every call. */
function stubStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  const calls: string[] = [];
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => (calls.push(`get ${key}`), items.get(key) ?? null),
    setItem: (key: string, value: string) => (calls.push(`set ${key}`), void items.set(key, value)),
  });
  return { items, calls };
}

test('the entrance flag is keyed by world, and Nox keeps its old key', () => {
  expect(entranceSeenKey('nox')).toBe('octoverse.nox.entranceSeen');
  expect(entranceSeenKey('veyra')).toBe('octoverse.veyra.entranceSeen');
  expect(entranceSeenKey('veyra')).not.toBe(entranceSeenKey('nox'));
});

test('a page instance reads and writes its own world\'s flag only', () => {
  const { items } = stubStorage({ 'octoverse.nox.entranceSeen': '1' });
  expect(readEntranceSeen('nox', 'page')).toBe(true);
  expect(readEntranceSeen('veyra', 'page')).toBe(false);
  rememberEntranceSeen('veyra', 'page');
  expect(items.get('octoverse.veyra.entranceSeen')).toBe('1');
});

test('a preview instance never reads or writes the storage', () => {
  const { items, calls } = stubStorage({ 'octoverse.nox.entranceSeen': '1' });
  expect(readEntranceSeen('nox', 'preview')).toBe(false);
  rememberEntranceSeen('nox', 'preview');
  expect(calls).toEqual([]);
  expect([...items.keys()]).toEqual(['octoverse.nox.entranceSeen']);
});

test('unavailable storage reads as not seen and writes nothing', () => {
  vi.stubGlobal('sessionStorage', {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  });
  expect(readEntranceSeen('nox', 'page')).toBe(false);
  expect(() => rememberEntranceSeen('nox', 'page')).not.toThrow();
});
