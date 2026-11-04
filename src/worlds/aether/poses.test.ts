import { expect, test } from 'vitest';
import { ArmChain, restFromCurve } from '../../engine/character/armChain';
import { armRadius } from '../../engine/character/armTube';
import { CAMERA_Z } from '../../engine/config/stage';
import { ARM_IDS } from '../../engine/config/types';
import { faceAnchor } from '../../engine/types/bundle';
import { AETHER_BUNDLE } from './bundle';
import { AETHER } from './character';
import { AETHER_POSES, INTRO_TRACED, OVERVIEW_OPEN_WATER, OVERVIEW_ROOM, OVERVIEW_TRACED } from './poses';
import targets from './review/targets.json';
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

test('the entrance and the detail still reuse the intro arms and body (P1 and P5 are traced later); only what the stage means differs', () => {
  for (const stage of ['entering', 'detail'] as const) {
    expect(AETHER_POSES[stage].arms, stage).toBe(AETHER_POSES.intro.arms);
    expect(AETHER_POSES[stage].body, stage).toEqual(AETHER_POSES.intro.body);
  }
  expect(AETHER_POSES.overview.headMorph).toBe(1);
  expect(AETHER_POSES.overview.orbs).toBe(1);
  expect(AETHER_POSES.techFocus.headMorph).toBe(0);
  expect(AETHER_POSES.intro.headMorph).toBe(0);
});

// The overview (Task 11), traced from P3: world (x, y) -> P3 px (254.5 + 100 x, 252 - 100 y).
const { overview } = AETHER_POSES;
const toWorld = ([x, y]: readonly number[]) => [overview.body.x + x * overview.body.scale, overview.body.y + y * overview.body.scale];
/** The dome in world units: its centre, half extents and corner power (the dome is authored in the space the head is). */
const dome = () => {
  const { center, halfWidth, halfHeight, power } = AETHER.dome;
  const [cx, cy] = toWorld(center);
  return { cx, cy, halfWidth: halfWidth * overview.body.scale, halfHeight: halfHeight * overview.body.scale, power, bottom: cy - halfHeight * overview.body.scale, top: cy + halfHeight * overview.body.scale };
};

test('the overview has its own eight arms, T1 to T8 (P3), and the tech focus keeps them and the body', () => {
  expect(Object.keys(overview.arms)).toEqual([...ARM_IDS]);
  expect(overview.arms).not.toBe(AETHER_POSES.intro.arms);
  expect(overview.expression).toBe('happy');
  expect(AETHER_POSES.techFocus.arms).toBe(overview.arms);
  expect(AETHER_POSES.techFocus.body).toEqual(overview.body);
});

test("the dome is P3's: half-width 1.38 +- 0.06 and its top at P3 y 105 +- 6 (spec 2.2)", () => {
  const { cx, halfWidth, top } = dome();
  expect(halfWidth).toBeGreaterThanOrEqual(targets.dome.halfWidth[0]);
  expect(halfWidth).toBeLessThanOrEqual(targets.dome.halfWidth[1]);
  expect(top).toBeGreaterThanOrEqual(targets.dome.top[0]);
  expect(top).toBeLessThanOrEqual(targets.dome.top[1]);
  // P3's dome spans x 118 to 395 px: centred at x +0.02.
  expect(Math.abs(cx - 0.02)).toBeLessThan(0.03);
});

test("the face sits at the dome's bottom: the face anchor is just under the glass's seat (within 0.28), under the dome's middle, and the glass clears the eyes (P3)", () => {
  // P3 paints the eyes under the glass: the dome's lower edge is at y 265 px, the eye line at y 289.
  // So the anchor (the eye line) sits just below the seat, never inside the glass, which would tint the eyes.
  // Here it is 0.23 under the seat.
  const { cx, halfWidth, bottom } = dome();
  const [ax, ay] = faceAnchor(AETHER_BUNDLE, 'overview');
  expect(Math.abs(ax - cx)).toBeLessThan(halfWidth / 5);
  expect(ay).toBeLessThan(bottom);
  expect(bottom - ay).toBeLessThan(0.28);
  // The eyes' tops (the eye line plus the eye's half-height) stay below the seat.
  expect(ay + AETHER.face.eye.ry).toBeLessThan(bottom);
  // The sunk mantle closes inside the glass, so there is no gap between face and dome.
  expect(AETHER.dome.mantleTop).toBeGreaterThan(AETHER.dome.center[1] - AETHER.dome.halfHeight);
});

test('the overview roots are the intro roots, so the arms do not pop at the change (T4 and T5 under the open mouth, y -1.14)', () => {
  for (const id of ARM_IDS) {
    const [ix, iy] = AETHER_POSES.intro.arms[id][0];
    const [ox, oy] = overview.arms[id][0];
    expect(ox, id).toBeCloseTo(ix, 9);
    expect(oy, id).toBeCloseTo(iy, 9);
  }
  expect(INTRO_TRACED.T4[0]).toEqual([-0.02, -1.14]);
});

