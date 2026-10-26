import { expect, test } from 'vitest';
import { ArmChain, restFromCurve } from '../character/armChain';
import { NOX } from '../config/nox.character';
import { CAMERA_Z } from '../config/stage';
import { ARM_IDS } from '../config/types';
import { noxTechnologies } from '../content/noxTechnologies';
import { NOX_POSES } from '../poses/nox.poses';
import { faceCentre } from '../character/headGeometry';
import { FOCUS_GROW, NOX_OVERVIEW_SLOTS, ORB_Z, OVERVIEW_HALF_WIDTH, PANEL3_ORBS, assignOrbs, heldPosition, orbRestPosition, tipTarget } from './orbSlots';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `tech-${i}`);

test('15 technologies fill 15 slots with no overflow', () => {
  expect(NOX_OVERVIEW_SLOTS).toHaveLength(15);
  const { placed, overflow } = assignOrbs(noxTechnologies.map(t => t.id), NOX_OVERVIEW_SLOTS);
  expect(placed.map(p => p.techId)).toEqual(noxTechnologies.map(t => t.id));
  expect(overflow).toEqual([]);
});

test('18 technologies overflow the last 3 in order', () => {
  const { placed, overflow } = assignOrbs(ids(18), NOX_OVERVIEW_SLOTS);
  expect(placed).toHaveLength(15);
  expect(placed.map(p => p.slot)).toEqual(NOX_OVERVIEW_SLOTS);
  expect(overflow).toEqual(['tech-15', 'tech-16', 'tech-17']);
});

test('no arm carries more than three orbs', () => {
  for (const id of ARM_IDS) expect(NOX_OVERVIEW_SLOTS.filter(s => s.armId === id).length, id).toBeLessThanOrEqual(3);
});

test('at rest, the first 13 orbs sit where panel 3 paints them', () => {
  const { body } = NOX_POSES.overview;
  NOX_OVERVIEW_SLOTS.slice(0, 13).forEach((slot, i) => {
    const index = ARM_IDS.indexOf(slot.armId);
    const chain = new ArmChain(restFromCurve(NOX_POSES.overview.arms[slot.armId]), NOX.arms[index], index);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
    const p = orbRestPosition(chain, slot);
    // Seen from the stage camera at the orbs' depth, then placed by the overview's body.
    const f = CAMERA_Z / (CAMERA_Z - ORB_Z);
    const [hx, hy] = PANEL3_ORBS[i];
    expect(Math.hypot(p.x * f + body.x - hx, p.y * f + body.y - hy), `orb ${i}`).toBeLessThan(0.01);
  });
});

test('orbs never overlap each other at rest', () => {
  const centres = NOX_OVERVIEW_SLOTS.map(slot => {
    const index = ARM_IDS.indexOf(slot.armId);
    const chain = new ArmChain(restFromCurve(NOX_POSES.overview.arms[slot.armId]), NOX.arms[index], index);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
    return { ...orbRestPosition(chain, slot), r: slot.radius };
  });
  for (let a = 0; a < centres.length; a++) {
    for (let b = a + 1; b < centres.length; b++) {
      expect(Math.hypot(centres[a].x - centres[b].x, centres[a].y - centres[b].y), `${a} and ${b}`).toBeGreaterThan(centres[a].r + centres[b].r);
    }
  }
});

test('presented orbs move out from the face or hold, rise beside and above it, and stay in view', () => {
  const face = faceCentre(NOX.head);
  const { body } = NOX_POSES.overview;
  for (const slot of NOX_OVERVIEW_SLOTS) {
    const index = ARM_IDS.indexOf(slot.armId);
    const chain = new ArmChain(restFromCurve(NOX_POSES.overview.arms[slot.armId]), NOX.arms[index], index);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
    const rest = orbRestPosition(chain, slot);
    const [x, y] = slot.present;
    const r = slot.radius * FOCUS_GROW;
    const name = `${slot.armId} ${slot.u}`;
    expect(Math.abs(x + body.x), name).toBeLessThanOrEqual(Math.max(OVERVIEW_HALF_WIDTH - r, Math.abs(rest.x + body.x)) + 1e-6);
    expect(Math.hypot(x - face.x, y - face.y) - Math.hypot(rest.x - face.x, rest.y - face.y), name).toBeGreaterThan(-0.02);
    if (rest.y > face.y) expect(y, name).toBeGreaterThan(rest.y - 0.01);
    // Clear of the face, and over no other orb's place by more than a quarter.
    expect(Math.hypot((x - face.x) / 0.75, (y - face.y) / 0.55), name).toBeGreaterThan(1);
    NOX_OVERVIEW_SLOTS.forEach((other, k) => {
      if (other === slot) return;
      const o = (() => {
        const i = ARM_IDS.indexOf(other.armId);
        const c = new ArmChain(restFromCurve(NOX_POSES.overview.arms[other.armId]), NOX.arms[i], i);
        c.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
        return orbRestPosition(c, other);
      })();
      expect(Math.hypot(o.x - x, o.y - y), `${name} over orb ${k}`).toBeGreaterThan((r + other.radius) * 0.7);
    });
  }
});

test('each arm can bring its tip to hold each of its orbs where that orb is presented', () => {
  for (const slot of NOX_OVERVIEW_SLOTS) {
    const index = ARM_IDS.indexOf(slot.armId);
    const chain = new ArmChain(restFromCurve(NOX_POSES.overview.arms[slot.armId]), NOX.arms[index], index);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0 });
    const target = tipTarget(slot);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0, reach: { ...target, weight: 1 } });
    expect(Math.hypot(chain.tipX - target.x, chain.tipY - target.y), `${slot.armId} ${slot.u}`).toBeLessThan(0.04);
  }
});

test('a presented orb moves from its place on the arm onto the arm tip that takes it, without jumping', () => {
  const riding = { x: 1, y: 0 };
  const tip = { x: 2, y: 1 };
  expect(heldPosition(riding, tip, 0)).toEqual(riding);
  expect(heldPosition(riding, tip, 1)).toEqual(tip);
  let last = heldPosition(riding, tip, 0);
  for (let f = 0.01; f <= 1.0001; f += 0.01) {
    const p = heldPosition(riding, tip, f);
    expect(Math.hypot(p.x - last.x, p.y - last.y)).toBeLessThan(0.06);
    last = p;
  }
});
