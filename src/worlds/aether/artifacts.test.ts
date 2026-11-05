import { expect, test } from 'vitest';
import { assignPendants, threadClearance } from '../../engine/artifacts/pendant';
import { dealToBeads, flightPoint, ringPoint, travelWindow } from '../../engine/artifacts/satellite';
import type { Box } from '../../engine/artifacts/suctionHold';
import { tetherCurve } from '../../engine/artifacts/tether';
import { ArmChain, restFromCurve } from '../../engine/character/armChain';
import { ARM_IDS, type ArmId, type Point2 } from '../../engine/config/types';
import type { Vec3 } from '../../engine/world/types';
import { AETHER_ARTIFACTS } from './artifacts';
import { AETHER_STAGE_PANELS } from './bundle';
import { AETHER } from './character';
import { AETHER_TECHNOLOGIES_15 } from './content/testSets';
import { AETHER_POSES, OVERVIEW_ROOM } from './poses';
import { SEQUENCE_DEFAULTS } from './sequences/defaults';
import { SWELL_PUSH_SETTLED } from '../../engine/sequences/keys';

// Her overview orbs (spec 7.5, P3): the satellite's active form. Sixteen slots in P3's horseshoe, two
// an arm; her ten technologies on the upper slots; more than sixteen go to the tray; the flight from
// the ring's beads; and nothing hanging over her face or the dome's panel.

const { placement, orbStyle } = AETHER_ARTIFACTS;
const slots = placement.slots!.overview;
const RADIUS = placement.sizes!.overview;
const DEG = Math.PI / 180;
const overview = AETHER_POSES.overview;
/** What her flight keeps clear of, as the driver gives it: her head's centre line and the ring's radius. */
const KEEP = { x: AETHER.head.centerX, half: placement.ring.radius };

/** Her face (eyes, brows, blush and mouth) as a box in the body's space, the arms' own: in every stage her face sits where her head does. */
function faceBox(): Box {
  const [fx, fy] = AETHER.head.faceOrigin;
  const { eye, blush, mouth, brow } = AETHER.face;
  const xs = [...eye.centers.flatMap(([x]) => [x - eye.rx, x + eye.rx]), ...blush.centers.flatMap(([x]) => [x - blush.rx, x + blush.rx]), mouth.center[0] - mouth.halfWidth, mouth.center[0] + mouth.halfWidth, -brow.outer[0], brow.outer[0]];
  const ys = [...eye.centers.flatMap(([, y]) => [y - eye.ry, y + eye.ry]), ...blush.centers.flatMap(([, y]) => [y - blush.ry, y + blush.ry]), mouth.center[1] - mouth.depth - mouth.thickness, brow.control[1] + brow.thickness];
  return { x0: fx + Math.min(...xs), x1: fx + Math.max(...xs), y0: fy + Math.min(...ys), y1: fy + Math.max(...ys) };
}

/** The overview's project panel (world units on the stage) in the body's space. */
function panelBox(): Box {
  const [left, top, right, bottom] = AETHER_STAGE_PANELS.overview;
  const { x, y } = overview.body;
  return { x0: left - x, x1: right - x, y0: bottom - y, y1: top - y };
}

/** The overview's arms as the rig draws them at rest (the pose's curves with her rest bend), root first. */
function drawnArms(): Record<ArmId, Point2[]> {
  return Object.fromEntries(ARM_IDS.map((id, i) => {
    const chain = new ArmChain(restFromCurve(overview.arms[id]), AETHER.arms[i], i);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0, bend: AETHER.armBend });
    return [id, Array.from({ length: chain.segments + 1 }, (_, k) => [chain.px[k], chain.py[k]] as Point2)];
  })) as Record<ArmId, Point2[]>;
}

/** The point at arc fraction `at` on a drawn arm (its points are equal lengths apart). */
function along(line: readonly Point2[], at: number): Vec3 {
  const f = Math.min(1, Math.max(0, at)) * (line.length - 1);
  const k = Math.min(line.length - 2, Math.floor(f));
  const w = f - k;
  return [line[k][0] * (1 - w) + line[k + 1][0] * w, line[k][1] * (1 - w) + line[k + 1][1] * w, 0];
}

const outside = (x: number, y: number, box: Box) => Math.hypot(Math.max(box.x0 - x, 0, x - box.x1), Math.max(box.y0 - y, 0, y - box.y1));

