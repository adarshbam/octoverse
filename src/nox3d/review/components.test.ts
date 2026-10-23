import { expect, test } from 'vitest';
import { COMPONENT_VIEWS } from './components';

test('every component box lies inside the panel and has positive area', () => {
  const entries = Object.entries(COMPONENT_VIEWS);
  expect(entries.length).toBe(11);
  for (const [id, { box: [x0, y0, x1, y1] }] of entries) {
    expect(x0 < x1 && y0 > y1, id).toBe(true);
    for (const x of [x0, x1]) expect(Math.abs(x), id).toBeLessThanOrEqual(2.53);
    for (const y of [y0, y1]) expect(Math.abs(y), id).toBeLessThanOrEqual(2.52);
  }
});
