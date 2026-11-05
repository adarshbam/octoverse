import { expect, test } from 'vitest';
import { armLiftTarget, tracedLift } from '../../engine/artifacts/armLift';
import { armPoint, assignPendants, threadClearance } from '../../engine/artifacts/pendant';
import { SELECTS, focusStagePose, placementCapacity } from '../../engine/artifacts/strategies';
import { ARM_IDS } from '../../engine/config/types';
import { VEYRA_ARTIFACTS } from './artifacts';
import { VEYRA } from './character';
import { VEYRA_STAGE_FRAMES } from './bundle';
import { TECH_FOCUS_ORB, VEYRA_POSES } from './poses';
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

/** The technologies her project shows today (content: twelve primaries). */
const SHOWN = 12;

/** Clearance with `shown` technologies hung and the phone's tray sized for them. */
const clearance = (stage: (typeof STAGES)[number], view: ViewportName, shown: number) => stageClearance(VEYRA_POSES[stage], placement.slots[stage], placement, stage, VEYRA_STAGE_FRAMES[stage], view, shown, ENVELOPE);

test('with her twelve technologies, threads and orbs stay more than 0.05 clear of the other arms, the face and the HTML, across the whole swing, at the desktop and the 390 x 844 phone', () => {
  for (const stage of STAGES) {
    for (const view of VIEWS) expect(clearance(stage, view, SHOWN), `${stage} ${view}`).toBeGreaterThan(0.05);
  }
  // The envelope is her placement's swing limit both ways (spec 7.5: 25 degrees).
  expect(Math.max(...ENVELOPE)).toBeCloseTo((25 * Math.PI) / 180, 10);
});

test('all sixteen slots filled hold the same at the desktop, and in the intro on the phone', () => {
  for (const stage of STAGES) expect(clearance(stage, 'desktop', 16), `${stage} desktop`).toBeGreaterThan(0.05);
  expect(clearance('intro', 'phone', 16), 'intro phone').toBeGreaterThan(0.05);
});

test('the known limit: on the phone overview a thirteenth technology wraps the tray to three rows, over her lowest pendants', () => {
  // Twelve fit two rows of six; thirteen to fifteen (content allows fifteen primaries) need a third
  // row, whose top reaches her lowest pendants. Task 20 lifts this by hiding the hanging pendants
  // when the tray lists everything, or by changing the tray; this test then flips and goes.
  expect(clearance('overview', 'phone', 12)).toBeGreaterThan(0.05);
  for (const shown of [13, 15]) expect(clearance('overview', 'phone', shown), `${shown} shown`).toBeLessThan(0.05);
});

test('no orb or thread under the intro title block or nameplate (the HTML boxes alone), at either viewport', () => {
  const pose = VEYRA_POSES.intro;
  const geometry = geometryFor(pose, placement, 'intro', ENVELOPE);
  for (const view of VIEWS) {
    const boxes = htmlBoxes('intro', pose, VEYRA_STAGE_FRAMES.intro, view, 16);
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

// --- Task 19: the arm lift ----------------------------------------------------------------------

test("the arm lift lifts each pendant on its own arm, the same arm in both stages; in the overview T1 takes P4's traced lift", () => {
  for (const stage of STAGES) {
    for (const { techIndex, slot } of assignPendants(16, placement.slots[stage]).placed) {
      // The lift's target is the slot's own arm: no pendant is handed to another arm (the suction hold dropped React onto JavaScript's).
      expect(armLiftTarget(slot, null, VEYRA_POSES[stage], tracedLift(VEYRA_POSES, stage, slot.arm)).arm, `technology ${techIndex}`).toBe(slot.arm);
    }
  }
  expect(tracedLift(VEYRA_POSES, 'overview', 'T1')).toBe(VEYRA_POSES.techFocus.arms.T1);
  for (const arm of ARM_IDS.filter(id => id !== 'T1')) expect(tracedLift(VEYRA_POSES, 'overview', arm)).toBeUndefined();
  expect(tracedLift(VEYRA_POSES, 'intro', 'T1')).toBeUndefined();
});

test("a focus closes her head and wears the focused face, the arms staying the stage's (the engine's focusStagePose)", () => {
  const pose = focusStagePose(VEYRA_POSES, 'overview', SELECTS.armLift);
  expect(pose.headMorph).toBe(0);
  expect(pose.expression).toBe('focused');
  expect(pose.arms).toBe(VEYRA_POSES.overview.arms);
  expect(pose.body).toEqual(VEYRA_POSES.overview.body);
});

test("React's lifted orb hangs under the crown of P4's curl, level with TECH_FOCUS_ORB across, higher by the size it lacks", () => {
  const slot = placement.slots.overview.find(s => s.order === 0)!;
  expect(slot.arm).toBe('T1');
  const curve = VEYRA_POSES.techFocus.arms.T1;
  const target = armLiftTarget(slot, null, VEYRA_POSES.overview, tracedLift(VEYRA_POSES, 'overview', 'T1'));
  expect(target.hangAt).toBeLessThan(slot.at);
  const [ax, ay] = armPoint(curve, target.hangAt!);
  const body = VEYRA_POSES.overview.body;
  const hang = placement.tether.length * 0.7 + placement.sizes.overview * 1.25;
  const orb = [body.x + ax * body.scale, body.y + (ay - hang) * body.scale];
  // Across, within 0.05 of P4's orb; up, above it by what the smaller orb (0.106 against P4's about 0.25) leaves.
  expect(Math.abs(orb[0] - TECH_FOCUS_ORB[0])).toBeLessThan(0.05);
  expect(orb[1] - TECH_FOCUS_ORB[1]).toBeGreaterThan(0);
  expect(orb[1] - TECH_FOCUS_ORB[1]).toBeLessThan(0.4);
});
