import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { parseUrlState } from '../behavior/urlState';
import { NOX_ENTRANCE, SEQUENCE_DEFAULTS } from '../../worlds/nox/sequences/defaults';
import { NOX_PROJECT_ID, loadNoxSequences, noxSequenceSet } from '../../worlds/nox/sequences/index';
import state from '../../worlds/nox/sequences/state.theatre.json';
import { loadSequences, loadWorldSequences } from './theatre';

test('the repo state loads in Node and samples the defaults', async () => {
  const seq = await loadNoxSequences();
  for (const id of Object.keys(SEQUENCE_DEFAULTS) as (keyof typeof SEQUENCE_DEFAULTS)[]) {
    const def = SEQUENCE_DEFAULTS[id];
    for (const [key, obj] of Object.entries(def.objects)) {
      for (const [prop, keys] of Object.entries(obj.keys)) {
        for (const [t, v] of keys) {
          const got = seq.sample<Record<string, number>>(id, key, t)[prop];
          expect(got).toBeCloseTo(v, 6);
        }
      }
    }
  }
  const mid = seq.sample<{ roll: number }>('arrival', 'main', 0.18).roll;
  expect(mid).toBeGreaterThan(0.9);
});

test('sampling past the end holds the last value', async () => {
  const seq = await loadNoxSequences();
  const { keys } = SEQUENCE_DEFAULTS.arrival.objects.main;
  for (const [prop, track] of Object.entries(keys)) {
    expect(seq.sample<Record<string, number>>('arrival', 'main', 99)[prop], prop).toBeCloseTo(track.at(-1)![1], 6);
    expect(seq.sample<Record<string, number>>('arrival', 'main', -5)[prop], prop).toBeCloseTo(0, 6);
  }
});

test('the real keys hold too: the entrance holds its last values past the end and its first before the start', async () => {
  const seq = await loadNoxSequences();
  const { keys } = SEQUENCE_DEFAULTS.entrance.objects.main;
  const end = seq.sample<Record<string, number>>('entrance', 'main', 99);
  const start = seq.sample<Record<string, number>>('entrance', 'main', -5);
  for (const [prop, track] of Object.entries(keys)) {
    expect(end[prop], prop).toBeCloseTo(track.at(-1)![1], 9);
    expect(start[prop], prop).toBeCloseTo(track[0][1], 9);
  }
});

test('the project loads once: every call shares one promise', () => {
  expect(loadNoxSequences()).toBe(loadNoxSequences());
  expect(loadSequences(noxSequenceSet(state))).toBe(loadSequences(noxSequenceSet(state)));
});

test('loading is memoised per project id: the same id is one promise, another id is a project of its own', async () => {
  const mine = { projectId: 'theatre-test-a', state, defaults: SEQUENCE_DEFAULTS, entrance: NOX_ENTRANCE };
  const first = loadSequences(mine);
  expect(loadSequences({ ...mine })).toBe(first);
  const other = loadSequences({ ...mine, projectId: 'theatre-test-b' });
  expect(other).not.toBe(first);
  // A second project is its own: both load, and both sample.
  const [a, b] = await Promise.all([first, other]);
  expect(a).not.toBe(b);
  expect(a.sample<{ roll: number }>('arrival', 'main', 0.18).roll).toBeCloseTo(b.sample<{ roll: number }>('arrival', 'main', 0.18).roll, 12);
});

test('a StrictMode-style double call (two calls before the first settles) makes one project: Theatre would throw on a duplicate id', async () => {
  const spec = { projectId: 'theatre-test-strict', state, defaults: SEQUENCE_DEFAULTS, entrance: NOX_ENTRANCE };
  const calls = [loadSequences(spec), loadSequences(spec)];
  expect(calls[1]).toBe(calls[0]);
  await expect(Promise.all(calls)).resolves.toBeDefined();
  // ... and a call after it settled is still the same promise (the project is not made again).
  expect(loadSequences(spec)).toBe(calls[0]);
});

test('a failed load is forgotten, so the next call tries again', async () => {
  const bad = { projectId: 'theatre-test-bad', state: { not: 'a theatre state' }, defaults: SEQUENCE_DEFAULTS, entrance: NOX_ENTRANCE };
  const first = loadSequences(bad);
  await expect(first).rejects.toThrow();
  const again = loadSequences({ ...bad, state });
  expect(again).not.toBe(first);
  await expect(again).resolves.toBeDefined();
});

test('the entrance shape travels with the project (every set names its own: there is no default), and a sequence a world did not give is named', async () => {
  const nox = await loadNoxSequences();
  expect(nox.entrance).toEqual(NOX_ENTRANCE);
  expect(noxSequenceSet(state)).toMatchObject({ projectId: NOX_PROJECT_ID, entrance: { turn: 2 * Math.PI, spiral: true } });
  const quarter = await loadSequences({ projectId: 'theatre-test-turn', state, defaults: { arrival: SEQUENCE_DEFAULTS.arrival }, entrance: { ...NOX_ENTRANCE, turn: Math.PI / 2 } });
  expect(quarter.entrance.turn).toBe(Math.PI / 2);
  expect(quarter.entrance.arc).toEqual(NOX_ENTRANCE.arc);
  expect(() => quarter.sample('entrance', 'main', 0)).toThrow(/No sequence "entrance"/);
  // @ts-expect-error a sequence set without its entrance shape is not one
  const bare: Parameters<typeof loadSequences>[0] = { projectId: 'theatre-test-bare', state, defaults: SEQUENCE_DEFAULTS };
  expect(bare.projectId).toBe('theatre-test-bare');
});

test("a world's sequence set fetches its saved state on the first load only, and every load of its project id shares one promise", async () => {
  const fetchState = vi.fn(() => Promise.resolve(state));
  const set = { projectId: 'theatre-test-world', state: fetchState, defaults: SEQUENCE_DEFAULTS, entrance: NOX_ENTRANCE };
  const first = loadWorldSequences(set);
  expect(loadWorldSequences({ ...set })).toBe(first);
  const seq = await first;
  expect(loadWorldSequences(set)).toBe(first);
  expect(fetchState).toHaveBeenCalledTimes(1);
  expect(seq.length('headSwell')).toBe(SEQUENCE_DEFAULTS.headSwell.length);
});

test("a world's state that fails to arrive is forgotten, so the next load fetches it again", async () => {
  const fetchState = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(state);
  const set = { projectId: 'theatre-test-world-offline', state: fetchState, defaults: SEQUENCE_DEFAULTS, entrance: NOX_ENTRANCE };
  await expect(loadWorldSequences(set)).rejects.toThrow('offline');
  await expect(loadWorldSequences(set)).resolves.toBeDefined();
  expect(fetchState).toHaveBeenCalledTimes(2);
});

test('studio is dev only', () => {
  expect(parseUrlState('?studio').studio).toBe(true);
  expect(parseUrlState('').studio).toBe(false);
  const main = readFileSync(new URL('../../app/main.tsx', import.meta.url), 'utf8');
  expect(main).toMatch(/import\.meta\.env\.DEV\s*&&[^\n]*studio[^\n]*\{[\s\S]*import\('@theatre\/studio'\)/);
});
