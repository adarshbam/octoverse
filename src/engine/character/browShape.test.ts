import { expect, test } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import { browStroke } from './browShape';

const brow = NOX.face.brow;
const ends = (side: -1 | 1, lift = 0, tilt = 0) => {
  const s = browStroke(brow, side, lift, tilt);
  return { inner: s[0], outer: s[s.length - 1], samples: s };
};

test('brows are thickest just inside the middle and taper to round ends', () => {
  const { samples } = ends(1);
  const widths = samples.map(s => s.width);
  const widest = widths.indexOf(Math.max(...widths));
  expect(widths[widest]).toBeCloseTo(brow.thickness, 4);
  expect(widest / (widths.length - 1)).toBeGreaterThan(1 / 3);
  expect(widest / (widths.length - 1)).toBeLessThan(2 / 3);
  expect(widths[0]).toBeLessThan(brow.thickness * 0.7);
  expect(widths.at(-1)!).toBeLessThan(brow.thickness * 0.35);
});

test('each brow runs from its inner end to its drooping outer end, the left mirroring the right', () => {
  const right = ends(1);
  const left = ends(-1);
  expect([right.inner.x, right.inner.y]).toEqual([brow.inner[0], brow.inner[1]]);
  expect([right.outer.x, right.outer.y]).toEqual([brow.outer[0], brow.outer[1]]);
  expect(right.outer.y).toBeLessThan(right.inner.y);
  left.samples.forEach((s, i) => {
    expect(s.x).toBeCloseTo(-right.samples[i].x, 9);
    expect(s.y).toBeCloseTo(right.samples[i].y, 9);
  });
});

test('lift raises the whole brow by up to 0.04 units', () => {
  const rest = ends(1).samples;
  const up = ends(1, 1).samples;
  up.forEach((s, i) => expect(s.y - rest[i].y).toBeCloseTo(0.04, 6));
});

test('positive tilt raises the inner ends of both brows', () => {
  for (const side of [-1, 1] as const) {
    const rest = ends(side);
    const tilted = ends(side, 0, 1);
    expect(tilted.inner.y, `side ${side}`).toBeGreaterThan(rest.inner.y + 0.01);
    expect(tilted.outer.y, `side ${side}`).toBeLessThan(rest.outer.y - 0.01);
  }
});
