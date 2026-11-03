import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parseUrlState } from '../behavior/urlState';
import { SEQUENCE_DEFAULTS } from './keys';
import { loadSequences } from './theatre';

test('the repo state loads in Node and samples the defaults', async () => {
  const seq = await loadSequences();
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
  const seq = await loadSequences();
  const { keys } = SEQUENCE_DEFAULTS.arrival.objects.main;
  for (const [prop, track] of Object.entries(keys)) {
    expect(seq.sample<Record<string, number>>('arrival', 'main', 99)[prop], prop).toBeCloseTo(track.at(-1)![1], 6);
    expect(seq.sample<Record<string, number>>('arrival', 'main', -5)[prop], prop).toBeCloseTo(0, 6);
  }
});

test('the real keys hold too: the entrance holds its last values past the end and its first before the start', async () => {
  const seq = await loadSequences();
  const { keys } = SEQUENCE_DEFAULTS.entrance.objects.main;
  const end = seq.sample<Record<string, number>>('entrance', 'main', 99);
  const start = seq.sample<Record<string, number>>('entrance', 'main', -5);
  for (const [prop, track] of Object.entries(keys)) {
    expect(end[prop], prop).toBeCloseTo(track.at(-1)![1], 9);
    expect(start[prop], prop).toBeCloseTo(track[0][1], 9);
  }
});

test('the project loads once: every call shares one promise', () => {
  expect(loadSequences()).toBe(loadSequences());
});

test('studio is dev only', () => {
  expect(parseUrlState('?studio').studio).toBe(true);
  expect(parseUrlState('').studio).toBe(false);
  const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');
  expect(main).toMatch(/import\.meta\.env\.DEV\s*&&[^\n]*studio[^\n]*\{[\s\S]*import\('@theatre\/studio'\)/);
});