test('seen from the stage camera, every overview arm lies on its traced curve (P3)', () => {
  ARM_IDS.forEach((id, i) => {
    const chain = new ArmChain(restFromCurve(overview.arms[id]), AETHER.arms[i], i);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
    const seen = Array.from(chain.px, (x, k) => {
      const f = CAMERA_Z / (CAMERA_Z - chain.pz[k]);
      return toWorld([x * f, chain.py[k] * f]);
    });
    for (const [tx, ty] of OVERVIEW_TRACED[id]) expect(distance(seen, tx, ty), `${id} (${tx}, ${ty})`).toBeLessThan(0.04);
  });
});

const ORB = 0.3, THREAD = 0.16;
/** An overview arm's centre line as the stage camera sees it, in world units. */
function seenArm(id: (typeof ARM_IDS)[number]) {
  const i = ARM_IDS.indexOf(id);
  const chain = new ArmChain(restFromCurve(overview.arms[id]), AETHER.arms[i], i);
  chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
  return Array.from(chain.px, (x, k) => {
    const f = CAMERA_Z / (CAMERA_Z - chain.pz[k]);
    return toWorld([x * f, chain.py[k] * f]);
  });
}
/** Where an orb 0.6 across hangs, 0.16 under arm `id` at arc fraction `at`. */
const hungOrb = (id: (typeof ARM_IDS)[number], at: number) => {
  const line = seenArm(id);
  const [x, y] = line[Math.round(at * (line.length - 1))];
  return { name: `${id}@${at}`, x, y: y - THREAD - ORB };
};

test('16 orbs (0.6 across, hung 0.16 under a mid-arm and a tip point of each arm) do not collide with each other, the dome, the face or the frame', () => {
  const { cx, cy, halfWidth, halfHeight, power, bottom } = dome();
  const orbs = ARM_IDS.flatMap(id => OVERVIEW_ROOM[id].map(at => hungOrb(id, at)));
  expect(orbs).toHaveLength(16);
  // Each arm: a mid-arm point and a tip point, the tip's in its last third.
  for (const id of ARM_IDS) {
    expect(OVERVIEW_ROOM[id][0], id).toBeLessThanOrEqual(0.65);
    expect(OVERVIEW_ROOM[id][1], id).toBeGreaterThanOrEqual(0.7);
  }
  for (let a = 0; a < orbs.length; a++) {
    for (let b = a + 1; b < orbs.length; b++) {
      expect(Math.hypot(orbs[a].x - orbs[b].x, orbs[a].y - orbs[b].y), `${orbs[a].name} and ${orbs[b].name}`).toBeGreaterThan(2 * ORB + 0.06);
    }
  }
  const headX = AETHER.head.centerX + overview.body.x, headHalf = AETHER.head.halfWidth + 0.06;
  for (const orb of orbs) {
    for (let s = 0; s < 24; s++) {
      const px = orb.x + ORB * Math.cos((s / 24) * 2 * Math.PI), py = orb.y + ORB * Math.sin((s / 24) * 2 * Math.PI);
      expect(Math.abs((px - cx) / halfWidth) ** power + Math.abs((py - cy) / halfHeight) ** power, `${orb.name} in the dome`).toBeGreaterThan(1);
      // The face and the chin: the head's width, from the dome's seat down to the mantle's bottom.
      expect(Math.abs(px - headX) < headHalf && py < bottom && py > overview.body.y + AETHER.head.bottom, `${orb.name} on the face`).toBe(false);
    }
    // In the overview frame (5.09 x 5.04).
    expect(Math.abs(orb.x) + ORB, orb.name).toBeLessThan(2.545);
    expect(orb.y - ORB, orb.name).toBeGreaterThan(-2.52);
  }
});

test('the open-water points hang their orbs clear of every arm: orb centre to each arm line more than the orb radius plus the arm radius there', () => {
  // The orb's own arm is skipped within 0.3 (along the arm) of where its thread hangs from.
  const lines = Object.fromEntries(ARM_IDS.map(id => [id, seenArm(id)]));
  const length = (line: number[][]) => line.slice(1).reduce((sum, p, k) => sum + Math.hypot(p[0] - line[k][0], p[1] - line[k][1]), 0);
  const open = Object.entries(OVERVIEW_OPEN_WATER) as [(typeof ARM_IDS)[number], number][];
  expect(open.length).toBeGreaterThanOrEqual(4);
  for (const [id, at] of open) {
    expect(OVERVIEW_ROOM[id], id).toContain(at);
    const orb = hungOrb(id, at);
    ARM_IDS.forEach((other, i) => {
      const line = lines[other], total = length(line);
      line.forEach(([x, y], k) => {
        const u = k / (line.length - 1);
        if (other === id && Math.abs(u - at) * total < 0.3) return;
        expect(Math.hypot(x - orb.x, y - orb.y) - ORB - armRadius(u, AETHER.arms[i], AETHER), `${orb.name} against ${other} at ${u.toFixed(2)}`).toBeGreaterThan(0);
      });
    });
  }
});

test('the swim is the intro arms until Task 17', () => {
  expect(SWIM_POSES.open.arms).toBe(AETHER_POSES.intro.arms);
  expect(SWIM_POSES.trail.arms).toBe(AETHER_POSES.intro.arms);
  expect(SWIM_POSES.stretch).toBe(1);
});
