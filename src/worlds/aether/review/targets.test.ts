import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import targets from './targets.json';
import { areaMean, readPng } from './readPng';

// The colour truth for Aether: spec 2.1's samples, taken from the native panels in public/aether/ref (a copy of
// docs/design/references/Aether/native-panels). The checks here run on the reference itself, so a typo in a
// target, or a panel swapped for another, fails before any render is compared with them.
const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const panels = new Map<number, ReturnType<typeof readPng>>();
const panel = (n: number) => panels.get(n) ?? panels.set(n, readPng(join(ROOT, 'public', 'aether', 'ref', `p${n}.png`))).get(n)!;
const sample = (name: string) => {
  const s = targets.samples.find((t) => t.name === name);
  if (!s) throw new Error(`no sample named ${name}`);
  return s.rgb;
};

describe('Aether reference targets', () => {
  test('31 samples: 23 on P2, 8 on P1, P3 and P4, all 5 x 5', () => {
    expect(targets.samples).toHaveLength(31);
    expect(targets.samples.filter((s) => s.panel === 2)).toHaveLength(23);
    expect(targets.samples.filter((s) => s.panel !== 2).map((s) => s.panel).sort()).toEqual([1, 1, 3, 3, 3, 4, 4, 4]);
    expect(new Set(targets.samples.map((s) => s.name)).size).toBe(31);
    for (const s of targets.samples) expect(s.size, s.name).toBe(5);
    expect(targets.deltaE).toBe(10);
  });

  test('the panels are the native sizes', () => {
    expect([1, 2, 3, 4, 5].map((n) => [panel(n).width, panel(n).height])).toEqual([[510, 504], [514, 504], [509, 504], [674, 519], [861, 519]]);
  });

  test('each target colour is the 5 x 5 mean of its panel within 1 per channel', () => {
    for (const s of targets.samples) {
      const got = areaMean(panel(s.panel), s.x, s.y, s.size);
      s.rgb.forEach((want, c) => expect(Math.abs(got[c] - want), `${s.name} (P${s.panel} ${s.x},${s.y}) channel ${c}: want ${want}, got ${got[c].toFixed(1)}`).toBeLessThanOrEqual(1));
    }
  });

  test('every global colour check passes on the reference itself', () => {
    const { checks } = targets;
    const glow = sample('Face glow below eyes'), dome = sample('Upper dome');
    expect(glow[0] - dome[0], 'warm core on a cool body').toBeGreaterThanOrEqual(checks.warmCore);
    for (const name of ['Face glow below eyes', 'Face glow below mouth']) {
      const [r, g] = sample(name);
      expect(r - g, `${name}: pink, not white`).toBeGreaterThanOrEqual(checks.pinkNotWhite.minRminusG);
      expect(g, `${name}: pink, not white`).toBeLessThanOrEqual(checks.pinkNotWhite.maxG);
    }
    for (const name of ['Arm body upper', 'Arm body lower']) {
      const [r, , b] = sample(name);
      expect(b, name).toBeGreaterThanOrEqual(checks.periwinkle.minB);
      expect(b - r, name).toBeGreaterThanOrEqual(checks.periwinkle.minBminusR);
    }
    const [r, , b] = sample('Mid water');
    expect(b, 'indigo water, not black').toBeGreaterThanOrEqual(checks.indigoWater.minB);
    expect(b - r, 'indigo water, not black').toBeGreaterThanOrEqual(checks.indigoWater.minBminusR);
  });

  test('the P2 mask is a body-sized silhouette of the same size as the panel, and its mean is recorded', () => {
    const p2 = panel(2), mask = readPng(join(ROOT, 'public', 'aether', 'ref', 'p2-mask.png'));
    expect([mask.width, mask.height]).toEqual([p2.width, p2.height]);
    const sum = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < mask.width * mask.height; i++) {
      if (mask.data[i * mask.channels] <= 127) continue;
      n++;
      for (let c = 0; c < 3; c++) sum[c] += p2.data[i * p2.channels + c];
    }
    expect(n).toBeGreaterThan(40000);
    expect(n).toBeLessThan(65000);
    sum.forEach((v, c) => expect(Math.abs(v / n - targets.meanInside.rgb[c]), `mask mean channel ${c}`).toBeLessThanOrEqual(1));
  });

  test('shape targets are well-formed ranges', () => {
    const ranges = [targets.head.centreX, targets.head.halfWidth, targets.head.top, targets.eyesY, targets.armSpan, targets.ring.centreY, targets.ring.halfWidth, targets.dome.halfWidth];
    for (const [lo, hi] of ranges) expect(lo).toBeLessThan(hi);
    expect(targets.iou).toBe(0.85);
  });
});
