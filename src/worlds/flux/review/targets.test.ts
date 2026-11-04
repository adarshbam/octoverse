import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

// Flux's reference checks (spec 2.1, 2.2). p2.png is the colour truth; there is no PNG decoder in
// node_modules, so the area means come from Pillow in a one-shot `python -E` call.
// (`-I` would hide the user site-packages where Pillow lives; cwd is the temp dir so nothing local is imported.)
const here = (...p: string[]) => resolve(__dirname, ...p);
const P2 = here('../../../../public/flux/ref/p2.png');
const readJson = (name: string) => JSON.parse(readFileSync(here(name), 'utf8'));

type Sample = { name: string; x: number; y: number; size: number; rgb: [number, number, number] };
const targets = readJson('targets.json') as {
  samples: Sample[];
  deltaE: number;
  gradient: { from: string; to: string; minRed: number };
  warm: { minRedOverCrown: number; minRedOverGreen: number };
  head: { halfWidth: [number, number]; top: [number, number] };
  armSpan: [number, number];
  iou: number;
  meanInside: { rgb: [number, number, number]; tolerance: number; satTolerance: number };
};

const PILLOW_MEANS = `
import json, sys
from PIL import Image
import numpy as np
a = np.asarray(Image.open(sys.argv[1]).convert('RGB'), dtype=float)
out = []
for x, y, s in json.loads(sys.argv[2]):
    r = s // 2
    out.append(a[y - r:y + r + 1, x - r:x + r + 1].reshape(-1, 3).mean(0).tolist())
print(json.dumps(out))
`;

const areaMeans = (): number[][] =>
  JSON.parse(
    execFileSync('python', ['-E', '-c', PILLOW_MEANS, P2, JSON.stringify(targets.samples.map((s) => [s.x, s.y, s.size]))], {
      encoding: 'utf8',
      cwd: tmpdir(),
    }),
  );

const sample = (name: string) => {
  const s = targets.samples.find((t) => t.name === name);
  if (!s) throw new Error(`no sample ${name}`);
  return s;
};

test('targets.json has the 14 spec samples, each a 5 x 5 patch inside the panel', () => {
  expect(targets.samples).toHaveLength(14);
  expect(new Set(targets.samples.map((s) => s.name)).size).toBe(14);
  for (const s of targets.samples) {
    expect(s.size, s.name).toBe(5);
    expect(s.x >= 2 && s.x <= 508 && s.y >= 2 && s.y <= 507, s.name).toBe(true);
  }
});

test("every sample's rgb is the 5 x 5 area mean of p2.png within 1 per channel", () => {
  const means = areaMeans();
  targets.samples.forEach((s, i) => {
    for (let c = 0; c < 3; c++) expect(Math.abs(means[i][c] - s.rgb[c]), `${s.name} channel ${c}`).toBeLessThanOrEqual(1);
  });
});

test('the head runs blue to violet: head-middle red is at least 70 above the crown', () => {
  const { from, to, minRed } = targets.gradient;
  expect(sample(to).rgb[0] - sample(from).rgb[0]).toBeGreaterThanOrEqual(minRed);
});

test('the face glow is warm: red at least 150 over the crown, and 40 over its own green', () => {
  const glow = sample('faceGlow').rgb;
  expect(glow[0] - sample('crown').rgb[0]).toBeGreaterThanOrEqual(targets.warm.minRedOverCrown);
  expect(glow[0] - glow[1]).toBeGreaterThanOrEqual(targets.warm.minRedOverGreen);
});

test('shape targets and global checks carry the spec numbers', () => {
  expect(targets.deltaE).toBe(10);
  expect(targets.head).toEqual({ halfWidth: [0.7, 0.78], top: [0.22, 0.3] });
  expect(targets.iou).toBe(0.85);
  expect(targets.armSpan[0]).toBeLessThan(targets.armSpan[1]);
  expect(targets.meanInside).toMatchObject({ tolerance: 12, satTolerance: 0.04 });
});

