import { expect, test } from 'vitest';
import { DOME_REACH, domeState } from './domeMaterial';

test('the dome never shrinks or slides: it keeps its full size and place while it opens', () => {
  for (const open of [0.05, 0.3, 0.6, 1]) {
    const s = domeState(open);
    expect(s.scale, `open ${open}`).toBe(1);
    expect(s.offset, `open ${open}`).toBe(0);
  }
});

test('the glass is revealed outward from its seat on the head, all of it once fully open', () => {
  expect(domeState(0).reveal).toBe(0);
  expect(domeState(0).visible).toBe(false);
  let last = 0;
  for (let open = 0.05; open <= 1.0001; open += 0.05) {
    const { reveal } = domeState(open);
    expect(reveal).toBeGreaterThan(last);
    last = reveal;
  }
  // The farthest point of the dome from its seat (a top corner) is DOME_REACH away.
  expect(domeState(1).reveal).toBeGreaterThanOrEqual(DOME_REACH);
  expect(DOME_REACH).toBeGreaterThan(Math.SQRT2);
});

test('the glass fades in over the first moments of the reveal instead of popping', () => {
  expect(domeState(0.02).opacity).toBeLessThan(0.3);
  expect(domeState(0.2).opacity).toBe(1);
});
