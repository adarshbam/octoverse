import { expect, test } from 'vitest';
import { ArmChain, restFromCurve } from '../character/armChain';
import { NOX } from '../config/nox.character';
import { CAMERA_Z } from '../config/stage';
import { ARM_IDS } from '../config/types';
import { INTRO_TRACED, NOX_POSES } from './nox.poses';

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

test('seen from the stage camera, every arm at rest lies on its traced curve', () => {
  ARM_IDS.forEach((id, i) => {
    const chain = new ArmChain(restFromCurve(NOX_POSES.intro.arms[id]), NOX.arms[i], i);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
    const seen = Array.from(chain.px, (x, k) => {
      const f = CAMERA_Z / (CAMERA_Z - chain.pz[k]);
      return [x * f, chain.py[k] * f];
    });
    for (const [tx, ty] of INTRO_TRACED[id].slice(1)) {
      expect(distance(seen, tx, ty), `${id} (${tx}, ${ty})`).toBeLessThan(0.02);
    }
  });
});

test('with the character rest bend, every arm still follows its traced curve closely', () => {
  ARM_IDS.forEach((id, i) => {
    const chain = new ArmChain(restFromCurve(NOX_POSES.intro.arms[id]), NOX.arms[i], i);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0, bend: NOX.armBend });
    const seen = Array.from(chain.px, (x, k) => {
      const f = CAMERA_Z / (CAMERA_Z - chain.pz[k]);
      return [x * f, chain.py[k] * f];
    });
    for (const [tx, ty] of INTRO_TRACED[id].slice(1)) {
      expect(distance(seen, tx, ty), `${id} (${tx}, ${ty})`).toBeLessThan(0.06);
    }
  });
});