// Panel 3, the overview (Task 11): the dome, the head top and the face, read the same way from p3.png.
const P3 = here('../../../../public/flux/ref/p3.png');
type P3Targets = {
  samples: Sample[];
  origin: [number, number];
  pxPerUnit: number;
  size: [number, number];
  dome: { center: [number, number]; halfWidth: number; halfHeight: number; power: number; rim: [number, number][] };
  panelContent: [number, number, number, number];
  eyes: { x: [number, number]; y: number };
};
const p3 = readJson('p3_targets.json') as P3Targets;

test("every P3 sample's rgb is the 5 x 5 area mean of p3.png within 1 per channel", () => {
  const means = JSON.parse(
    execFileSync('python', ['-E', '-c', PILLOW_MEANS, P3, JSON.stringify(p3.samples.map((s) => [s.x, s.y, s.size]))], { encoding: 'utf8', cwd: tmpdir() }),
  ) as number[][];
  p3.samples.forEach((s, i) => {
    for (let c = 0; c < 3; c++) expect(Math.abs(means[i][c] - s.rgb[c]), `${s.name} channel ${c}`).toBeLessThanOrEqual(1);
  });
}, 20000);

test("P3's dome: an electric-blue rim, a navy inside that deepens toward the bottom", () => {
  const rgb = (name: string) => p3.samples.find((s) => s.name === name)!.rgb;
  for (const rim of ['domeRimTop', 'domeRimLeft', 'domeRimBottom']) expect(rgb(rim)[2], rim).toBeGreaterThanOrEqual(230);
  const [top, side, bottom] = ['domeInsideTop', 'domeInsideSide', 'domeInsideBottom'].map(rgb);
  expect(top[2]).toBeGreaterThan(side[2]);
  expect(side[2]).toBeGreaterThan(bottom[2]);
});

test("P3's dome fit passes within 0.02 of every rim point it was fitted to, and holds the panel's content", () => {
  const { center, halfWidth, halfHeight, power, rim } = p3.dome;
  const level = (x: number, y: number) => (Math.abs((x - center[0]) / halfWidth) ** power + Math.abs((y - center[1]) / halfHeight) ** power) ** (1 / power);
  for (const [x, y] of rim) {
    const r = Math.hypot(x - center[0], y - center[1]);
    expect(Math.abs(r - r / level(x, y)), `(${x}, ${y})`).toBeLessThanOrEqual(0.02);
  }
  const [l, t, r, b] = p3.panelContent;
  for (const [x, y] of [[l, t], [r, t], [r, b], [l, b]]) expect(level(x, y), `(${x}, ${y})`).toBeLessThan(1);
  // The face sits at the dome's bottom: the eyes within 0.1 of it.
  expect(Math.abs(p3.eyes.y - (center[1] - halfHeight))).toBeLessThanOrEqual(0.1);
});

test('the P3 stage samples name the P3 targets, at the same points', () => {
  const stage = readJson('stage_samples.json')['3'];
  expect(stage.hq.image).toBe('public/flux/ref/p3.png');
  expect(Object.keys(stage.points).sort()).toEqual(p3.samples.map((s) => s.name).sort());
  for (const s of p3.samples) {
    const [wx, wy] = stage.points[s.name];
    expect(Math.abs(p3.origin[0] + p3.pxPerUnit * wx - s.x), s.name).toBeLessThanOrEqual(0.5);
    expect(Math.abs(p3.origin[1] - p3.pxPerUnit * wy - s.y), s.name).toBeLessThanOrEqual(0.5);
  }
});

test('the stage and world sample files name the same 14 regions', () => {
  const stage = readJson('stage_samples.json')['2'];
  const world = readJson('world_samples.json');
  const names = targets.samples.map((s) => s.name).sort();
  expect(Object.keys(stage.points).sort()).toEqual(names);
  expect(Object.keys(world.regions).sort()).toEqual(names);
  expect(world.target.mean).toEqual(targets.meanInside.rgb);
});
