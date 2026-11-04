import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import stageSamples from './stage_samples.json';
import targets from './targets.json';
import worldSamples from './world_samples.json';

// Veyra's colour targets are measured on the native P2 panel (public/veyra/ref/p2.png, 488 x 495). The repo has no
// PNG helper (Nox's review tests never decode one), so this reads the file itself: 8-bit, non-interlaced, grey or RGB.
const ROOT = join(import.meta.dirname, '..', '..', '..', '..');

interface Raster { width: number; height: number; channels: number; data: Uint8Array }

function decodePng(file: string): Raster {
  const buf = readFileSync(join(ROOT, file));
  expect(buf.subarray(1, 4).toString('latin1')).toBe('PNG');
  let width = 0, height = 0, channels = 0;
  const parts: Buffer[] = [];
  for (let at = 8; at < buf.length; ) {
    const length = buf.readUInt32BE(at);
    const type = buf.subarray(at + 4, at + 8).toString('latin1');
    const body = buf.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [depth, colour, , , interlace] = [body[8], body[9], body[10], body[11], body[12]];
      expect([depth, interlace], file).toEqual([8, 0]);
      channels = ({ 0: 1, 2: 3, 6: 4 } as Record<number, number>)[colour];
      expect(channels, `${file} colour type ${colour}`).toBeTruthy();
    }
    if (type === 'IDAT') parts.push(body);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const data = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i];
      const left = i >= channels ? data[y * stride + i - channels] : 0;
      const up = y > 0 ? data[(y - 1) * stride + i] : 0;
      const upLeft = y > 0 && i >= channels ? data[(y - 1) * stride + i - channels] : 0;
      const paeth = () => {
        const p = left + up - upLeft;
        const [a, b, c] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)];
        return a <= b && a <= c ? left : b <= c ? up : upLeft;
      };
      data[y * stride + i] = [x, x + left, x + up, x + ((left + up) >> 1), x + paeth()][filter] & 255;
    }
  }
  return { width, height, channels, data };
}

/** Mean RGB over the `size` x `size` square whose centre pixel is (x, y): columns x - floor(size / 2) .. + size - 1. */
function areaMean(img: Raster, x: number, y: number, size: number): number[] {
  const sum = [0, 0, 0];
  const x0 = x - Math.floor(size / 2), y0 = y - Math.floor(size / 2);
  for (let j = y0; j < y0 + size; j++)
    for (let i = x0; i < x0 + size; i++) for (let c = 0; c < 3; c++) sum[c] += img.data[(j * img.width + i) * img.channels + c];
  return sum.map((v) => v / (size * size));
}

const p2 = decodePng('public/veyra/ref/p2.png');
const mask = decodePng('public/veyra/ref/p2-mask.png');
const sample = (name: string) => targets.samples.find((s) => s.name === name)!;

