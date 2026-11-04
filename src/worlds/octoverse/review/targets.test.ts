import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import targets from './targets.json';
import stageSamples from './stage_samples.json';
import worldSamples from './world_samples.json';

// The host's reference checks (platform spec 2.1 and 2.2): the sample table and the global rules hold on
// the reference panels themselves, so a render is later judged against numbers that are themselves true.

interface Png { width: number; height: number; channels: number; data: Uint8Array }

/** A minimal PNG reader: 8-bit, non-interlaced, grey (type 0), RGB (type 2) or RGBA (type 6). */
function readPng(path: string): Png {
  const buf = readFileSync(path);
  let width = 0, height = 0, channels = 0;
  const idat: Buffer[] = [];
  for (let at = 8; at < buf.length; ) {
    const len = buf.readUInt32BE(at);
    const type = buf.toString('ascii', at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      expect(body[8], 'bit depth').toBe(8);
      expect(body[12], 'interlace').toBe(0);
      channels = ({ 0: 1, 2: 3, 6: 4 } as Record<number, number>)[body[9]!]!;
      expect(channels, 'colour type').toBeGreaterThan(0);
    } else if (type === 'IDAT') idat.push(body);
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i]!;
      const a = i >= channels ? data[y * stride + i - channels]! : 0;
      const b = y > 0 ? data[(y - 1) * stride + i]! : 0;
      const c = y > 0 && i >= channels ? data[(y - 1) * stride + i - channels]! : 0;
      let v: number;
      if (filter === 0) v = x;
      else if (filter === 1) v = x + a;
      else if (filter === 2) v = x + b;
      else if (filter === 3) v = x + ((a + b) >> 1);
      else {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      data[y * stride + i] = v & 255;
    }
  }
  return { width, height, channels, data };
}

const ref = (name: string) => readPng(`public/octoverse/ref/${name}.png`);
const panels = { p1: ref('p1'), p2: ref('p2'), p3: ref('p3') };

/** The mean RGB of a `size` x `size` square centred on (x, y): pixels x - floor(size / 2) up to x - floor(size / 2) + size - 1. */
function areaMean(p: Png, x: number, y: number, size: number): number[] {
  const o = Math.floor(size / 2), sum = [0, 0, 0];
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const at = ((y - o + j) * p.width + (x - o + i)) * p.channels;
    for (let c = 0; c < 3; c++) sum[c]! += p.data[at + c]!;
  }
  return sum.map((v) => v / (size * size));
}

const byName = (name: string) => targets.samples.find((s) => s.name === name)!.rgb;
const faces = ['between the eyes', 'face glow beside mouth', 'chin', 'P3 face glow'].map(byName);

describe('sample table', () => {
  test('22 samples: 17 on P2, 2 on P3, 3 on P1', () => {
    expect(targets.samples.length).toBe(22);
    expect(targets.samples.filter((s) => s.panel === 'p2').length).toBe(17);
    expect(targets.samples.filter((s) => s.panel === 'p3').length).toBe(2);
    expect(targets.samples.filter((s) => s.panel === 'p1').length).toBe(3);
    expect(new Set(targets.samples.map((s) => s.name)).size).toBe(22);
    expect(targets.deltaE).toBe(10);
  });

  test.each(targets.samples.map((s) => [s.name, s] as const))('%s equals the area mean of its panel within 1 per channel', (_, s) => {
    const mean = areaMean(panels[s.panel as 'p1' | 'p2' | 'p3'], s.x, s.y, s.size);
    s.rgb.forEach((v, c) => expect(Math.abs(mean[c]! - v), `${s.name} channel ${c}`).toBeLessThanOrEqual(1));
  });
});

