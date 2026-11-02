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
  const mid = seq.sample<{ value: number }>('entrance', 'main', 0.5).value;
  expect(mid).toBeGreaterThan(0);
  expect(mid).toBeLessThan(1);
});

test('sampling past the end holds the last value', async () => {
  const seq = await loadSequences();
  const last = SEQUENCE_DEFAULTS.headSwell.objects.main.keys.value.at(-1)![1];
  expect(seq.sample<{ value: number }>('headSwell', 'main', 99).value).toBeCloseTo(last, 6);
  expect(seq.sample<{ value: number }>('headSwell', 'main', -5).value).toBeCloseTo(0, 6);
});

test('studio is dev only', () => {
  expect(parseUrlState('?studio').studio).toBe(true);
  expect(parseUrlState('').studio).toBe(false);
  const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');
  expect(main).toMatch(/import\.meta\.env\.DEV\s*&&[^\n]*studio[^\n]*\{[\s\S]*import\('@theatre\/studio'\)/);
});