describe('Veyra P2 reference targets', () => {
  test('the reference is the native 488 x 495 RGB panel and its mask is the same size', () => {
    expect([p2.width, p2.height, p2.channels]).toEqual([488, 495, 3]);
    expect([mask.width, mask.height, mask.channels]).toEqual([488, 495, 1]);
  });

  test('there are 13 samples, each inside the panel with its area', () => {
    expect(targets.samples).toHaveLength(13);
    expect(new Set(targets.samples.map((s) => s.name)).size).toBe(13);
    for (const { name, x, y, size } of targets.samples) {
      const h = Math.floor(size / 2);
      expect(x - h, name).toBeGreaterThanOrEqual(0);
      expect(y - h, name).toBeGreaterThanOrEqual(0);
      expect(x - h + size, name).toBeLessThanOrEqual(p2.width);
      expect(y - h + size, name).toBeLessThanOrEqual(p2.height);
    }
  });

  test('every sample rgb is the area mean of p2.png at its point, within 1 per channel', () => {
    for (const { name, x, y, size, rgb } of targets.samples) {
      const mean = areaMean(p2, x, y, size);
      for (let c = 0; c < 3; c++) expect(Math.abs(mean[c] - rgb[c]), `${name} channel ${c}`).toBeLessThanOrEqual(1);
    }
  });

  test('the face glow is at least 60 red above the head middle: she is warm on cool', () => {
    expect(sample('Face glow').rgb[0] - sample('Head middle').rgb[0]).toBeGreaterThanOrEqual(targets.warmContrast);
  });

  test('the mean inside the mask is the recorded target, and the mask leaves out the title and the nameplate', () => {
    const sum = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < mask.data.length; i++) {
      if (mask.data[i] <= 127) continue;
      n++;
      for (let c = 0; c < 3; c++) sum[c] += p2.data[i * 3 + c];
    }
    expect(n).toBeGreaterThan(30000);
    sum.forEach((v, c) => expect(Math.abs(v / n - targets.meanInside.rgb[c]), `mean channel ${c}`).toBeLessThanOrEqual(1));
    const lit = (x0: number, y0: number, x1: number, y1: number) => {
      let k = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) k += mask.data[y * mask.width + x] > 127 ? 1 : 0;
      return k;
    };
    expect(lit(0, 0, 488, 190), 'title and caption band').toBe(0);
    expect(lit(0, 428, 488, 495), 'nameplate band').toBe(0);
  });

  test('the targets file keeps the spec shape numbers', () => {
    expect(targets).toMatchObject({
      deltaE: 10,
      warmContrast: 60,
      head: { halfWidth: [0.88, 0.96], top: [0.44, 0.52] },
      armSpan: [3.75, 4.05],
      iou: 0.85,
      meanInside: { tolerance: 12, satTolerance: 0.04 },
    });
  });
});

/**
 * The panel pixel of a world point: px = origin x + pxPerUnit wx, py = origin y - pxPerUnit wy (y up in the
 * world, down in the panel). Lists every sample whose targets.json point is not where the two world files put it.
 */
function coordinateMismatches(samples: readonly { name: string; x: number; y: number }[], world: Record<string, readonly number[]>, origin: readonly number[], pxPerUnit: number): string[] {
  const wrong: string[] = [];
  for (const { name, x, y } of samples) {
    const point = world[name.toLowerCase()];
    if (!point) { wrong.push(`${name}: no world point`); continue; }
    const [px, py] = [origin[0] + pxPerUnit * point[0], origin[1] - pxPerUnit * point[1]];
    if (Math.abs(px - x) > 1e-9 || Math.abs(py - y) > 1e-9) wrong.push(`${name}: (${x}, ${y}) vs (${px}, ${py})`);
  }
  if (Object.keys(world).length !== samples.length) wrong.push(`${Object.keys(world).length} world points for ${samples.length} samples`);
  return wrong;
}

describe('Veyra sample coordinates agree across the three review files', () => {
  const hq = stageSamples['2'].hq;

  test('the stage and world files share P2\'s frame: origin (244, 247.5), 100 px a world unit', () => {
    expect([hq.origin, hq.pxPerUnit, hq.frame]).toEqual([[244, 247.5], 100, [4.88, 4.95]]);
  });

  test('every targets.json (x, y) is the stage and the world file\'s world point in panel pixels', () => {
    expect(coordinateMismatches(targets.samples, stageSamples['2'].points, hq.origin, hq.pxPerUnit)).toEqual([]);
    expect(coordinateMismatches(targets.samples, worldSamples.regions, hq.origin, hq.pxPerUnit)).toEqual([]);
  });

  test('negative control: one sample moved by one pixel is caught', () => {
    const moved = targets.samples.map((s) => (s.name === 'Chin' ? { ...s, x: s.x + 1 } : s));
    expect(coordinateMismatches(moved, worldSamples.regions, hq.origin, hq.pxPerUnit)).toEqual(['Chin: (267, 348) vs (266, 348)']);
    const { chin: _chin, ...short } = stageSamples['2'].points;
    expect(coordinateMismatches(targets.samples, short, hq.origin, hq.pxPerUnit)).toContain('Chin: no world point');
  });
});