describe('global checks hold on the reference samples', () => {
  const k = targets.checks;
  test('peach face, not pink-white: B - G <= 15 and R - B >= 60 on every face-glow sample', () => {
    for (const [r, g, b] of faces) {
      expect(b! - g!).toBeLessThanOrEqual(k.faceBminusGmax);
      expect(r! - b!).toBeGreaterThanOrEqual(k.faceRminusBmin);
    }
    // Aether's face glow (253, 212, 232) fails both, which is the point of the check.
    expect(232 - 212).toBeGreaterThan(k.faceBminusGmax);
    expect(253 - 232).toBeLessThan(k.faceRminusBmin);
  });
  test('blue crown over a violet head', () => {
    const [cr, , cb] = byName('crown');
    const [ur, ug] = byName('upper head');
    expect(cb! - cr!).toBe(167);
    expect(cb! - cr!).toBeGreaterThanOrEqual(k.crownBminusRmin);
    expect(ur! - ug!).toBeGreaterThanOrEqual(k.upperHeadRminusGmin);
  });
  test('warm core on a cool body: between-the-eyes R is at least 100 over the upper head R', () => {
    expect(byName('between the eyes')[0]! - byName('upper head')[0]!).toBeGreaterThanOrEqual(k.coreOverHeadRmin);
  });
  test('warm cups: R - B >= 60', () => {
    const [r, , b] = byName('cup rim');
    expect(r! - b!).toBeGreaterThanOrEqual(k.cupRminusBmin);
  });
  test('indigo water, not black: mid water B >= 60 and B - R >= 55', () => {
    const [r, , b] = byName('mid water');
    expect(b!).toBeGreaterThanOrEqual(k.midWaterBmin);
    expect(b! - r!).toBeGreaterThanOrEqual(k.midWaterBminusRmin);
  });
});

describe('shape targets and the mask', () => {
  test('the shape ranges are the spec 2.2 values', () => {
    expect(targets.head).toEqual({ halfWidth: [0.80, 0.88], top: [0.29, 0.37], centreX: [-0.04, 0.04] });
    expect(targets.eyes).toEqual({ y: [-0.60, -0.52], x: [0.36, 0.42] });
    expect(targets.mouthY).toEqual([-0.90, -0.82]);
    expect(targets.armSpan).toEqual([4.5, 4.9]);
    expect(targets.iou).toBe(0.85);
  });

  test('the mask covers the octopus: head, mouth and arms in; title, a card and the pill out', () => {
    const m = ref('p2-mask');
    expect([m.width, m.height]).toEqual([512, 508]);
    const on = (x: number, y: number) => m.data[y * m.width + x]! > 127;
    expect(on(256, 300), 'head').toBe(true);
    expect(on(256, 338), 'mouth').toBe(true);
    expect(on(100, 350), 'left arm').toBe(true);
    expect(on(392, 400), 'right arm cup rim').toBe(true);
    expect(on(256, 120), 'title').toBe(false);
    expect(on(50, 230), 'left card').toBe(false);
    expect(on(256, 480), 'pill').toBe(false);
  });

  test('meanInside is the mean colour of P2 inside the mask, with its saturation and brightness', () => {
    const p = panels.p2, m = ref('p2-mask');
    const sum = [0, 0, 0];
    let n = 0, sat = 0, val = 0;
    for (let i = 0; i < m.width * m.height; i++) {
      if (m.data[i]! <= 127) continue;
      const r = p.data[i * 3]!, g = p.data[i * 3 + 1]!, b = p.data[i * 3 + 2]!;
      sum[0]! += r; sum[1]! += g; sum[2]! += b; n++;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      sat += mx > 0 ? (mx - mn) / mx : 0; val += mx / 255;
    }
    expect(sum.map((v) => Math.round(v / n))).toEqual(targets.meanInside.rgb);
    expect(sat / n).toBeCloseTo(targets.meanInside.saturation, 3);
    expect(val / n).toBeCloseTo(targets.meanInside.brightness, 3);
    expect(targets.meanInside.tolerance).toBe(12);
    expect(targets.meanInside.satTolerance).toBe(0.04);
  });
});

describe('the files scripts/check_stage.py reads', () => {
  test('stage_samples.json panel 2 holds the 17 P2 samples as [world x, world y, panel px, panel py]', () => {
    const spec = stageSamples['2'];
    const p2 = targets.samples.filter((s) => s.panel === 'p2');
    expect(Object.keys(spec.points).sort()).toEqual(p2.map((s) => s.name).sort());
    for (const s of p2) {
      const [wx, wy, px, py] = (spec.points as Record<string, number[]>)[s.name]!;
      expect([px, py]).toEqual([s.x, s.y]);
      // The native P2 centre (256, 254), +y up, 100 px a unit.
      expect(wx).toBeCloseTo((s.x - 256) / 100, 6);
      expect(wy).toBeCloseTo((254 - s.y) / 100, 6);
    }
    expect(spec.hq).toMatchObject({ image: 'public/octoverse/ref/p2.png', origin: [256, 254], pxPerUnit: 100 });
  });
  test('world_samples.json carries the recorded mean and the same delta E', () => {
    expect(worldSamples.target.mean).toEqual(targets.meanInside.rgb);
    expect(worldSamples.target.deltaE).toBe(targets.deltaE);
    expect(Object.keys(worldSamples.regions).length).toBe(17);
  });
});
