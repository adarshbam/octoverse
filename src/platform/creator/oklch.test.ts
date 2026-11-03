import { describe, expect, it } from 'vitest';
import { fromOklch, toOklch } from './oklch';

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0');
const channels = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hueDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

describe('oklch', () => {
  it('round-trips 50 seeded sRGB colours within 1 per channel', () => {
    const rnd = mulberry32(1234);
    for (let i = 0; i < 50; i++) {
      const rgb = [0, 0, 0].map(() => Math.floor(rnd() * 256));
      const hex = '#' + rgb.map(hex2).join('');
      const { l, c, h } = toOklch(hex);
      const back = channels(fromOklch(l, c, h));
      back.forEach((v, k) => expect(Math.abs(v - rgb[k])).toBeLessThanOrEqual(1));
    }
  });

  it('accepts upper case and returns lower case hex', () => {
    const { l, c, h } = toOklch('#FF8800');
    expect(fromOklch(l, c, h)).toMatch(/^#[0-9a-f]{6}$/);
    expect(toOklch('#FF8800')).toEqual(toOklch('#ff8800'));
  });

  it('white, black and greys have ~0 chroma', () => {
    const w = toOklch('#ffffff');
    expect(w.l).toBeCloseTo(1, 3);
    expect(w.c).toBeLessThan(0.002);
    const k = toOklch('#000000');
    expect(k.l).toBeCloseTo(0, 3);
    expect(k.c).toBeLessThan(0.002);
    expect(toOklch('#808080').c).toBeLessThan(0.002);
    expect(toOklch('#333333').c).toBeLessThan(0.002);
  });

  it('known value: pure red', () => {
    const { l, c, h } = toOklch('#ff0000');
    expect(l).toBeCloseTo(0.628, 2);
    expect(c).toBeCloseTo(0.2577, 2);
    expect(h).toBeCloseTo(29.23, 0);
  });

  it('clips out-of-gamut requests by reducing chroma, keeping hue', () => {
    const out = fromOklch(0.9, 0.4, 140);
    expect(out).toMatch(/^#[0-9a-f]{6}$/);
    const back = toOklch(out);
    expect(back.c).toBeLessThan(0.4);
    expect(back.c).toBeGreaterThan(0.02);
    expect(hueDiff(back.h, 140)).toBeLessThanOrEqual(2);
  });

  it('wraps hue', () => {
    expect(fromOklch(0.7, 0.1, 370)).toBe(fromOklch(0.7, 0.1, 10));
    expect(fromOklch(0.7, 0.1, -350)).toBe(fromOklch(0.7, 0.1, 10));
  });

  it('clamps lightness', () => {
    expect(fromOklch(1.5, 0.2, 50)).toBe('#ffffff');
    expect(fromOklch(-0.5, 0.2, 50)).toBe('#000000');
  });
});