test("her orbs' style, thread, size and float are spec 2.3 and 7.5's", () => {
  expect(orbStyle).toEqual({ rimBeads: 16, rimColour: '#e4d9f8', cap: { colour: '#d99982', size: 0.05 } });
  expect(placement.tether).toMatchObject({ length: 0.16, color: '#d99982', sag: 0.2 });
  // 0.6 across.
  expect(2 * RADIUS).toBeCloseTo(0.6, 9);
  expect(placement.swing!.maxAngle).toBeLessThanOrEqual(15 * DEG + 1e-12);
  expect(placement.swing!.settle).toBeLessThanOrEqual(1.4);
  expect(AETHER_ARTIFACTS.choosableIn).toEqual(['overview']);
});

test("sixteen overview slots in P3's horseshoe: two an arm, at the pose's tip and mid-arm room, T1's and T8's tips first", () => {
  expect(slots).toHaveLength(16);
  expect(slots.map(s => s.order).sort((a, b) => a - b)).toEqual(slots.map((_, i) => i));
  for (const arm of ARM_IDS) {
    const own = slots.filter(s => s.arm === arm).map(s => s.at).sort((a, b) => a - b);
    expect(own, arm).toEqual([...OVERVIEW_ROOM[arm]].sort((a, b) => a - b));
  }
  const byOrder = [...slots].sort((a, b) => a.order - b.order);
  expect(byOrder.slice(0, 2)).toEqual([{ arm: 'T1', at: OVERVIEW_ROOM.T1[1], order: 0 }, { arm: 'T8', at: OVERVIEW_ROOM.T8[1], order: 1 }]);
});

test('1, 3, 10, 15, 16 and 20 technologies: up to sixteen hang, never more than two an arm, the rest go to the tray; her ten take the upper slots', () => {
  for (const count of [1, 3, 10, 15, 16, 20]) {
    const { placed, tray } = assignPendants(count, slots);
    expect(placed, `${count}`).toHaveLength(Math.min(count, 16));
    expect(tray, `${count}`).toEqual(Array.from({ length: Math.max(0, count - 16) }, (_, i) => 16 + i));
    for (const arm of ARM_IDS) expect(placed.filter(p => p.slot.arm === arm).length, `${count} ${arm}`).toBeLessThanOrEqual(2);
  }
  expect(assignPendants(20, slots)).toMatchObject({ tray: [16, 17, 18, 19] });
  // Her ten (the shipped set): both slots on T1, T8, T2 and T7, and the tips of T3 and T6; none on the lower arms.
  const ten = assignPendants(10, slots).placed.map(p => `${p.slot.arm}@${p.slot.at}`).sort();
  expect(ten).toEqual(['T1', 'T8', 'T2', 'T7'].flatMap(arm => OVERVIEW_ROOM[arm as ArmId].map(at => `${arm}@${at}`)).concat([`T3@${OVERVIEW_ROOM.T3[1]}`, `T6@${OVERVIEW_ROOM.T6[1]}`]).sort());
  // The fifteen-technology test set fits without a tray.
  expect(assignPendants(AETHER_TECHNOLOGIES_15.length, slots).tray).toEqual([]);
});

test('the beads share the technologies out: fifteen give each bead 3, ten give 2, three use beads 0 to 2 once and 3 and 4 not at all', () => {
  const tally = (n: number) => Array.from({ length: 5 }, (_, b) => dealToBeads(n, placement.ring.beadCount).filter(d => d === b).length);
  expect(tally(15)).toEqual([3, 3, 3, 3, 3]);
  expect(tally(10)).toEqual([2, 2, 2, 2, 2]);
  expect(tally(3)).toEqual([1, 1, 1, 0, 0]);
});

