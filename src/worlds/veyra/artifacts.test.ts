import { expect, test } from 'vitest';
import { armPoint, assignPendants, threadClearance } from '../../engine/artifacts/pendant';
import type { Box } from '../../engine/artifacts/suctionHold';
import { tetherCurve } from '../../engine/artifacts/tether';
import { ArmChain, restFromCurve } from '../../engine/character/armChain';
import { armRadius } from '../../engine/character/armTube';
import { ARM_IDS, type ArmId, type ChoosingStage, type Point2 } from '../../engine/config/types';
import { VEYRA_ARTIFACTS } from './artifacts';
import { VEYRA } from './character';
import { VEYRA_POSES } from './poses';

const { placement } = VEYRA_ARTIFACTS;
const DEG = Math.PI / 180;

/** The face's box in a stage's own arm space: the head's, or the dome the head opens into in the overview. */
function faceBox(stage: ChoosingStage): Box {
  if (stage === 'overview') {
    const { center, halfWidth, halfHeight } = VEYRA.dome;
    return { x0: center[0] - halfWidth, y0: center[1] - halfHeight, x1: center[0] + halfWidth, y1: center[1] + halfHeight };
  }
  const { head } = VEYRA;
  return { x0: head.centerX - head.halfWidth, y0: head.bottom, x1: head.centerX + head.halfWidth, y1: head.top };
}

/**
 * The arms' centre lines as the rig draws them in a still: the pose's rest curves with the
 * character's rest bend (what `Octopus` solves each arm to with no motion), root first.
 */
function drawnArms(stage: ChoosingStage): Record<ArmId, Point2[]> {
  return Object.fromEntries(ARM_IDS.map((id, i) => {
    const chain = new ArmChain(restFromCurve(VEYRA_POSES[stage].arms[id]), VEYRA.arms.find(a => a.id === id)!, i);
    chain.solve({ time: 0, sway: 0, curl: 0, droop: 0, bend: VEYRA.armBend });
    return [id, Array.from({ length: chain.segments + 1 }, (_, k) => [chain.px[k], chain.py[k]] as Point2)];
  })) as Record<ArmId, Point2[]>;
}

/** What a stage's clearance is measured with: her thread, the stage's orb, her arms' own thickness and the angles a pendant hangs at. */
const geometry = (stage: ChoosingStage, angles: readonly number[] = [0]) => ({
  armLines: drawnArms(stage),
  style: placement.tether,
  radius: placement.sizes[stage],
  armRadius: (arm: ArmId, u: number) => armRadius(u, VEYRA.arms.find(a => a.id === arm)!, VEYRA),
  angles,
});

test('her pendants hang from at most two slots an arm, on slots ordered 0 up, in both choosing stages', () => {
  for (const stage of ['intro', 'overview'] as const) {
    const slots = placement.slots[stage];
    expect(slots.length, stage).toBeGreaterThanOrEqual(12);
    expect(slots.map(s => s.order).sort((a, b) => a - b), stage).toEqual(slots.map((_, i) => i));
    for (const arm of ARM_IDS) expect(slots.filter(s => s.arm === arm).length, `${stage} ${arm}`).toBeLessThanOrEqual(2);
    // The first technologies sit on the top arms: the first pass is one an arm, top arms first.
    expect(slots[0].arm, stage).toBe('T1');
    // Twelve technologies (P3's twelve) all find a slot, in order.
    expect(assignPendants(12, slots).tray, stage).toEqual([]);
  }
});

test('every thread and orb of her intro and overview slots is more than 0.05 clear of the other arms and the face', () => {
  for (const stage of ['intro', 'overview'] as const) {
    expect(threadClearance(VEYRA_POSES[stage], placement.slots[stage], faceBox(stage), geometry(stage)), stage).toBeGreaterThan(0.05);
  }
});

test("the same holds on the pose's own rest curves, before the rig's rest bend", () => {
  for (const stage of ['intro', 'overview'] as const) {
    const { armLines: _drawn, ...onRest } = geometry(stage);
    expect(threadClearance(VEYRA_POSES[stage], placement.slots[stage], faceBox(stage), onRest), stage).toBeGreaterThan(0.05);
  }
});

test("the slots' attach points alone (no thread, no orb) are well clear of the other arms and the face", () => {
  for (const stage of ['intro', 'overview'] as const) {
    expect(threadClearance(VEYRA_POSES[stage], placement.slots[stage], faceBox(stage)), stage).toBeGreaterThan(0.1);
  }
});

test('no two of her orbs touch at rest (a 0.02 gap at least), on the arms as drawn', () => {
  for (const stage of ['intro', 'overview'] as const) {
    const drawn = drawnArms(stage);
    const centres = placement.slots[stage].map(slot => {
      const [x, y] = armPoint(drawn[slot.arm], slot.at);
      return tetherCurve([x, y, 0], 0, placement.tether, placement.sizes[stage]).orbCentre;
    });
    for (let i = 0; i < centres.length; i++) {
      for (let j = i + 1; j < centres.length; j++) {
        expect(Math.hypot(centres[i][0] - centres[j][0], centres[i][1] - centres[j][1]), `${stage} ${i}/${j}`).toBeGreaterThan(2 * placement.sizes[stage] + 0.02);
      }
    }
  }
});

test('a swing of a few degrees keeps them clear too (the idle sway is within 2 degrees); the full 25 is not promised', () => {
  for (const stage of ['intro', 'overview'] as const) {
    expect(threadClearance(VEYRA_POSES[stage], placement.slots[stage], faceBox(stage), geometry(stage, [-2 * DEG, 0, 2 * DEG])), stage).toBeGreaterThan(0.04);
  }
});

test('her tether is her own palette: the cyan wet-skin highlight and the cream of her cups', () => {
  expect(placement.tether.color).toBe(VEYRA.palette.wet);
  expect(placement.tether.cap).toBe(VEYRA.palette.suckerBody);
  expect(placement.tether.length).toBeGreaterThan(0);
});
