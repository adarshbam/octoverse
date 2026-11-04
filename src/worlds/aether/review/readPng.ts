import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/** A decoded 8-bit PNG: `data` holds `channels` bytes per pixel, row by row. */
export interface Png { width: number; height: number; channels: number; data: Uint8Array }

/** Reads an 8-bit, non-interlaced grey, RGB, grey+alpha or RGBA PNG (what the reference panels and the mask are). */
export function readPng(path: string): Png {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${path} is not a PNG`);
  let width = 0, height = 0, channels = 0;
  const idat: Buffer[] = [];
  for (let at = 8; at < buf.length;) {
    const len = buf.readUInt32BE(at), type = buf.toString('latin1', at + 4, at + 8), body = buf.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      const depth = body[8], colour = body[9], interlace = body[12];
      channels = ({ 0: 1, 2: 3, 4: 2, 6: 4 } as Record<number, number>)[colour] ?? 0;
      if (depth !== 8 || !channels || interlace !== 0) throw new Error(`${path}: only 8-bit non-interlaced grey/RGB/RGBA PNGs are read (depth ${depth}, colour ${colour}, interlace ${interlace})`);
    } else if (type === 'IDAT') idat.push(body);
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = width * channels, data = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? data[row + i - channels] : 0, b = y ? data[row - stride + i] : 0, c = y && i >= channels ? data[row - stride + i - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = a;
      else if (filter === 2) predictor = b;
      else if (filter === 3) predictor = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      data[row + i] = (line[i] + predictor) & 255;
    }
  }
  return { width, height, channels, data };
}

/** Mean RGB of the size x size area centred on (x, y), in native pixels. */
export function areaMean(png: Png, x: number, y: number, size: number): [number, number, number] {
  const r = (size - 1) / 2, sum = [0, 0, 0];
  for (let j = y - r; j <= y + r; j++) for (let i = x - r; i <= x + r; i++) for (let c = 0; c < 3; c++) sum[c] += png.data[(j * png.width + i) * png.channels + (png.channels < 3 ? 0 : c)];
  return sum.map((v) => v / size ** 2) as [number, number, number];
}
