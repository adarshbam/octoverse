import { expect, test } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import type { ArmId } from '../config/types';
import { NOX_POSES } from '../../worlds/nox/poses';
import { ArmChain, restFromCurve } from './armChain';
import { ArmWeb, WEB_PAIRS } from './armWeb';

const FACE_BOX = { x0: -0.55, y0: -0.35, x1: 0.6, y1: -0.95 };
const still = { time: 0, sway: 0, curl: 0, droop: 0 };
const radius = (u: number) => 0.035 + 0.13 * Math.pow(1 - u, 0.75);

function chain(id: ArmId, time = 0) {
  const index = NOX.arms.findIndex(arm => arm.id === id);
  const c = new ArmChain(restFromCurve(NOX_POSES.intro.arms[id]), NOX.arms[index], index);
  c.solve({ ...still, time, sway: time ? 0.5 : 0 });
  return c;
}

function vertices(web: ArmWeb) {
  const p = web.geometry.attributes.position.array as Float32Array;
  return Array.from({ length: p.length / 3 }, (_, i) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]);
}

/** Nearest point on the chain's polyline (projected onto its segments, not just its samples). */
function nearest(c: ArmChain, x: number, y: number) {
  let best = [c.px[0], c.py[0]];
  let d = Infinity;
  for (let k = 0; k < c.px.length - 1; k++) {
    const sx = c.px[k + 1] - c.px[k];
    const sy = c.py[k + 1] - c.py[k];
    const t = Math.min(1, Math.max(0, ((x - c.px[k]) * sx + (y - c.py[k]) * sy) / (sx * sx + sy * sy || 1)));
    const qx = c.px[k] + sx * t;
    const qy = c.py[k] + sy * t;
    const e = Math.hypot(qx - x, qy - y);
    if (e < d) { d = e; best = [qx, qy]; }
  }
  return best;
}

test('web vertices stay between the two arms facing sides', () => {
  for (const [ia, ib] of WEB_PAIRS) {
    const a = chain(ia);
    const b = chain(ib);
    const web = new ArmWeb(a, b, radius, radius);
    for (const [x, y] of vertices(web)) {
      const [ax, ay] = nearest(a, x, y);
      const [bx, by] = nearest(b, x, y);
      expect((x - ax) * (bx - ax) + (y - ay) * (by - ay), `${ia}-${ib}`).toBeGreaterThanOrEqual(-1e-3);
      expect((x - bx) * (ax - bx) + (y - by) * (ay - by), `${ia}-${ib}`).toBeGreaterThanOrEqual(-1e-3);
    }
  }
});

test('web follows the arms when they move', () => {
  const a = chain('T4');
  const b = chain('T5');
  const web = new ArmWeb(a, b, radius, radius);
  const centroid = () => vertices(web).reduce((s, [x, y]) => [s[0] + x, s[1] + y], [0, 0]);
  const before = centroid();
  a.solve({ ...still, time: 2, sway: 0.9 });
  b.solve({ ...still, time: 2, sway: 0.9 });
  web.update();
  const after = centroid();
  expect(Math.hypot(after[0] - before[0], after[1] - before[1])).toBeGreaterThan(1e-3);
});

test('no web vertex falls inside the face box', () => {
  for (const [ia, ib] of WEB_PAIRS) {
    const web = new ArmWeb(chain(ia), chain(ib), radius, radius);
    for (const [x, y] of vertices(web)) {
      const inside = x > FACE_BOX.x0 && x < FACE_BOX.x1 && y < FACE_BOX.y0 && y > FACE_BOX.y1;
      expect(inside, `${ia}-${ib} vertex (${x.toFixed(2)}, ${y.toFixed(2)})`).toBe(false);
    }
  }
});

test('webs join neighbouring arms only, never across the back', () => {
  expect(WEB_PAIRS).toEqual([['T1', 'T2'], ['T2', 'T3'], ['T3', 'T4'], ['T4', 'T5'], ['T5', 'T6'], ['T6', 'T7'], ['T7', 'T8']]);
});