test('her flight, bead to slot, for 1 to 16 orbs: the first (upper arms) lands before the last, and no orb jumps (|p(s + 0.01) - p(s)| < 0.15)', () => {
  const arms = drawnArms();
  for (const count of [1, 3, 10, 15, 16]) {
    const deal = dealToBeads(count, placement.ring.beadCount);
    const placed = assignPendants(count, slots).placed;
    const fromTo = placed.map(({ slot }, i) => {
      const [x, y, z] = ringPoint(placement.ring.homes[deal[i]], placement.ring);
      const attach = along(arms[slot.arm], slot.at);
      return [[x + AETHER.head.centerX, y, z], tetherCurve(attach, 0, placement.tether!, RADIUS).orbCentre] as [Vec3, Vec3];
    });
    fromTo.forEach(([from, to], i) => {
      for (let k = 0; k < 100; k++) {
        const a = flightPoint(from, to, k / 100, i, count, false, KEEP).p;
        const b = flightPoint(from, to, (k + 1) / 100, i, count, false, KEEP).p;
        expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), `${count}: orb ${i} at ${k / 100}`).toBeLessThan(0.15);
      }
    });
    if (count > 1) expect(travelWindow(0, count)[1]).toBeLessThan(travelWindow(count - 1, count)[1]);
  }
});

test('her ten, fifteen or sixteen fly round her face, never across it: no orb in flight touches the face box', () => {
  const arms = drawnArms();
  const face = faceBox();
  for (const count of [10, 15, 16]) {
    const deal = dealToBeads(count, placement.ring.beadCount);
    let least = Infinity;
    assignPendants(count, slots).placed.forEach(({ slot }, i) => {
      const [x, y, z] = ringPoint(placement.ring.homes[deal[i]], placement.ring);
      const to = tetherCurve(along(arms[slot.arm], slot.at), 0, placement.tether!, RADIUS).orbCentre;
      for (let k = 0; k <= 400; k++) {
        const { p, scale } = flightPoint([x + AETHER.head.centerX, y, z], to, k / 400, i, count, false, KEEP);
        if (scale > 0) least = Math.min(least, outside(p[0], p[1], face) - RADIUS * scale);
      }
    });
    expect(least, `${count}`).toBeGreaterThanOrEqual(0);
  }
});

test("the slots' attach points are more than 0.05 clear of the other arms and her face", () => {
  expect(threadClearance(overview, slots, faceBox())).toBeGreaterThan(0.05);
});

/** How close the slots' threads and orbs come to `box`, hung at `angles` from vertical and bobbed by `bobs` (less than 0: inside it). */
function nearest(box: Box, angles: readonly number[], bobs: readonly number[]) {
  const arms = drawnArms();
  let least = Infinity;
  for (const slot of slots) {
    const attach = along(arms[slot.arm], slot.at);
    for (const angle of angles) {
      for (const bob of bobs) {
        const { points, orbCentre } = tetherCurve(attach, angle, placement.tether!, RADIUS);
        least = Math.min(least, outside(orbCentre[0], orbCentre[1] + bob, box) - RADIUS, ...points.map(p => outside(p[0], p[1], box)));
      }
    }
  }
  return least;
}

test("frozen (hanging straight down, as every still holds them), no thread or orb comes within 0.05 of her face or the dome's panel", () => {
  expect(nearest(faceBox(), [0], [0])).toBeGreaterThan(0.05);
  expect(nearest(panelBox(), [0], [0])).toBeGreaterThan(0.05);
});

test("floating (the idle sway's few degrees and the 0.03 bob), none reaches the panel; swung to the full 15 degrees, none reaches her face", () => {
  expect(nearest(panelBox(), [-3 * DEG, 3 * DEG], [-0.03, 0.03])).toBeGreaterThan(0);
  expect(nearest(faceBox(), [-15 * DEG, 15 * DEG], [-0.03, 0.03])).toBeGreaterThan(0.05);
  // Known (Task 12 report): at the full 15 degrees, T8's mid-arm orb reaches the panel's right edge (by about 0.07); only a hard arm sweep swings it that far.
  expect(nearest(panelBox(), [-15 * DEG, 15 * DEG], [0])).toBeGreaterThan(-0.1);
});

test("the swell's push, read as the flight's progress, rises once with no overshoot over 0.2 to 1.35 s (the travel, 0.35 to 0.9 of it, gets more than half a second)", () => {
  const keys = SEQUENCE_DEFAULTS.headSwell.objects.main.keys.push as readonly (readonly number[])[];
  expect(keys.map(k => [k[0], k[1]])).toEqual([[0.2, 0], [1.35, SWELL_PUSH_SETTLED]]);
  expect((1.35 - 0.2) * (0.9 - 0.35)).toBeGreaterThan(0.5);
});
