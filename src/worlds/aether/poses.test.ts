import { expect, test } from 'vitest';
import { ArmChain, restFromCurve } from '../../engine/character/armChain';
import { armRadius } from '../../engine/character/armTube';
import { CAMERA_Z } from '../../engine/config/stage';
import { ARM_IDS } from '../../engine/config/types';
import { faceAnchor } from '../../engine/types/bundle';
import { AETHER_ARTIFACTS } from './artifacts';
import { AETHER_BUNDLE, AETHER_STAGE_FRAMES, AETHER_STAGE_PANELS } from './bundle';
import { AETHER } from './character';
import { aetherTechnologies } from './content/aetherTechnologies';
import { AETHER_POSES, INTRO_TRACED, OVERVIEW_OPEN_WATER, OVERVIEW_ROOM, OVERVIEW_TRACED, TECH_FOCUS_ORB } from './poses';
import { FACE_Z, headToStage, seen, toScreen } from './stageCriteria';
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

test("the entrance is the swim's trail on the intro body (P1, Task 17); the detail keeps the intro's arms on its own body (P5)", () => {
  // The entrance sheet carries her body, facing and lean; the pose keeps the intro's body and draws the trailing ribbons.
  expect(AETHER_POSES.entering.arms).toEqual(SWIM_POSES.trail.arms);
  expect(AETHER_POSES.entering.body).toEqual(AETHER_POSES.intro.body);
  expect(AETHER_POSES.entering.expression).toBe('happy');
  expect(AETHER_POSES.detail.arms).toBe(AETHER_POSES.intro.arms);
  expect(AETHER_POSES.detail.body).not.toEqual(AETHER_POSES.intro.body);
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

test('the overview has its own eight arms, T1 to T8 (P3), and the tech focus keeps them (but the lifted one) and the body', () => {
  expect(Object.keys(overview.arms)).toEqual([...ARM_IDS]);
  expect(overview.arms).not.toBe(AETHER_POSES.intro.arms);
  expect(overview.expression).toBe('happy');
  for (const id of ARM_IDS.filter(id => id !== 'T1')) expect(AETHER_POSES.techFocus.arms[id], id).toBe(overview.arms[id]);
  expect(AETHER_POSES.techFocus.body).toEqual(overview.body);
});

// The tech focus (Task 13), traced from P4 and mirrored to T1 (poses.ts P4_LIFT).
const { techFocus, detail } = AETHER_POSES;
/** A pose's arm as the rig draws it at rest, on the stage (the body's place and scale; neither stage turns her). */
function drawn(pose: typeof techFocus, id: (typeof ARM_IDS)[number]) {
  const i = ARM_IDS.indexOf(id);
  const chain = new ArmChain(restFromCurve(pose.arms[id]), AETHER.arms[i], i);
  chain.solve({ time: 0, sway: 0, curl: 0, droop: 0, bend: AETHER.armBend });
  return Array.from(chain.px, (x, k) => [pose.body.x + pose.body.scale * x, pose.body.y + pose.body.scale * chain.py[k]]);
}

test('the tech focus (P4) is the overview with one arm lifted: T1, the arm her first technology (OpenAI) hangs from; the face is curious, the head closed', () => {
  const first = [...AETHER_ARTIFACTS.placement.slots!.overview].sort((a, b) => a.order - b.order)[0];
  expect(first.arm).toBe('T1');
  expect(aetherTechnologies[0].id).toBe('openai');
  expect(techFocus.arms.T1).not.toEqual(overview.arms.T1);
  // Root first: the lifted arm keeps the overview's (the intro's) root, so nothing pops under the mantle.
  expect(techFocus.arms.T1[0][0]).toBeCloseTo(overview.arms.T1[0][0], 9);
  expect(techFocus.arms.T1[0][1]).toBeCloseTo(overview.arms.T1[0][1], 9);
  expect(techFocus.headMorph).toBe(0);
  expect(techFocus.expression).toBe('curious');
  expect(techFocus.orbs).toBe(1);
});

test('the lifted arm rises beside the closed head past the eye line, its tip curling over the top of the held orb (P4)', () => {
  const line = drawn(techFocus, 'T1');
  const [, eyeLine] = faceAnchor(AETHER_BUNDLE, 'overview');
  const crest = line.reduce((a, p) => (p[1] > a[1] ? p : a));
  // Its crest well above the eyes (P4: 1.18 above the eyes' midpoint, at P4's size), over the held orb.
  expect(crest[1] - eyeLine).toBeGreaterThan(0.9);
  const r = 1.3 * AETHER_ARTIFACTS.placement.sizes!.overview;
  expect(Math.abs(crest[0] - TECH_FOCUS_ORB[0])).toBeLessThan(r);
  expect(crest[1] - TECH_FOCUS_ORB[1]).toBeGreaterThan(r - 0.05);
  // The tip comes past the orb's middle to its far side, at the orb's top: it holds the orb, it does not point at it.
  const tip = line[line.length - 1];
  expect(tip[0]).toBeLessThan(TECH_FOCUS_ORB[0]);
  expect(Math.abs(Math.hypot(tip[0] - TECH_FOCUS_ORB[0], tip[1] - TECH_FOCUS_ORB[1]) - r)).toBeLessThan(0.2);
  // The held orb above the eyes (P4: 0.76 above them), outside the closed head by more than its grown radius.
  expect(TECH_FOCUS_ORB[1] - eyeLine).toBeGreaterThan(0.5);
  expect(TECH_FOCUS_ORB[1] - eyeLine).toBeLessThan(1);
  const { head } = AETHER;
  const headLeft = overview.body.x + overview.body.scale * (head.centerX - head.halfWidth);
  expect(headLeft - TECH_FOCUS_ORB[0]).toBeGreaterThan(r);
  // Above the head's waist the arm keeps off the head's box, its thickness taken off.
  let least = Infinity;
  line.forEach(([x, y], k) => {
    const lx = (x - overview.body.x) / overview.body.scale, ly = (y - overview.body.y) / overview.body.scale;
    if (ly < head.waist) return;
    least = Math.min(least, Math.hypot(Math.max(head.centerX - head.halfWidth - lx, 0, lx - head.centerX - head.halfWidth), Math.max(head.waist - ly, 0, ly - head.top)) - armRadius(k / (line.length - 1), AETHER.arms[0], AETHER));
  });
  expect(least).toBeGreaterThan(0.1);
  // In the tech focus's frame (the overview's), the orb and the arm.
  const { width, height } = AETHER_STAGE_FRAMES.techFocus;
  for (const [x, y] of [...line, [TECH_FOCUS_ORB[0] - r, TECH_FOCUS_ORB[1] + r]]) {
    expect(Math.abs(x)).toBeLessThan(width / 2);
    expect(Math.abs(y)).toBeLessThan(height / 2);
  }
});

test("the detail (P5): her eyes land where P5 paints them, at the left edge, three-quarters toward the panel, leaning, attentive", () => {
  // P5's eyes at (87.5, 246) and (152.5, 220) px of 861 x 519: their midpoint (-3.105, 0.265) on the detail's stage.
  const { eye } = AETHER.face;
  const [fx, fy] = AETHER.head.faceOrigin;
  const mid: [number, number, number] = [fx + (eye.centers[0][0] + eye.centers[1][0]) / 2, fy + (eye.centers[0][1] + eye.centers[1][1]) / 2, FACE_Z];
  const at = seen(headToStage(detail, mid));
  expect(Math.abs(at.x + 3.105)).toBeLessThan(0.06);
  expect(Math.abs(at.y - 0.265)).toBeLessThan(0.06);
  // The eye line rises about 22 degrees to the right (P5), from the lean.
  const [l, r] = eye.centers.map(([x, y]) => seen(headToStage(detail, [fx + x, fy + y, FACE_Z])));
  expect((Math.atan2(r.y - l.y, r.x - l.x) * 180) / Math.PI).toBeGreaterThan(17);
  expect((Math.atan2(r.y - l.y, r.x - l.x) * 180) / Math.PI).toBeLessThan(27);
  expect(detail.body.yaw).toBeGreaterThan(0.2);
  expect(detail.expression).toBe('attentive');
  expect(detail.orbs).toBe(0);
  // At the left edge: her head inside the frame, her left arms cropped by it, the whole head left of the panel.
  const { head } = AETHER;
  const half = AETHER_STAGE_FRAMES.detail.width / 2;
  const headLeft = seen(headToStage(detail, [head.centerX - head.halfWidth, head.waist, 0])).x;
  const headRight = seen(headToStage(detail, [head.centerX + head.halfWidth, head.waist, 0])).x;
  expect(headLeft).toBeGreaterThan(-half);
  expect(headLeft).toBeLessThan(-half + 0.6);
  expect(Math.min(...ARM_IDS.flatMap(id => drawn(detail, id).map(p => p[0])))).toBeLessThan(-half);
  expect(headRight).toBeLessThan(AETHER_STAGE_PANELS.detail[0]);
  // The face stays on screen at P5, the desktop and the phone.
  for (const size of [{ width: 861, height: 519 }, { width: 1536, height: 1024 }, { width: 390, height: 844 }]) {
    const p = toScreen(at.x, at.y, AETHER_STAGE_FRAMES.detail, size);
    expect(p.x, `${size.width}`).toBeGreaterThan(0.05 * size.width);
    expect(p.y, `${size.width}`).toBeGreaterThan(0.05 * size.height);
    expect(p.y, `${size.width}`).toBeLessThan(0.95 * size.height);
  }
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

test('the swim has her own open and trail arms (Task 17, swim.test.ts), stretched a little as she swims', () => {
  expect(SWIM_POSES.open.arms).not.toBe(AETHER_POSES.intro.arms);
  expect(SWIM_POSES.trail.arms).not.toBe(AETHER_POSES.intro.arms);
  expect(SWIM_POSES.stretch).toBe(1.12);
});
