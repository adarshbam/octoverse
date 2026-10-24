import { expect, test } from 'vitest';
import { ArmChain, restFromCurve } from '../character/armChain';
import { NOX } from '../config/nox.character';
import { CAMERA_Z } from '../config/stage';
import { ARM_IDS } from '../config/types';
import { noxTechnologies } from '../content/noxTechnologies';
import { NOX_POSES } from '../poses/nox.poses';
import { NOX_OVERVIEW_SLOTS, ORB_Z, PANEL3_ORBS, assignOrbs, orbRestPosition } from './orbSlots';

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
