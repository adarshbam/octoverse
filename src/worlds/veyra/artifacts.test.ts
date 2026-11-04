import { expect, test } from 'vitest';
import { assignPendants, threadClearance } from '../../engine/artifacts/pendant';
import { placementCapacity } from '../../engine/artifacts/strategies';
import { ARM_IDS } from '../../engine/config/types';
import { VEYRA_ARTIFACTS } from './artifacts';
import { VEYRA } from './character';
import { VEYRA_STAGE_FRAMES } from './bundle';
import { VEYRA_POSES } from './poses';
import { ENVELOPE, VIEWPORTS, type ViewportName, faceBox, geometryFor, htmlBoxes, leastOrbGap, ownArmClearance, stageClearance } from './slotCriteria';

const { placement } = VEYRA_ARTIFACTS;
const STAGES = ['intro', 'overview'] as const;
const VIEWS = Object.keys(VIEWPORTS) as ViewportName[];

test('sixteen slots a stage, two an arm, ordered 0 up, the tips of the top arms first', () => {
  for (const stage of STAGES) {
    const slots = placement.slots[stage];
    expect(slots.length, stage).toBe(16);
    expect(slots.map(s => s.order).sort((a, b) => a - b), stage).toEqual(slots.map((_, i) => i));
    for (const arm of ARM_IDS) expect(slots.filter(s => s.arm === arm).length, `${stage} ${arm}`).toBe(2);
    // The first pass is one an arm, top arms first, each arm's outer (tip) slot.
    expect(slots.slice(0, 8).map(s => s.arm), stage).toEqual(['T1', 'T8', 'T2', 'T7', 'T3', 'T6', 'T4', 'T5']);
    for (const first of slots.slice(0, 8)) expect(first.at, `${stage} ${first.arm}`).toBeGreaterThan(slots.find(s => s.arm === first.arm && s !== first)!.at);
    // Sixteen technologies all find a slot; the engine's capacity (the smaller stage's count) is sixteen.
    expect(assignPendants(16, slots).tray, stage).toEqual([]);
  }
  expect(placementCapacity(placement)).toBe(16);
});

test('every technology hangs from the same arm in the intro and the overview (it only slides along it)', () => {
  const intro = assignPendants(16, placement.slots.intro).placed;
  const overview = assignPendants(16, placement.slots.overview).placed;
  for (let i = 0; i < 16; i++) expect(intro[i].slot.arm, `technology ${i}`).toBe(overview[i].slot.arm);
});

test('threads and orbs stay more than 0.05 clear of the other arms, the face and the HTML, across the whole swing, at the desktop and the 390 x 844 phone', () => {
  for (const stage of STAGES) {
    for (const view of VIEWS) {
      expect(stageClearance(VEYRA_POSES[stage], placement.slots[stage], placement, stage, VEYRA_STAGE_FRAMES[stage], view, ENVELOPE), `${stage} ${view}`).toBeGreaterThan(0.05);
    }
  }
  // The envelope is the swing's limit both ways (spec 7.5: 25 degrees).
  expect(Math.max(...ENVELOPE)).toBeCloseTo((25 * Math.PI) / 180, 10);
});

test('no orb or thread under the intro title block or nameplate (the HTML boxes alone), at either viewport', () => {
  const pose = VEYRA_POSES.intro;
  const geometry = geometryFor(pose, placement, 'intro', ENVELOPE);
  for (const view of VIEWS) {
    const boxes = htmlBoxes('intro', pose, VEYRA_STAGE_FRAMES.intro, view);
    expect(boxes.length, view).toBeGreaterThanOrEqual(2);
    for (const box of boxes) expect(threadClearance(pose, placement.slots.intro, box, geometry), view).toBeGreaterThan(0.05);
  }
});

test("the same holds hanging straight down on the pose's own rest curves, before the rig's rest bend", () => {
  for (const stage of STAGES) {
    const { armLines: _drawn, ...onRest } = geometryFor(VEYRA_POSES[stage], placement, stage);
    expect(threadClearance(VEYRA_POSES[stage], placement.slots[stage], faceBox(stage), onRest), stage).toBeGreaterThan(0.05);
  }
});

test('no orb sits on its own arm away from where it hangs, across the whole swing', () => {
  for (const stage of STAGES) expect(ownArmClearance(VEYRA_POSES[stage], placement.slots[stage], placement, stage, ENVELOPE), stage).toBeGreaterThan(0);
});

test('no two of her orbs touch at rest (a 0.02 gap at least), on the arms as drawn', () => {
  for (const stage of STAGES) expect(leastOrbGap(VEYRA_POSES[stage], placement.slots[stage], placement, stage), stage).toBeGreaterThan(0.02);
});

test('her tether is her own palette: the cyan wet-skin highlight and the cream of her cups', () => {
  expect(placement.tether.color).toBe(VEYRA.palette.wet);
  expect(placement.tether.cap).toBe(VEYRA.palette.suckerBody);
  expect(placement.tether.length).toBeGreaterThan(0);
});
