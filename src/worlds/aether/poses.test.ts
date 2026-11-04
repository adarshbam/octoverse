import { expect, test } from 'vitest';
import { ArmChain, restFromCurve } from '../../engine/character/armChain';
import { CAMERA_Z } from '../../engine/config/stage';
import { ARM_IDS } from '../../engine/config/types';
import { AETHER } from './character';
import { AETHER_POSES, INTRO_TRACED } from './poses';
import { SWIM_POSES } from './swim';

/** Distance from a point to a polyline, projecting onto its segments. */
function distance(points: number[][], x: number, y: number) {
  let best = Infinity;
  for (let k = 0; k < points.length - 1; k++) {
    const [ax, ay] = points[k];
    const sx = points[k + 1][0] - ax;
    const sy = points[k + 1][1] - ay;
    const t = Math.min(1, Math.max(0, ((x - ax) * sx + (y - ay) * sy) / (sx * sx + sy * sy || 1)));
    best = Math.min(best, Math.hypot(ax + sx * t - x, ay + sy * t - y));
  }
  return best;
}

test('seen from the stage camera, every arm at rest lies on its traced curve (panel 2)', () => {
  ARM_IDS.forEach((id, i) => {
    const chain = new ArmChain(restFromCurve(AETHER_POSES.intro.arms[id]), AETHER.arms[i], i);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
    const seen = Array.from(chain.px, (x, k) => {
      const f = CAMERA_Z / (CAMERA_Z - chain.pz[k]);
      return [x * f, chain.py[k] * f];
    });
    for (const [tx, ty] of INTRO_TRACED[id].slice(1)) {
      expect(distance(seen, tx, ty), `${id} (${tx}, ${ty})`).toBeLessThan(0.04);
    }
  });
});

test("the arm span at rest is panel 2's 3.84 within 0.15 (spec 2.2)", () => {
  const xs = ARM_IDS.flatMap(id => INTRO_TRACED[id].map(([x]) => x));
  expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(3.84 - 0.15);
  expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(3.84 + 0.15);
});

test('the left arms curl counter-clockwise and the right arms clockwise, as painted', () => {
  const turn = (id: (typeof ARM_IDS)[number]) => {
    const rest = restFromCurve(AETHER_POSES.intro.arms[id]);
    return rest.angles.slice(Math.floor(rest.angles.length * 0.6)).reduce((sum, a, k, all) => sum + (k ? Math.atan2(Math.sin(a - all[k - 1]), Math.cos(a - all[k - 1])) : 0), 0);
  };
  for (const id of ['T1', 'T2'] as const) expect(turn(id), id).toBeGreaterThan(1);
  for (const id of ['T7', 'T8'] as const) expect(turn(id), id).toBeLessThan(-1);
});

test('until milestone 3 every other stage reuses the intro arms and body; only what the stage means differs', () => {
  for (const stage of ['entering', 'overview', 'techFocus', 'detail'] as const) {
    expect(AETHER_POSES[stage].arms, stage).toBe(AETHER_POSES.intro.arms);
    expect(AETHER_POSES[stage].body, stage).toEqual(AETHER_POSES.intro.body);
  }
  expect(AETHER_POSES.overview.headMorph).toBe(1);
  expect(AETHER_POSES.overview.orbs).toBe(1);
  expect(AETHER_POSES.techFocus.headMorph).toBe(0);
  expect(AETHER_POSES.intro.headMorph).toBe(0);
});

test('the swim is the intro arms until Task 17', () => {
  expect(SWIM_POSES.open.arms).toBe(AETHER_POSES.intro.arms);
  expect(SWIM_POSES.trail.arms).toBe(AETHER_POSES.intro.arms);
  expect(SWIM_POSES.stretch).toBe(1);
});
