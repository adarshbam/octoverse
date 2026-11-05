import * as THREE from 'three';
import { expect, test } from 'vitest';
import { assignPendants, idleSway, pendantSwing, restSwing, swingLimits } from '../../engine/artifacts/pendant';
import { PULSE_GROW, orbGrowStart, pulseFrame, pulseLength, pulseSchedule, revealSize } from '../../engine/artifacts/pulseAppear';
import { SELECTS, APPEARS, choiceRemoved, placementCapacity } from '../../engine/artifacts/strategies';
import { CAMERA_Z } from '../../engine/config/stage';
import { ARM_IDS } from '../../engine/config/types';
import { validateBundle } from '../../engine/types/bundle';
import { projectToScreen } from '../../engine/stage/anchors';
import { fovFor } from '../../engine/stage/framing';
import { faceAnchor } from '../../engine/types/bundle';
import { CAP_VIOLET_PINK, FLUX_ARTIFACTS, FLUX_SLOTS, INTRO_ORB_SIZE, ORB_RIM } from './artifacts';
import { FLUX_BUNDLE, FLUX_STAGE_FRAMES, FLUX_STAGE_PANELS } from './bundle';
import { FLUX } from './character';
import { FLUX_POSES } from './poses';
import { VIEWPORTS, clearance, htmlBoxes, leastOrbGap, outsideBox, seenFace, seenOrbs, slotPoint } from './slotCriteria';

// Flux's technology orbs as pendants (spec 7.5, Task 12): sixteen slots, a tip on every arm and a
// mid-arm slot about 55% along, twelve shown as P3 (the eight tips and the mids of the four upper
// arms), and the overview's orbs clear of the other arms, the face and the HTML.

const { placement } = FLUX_ARTIFACTS;
const TOP_DOWN = ['T1', 'T8', 'T2', 'T7', 'T3', 'T6', 'T4', 'T5'];
/** The technologies his project shows (content: twelve primaries, as P3). */
const SHOWN = 12;
const overview = FLUX_POSES.overview;

test('sixteen slots a stage, at most two an arm: the tips first (top arms first), then the mids of T1, T8, T2, T7, then T3, T6, T4, T5', () => {
  for (const stage of ['intro', 'overview'] as const) {
    const slots = [...FLUX_SLOTS[stage]].sort((a, b) => a.order - b.order);
    expect(slots.length, stage).toBe(16);
    expect(slots.map(s => s.order), stage).toEqual(slots.map((_, i) => i));
    for (const arm of ARM_IDS) expect(slots.filter(s => s.arm === arm).length, `${stage} ${arm}`).toBeLessThanOrEqual(2);
    expect(slots.slice(0, 8).map(s => [s.arm, s.at]), stage).toEqual(TOP_DOWN.map(arm => [arm, 1]));
    expect(slots.slice(8).map(s => [s.arm, s.at]), stage).toEqual(TOP_DOWN.map(arm => [arm, 0.55]));
  }
  expect(placement.slots).toBe(FLUX_SLOTS);
  expect(placement.maxPerArm).toBe(2);
  expect(placementCapacity(placement)).toBe(16);
});

test('twelve technologies take all eight tips and the mid slots of T1, T8, T2 and T7', () => {
  const { placed, tray } = assignPendants(12, FLUX_SLOTS.overview);
  expect(tray).toEqual([]);
  expect(placed.filter(p => p.slot.at === 1).map(p => p.slot.arm).sort()).toEqual([...ARM_IDS].sort());
  expect(placed.filter(p => p.slot.at !== 1).map(p => p.slot.arm)).toEqual(['T1', 'T8', 'T2', 'T7']);
});

test('three technologies take the tips of T1, T8 and T2', () => {
  expect(assignPendants(3, FLUX_SLOTS.overview).placed.map(p => [p.slot.arm, p.slot.at])).toEqual([['T1', 1], ['T8', 1], ['T2', 1]]);
});

test('twenty technologies: sixteen hang and four go to the tray, never to extra arms (Review Focus 1)', () => {
  const { placed, tray } = assignPendants(20, FLUX_SLOTS.overview);
  expect(placed.length).toBe(16);
  expect(tray).toEqual([16, 17, 18, 19]);
});

test('the orbs: radius 0.28 in the overview, none in the intro; no thread, a violet-pink cap and no rim beads (spec 7.5)', () => {
  expect(placement.sizes.overview).toBe(0.28);
  // The engine refuses a size of 0 (types/bundle.ts checkPendants: above 0): the intro's is the least it takes.
  expect(placement.sizes.intro).toBe(INTRO_ORB_SIZE);
  expect(INTRO_ORB_SIZE).toBeLessThanOrEqual(0.001);
  expect(placement.tether.length).toBe(0);
  expect(placement.tether.sag).toBe(0);
  expect(placement.tether.color).toBe(CAP_VIOLET_PINK);
  expect(placement.tether.cap).toBe(CAP_VIOLET_PINK);
  expect(FLUX_ARTIFACTS.orbStyle).toEqual({ rimBeads: 0, rimColour: ORB_RIM, cap: { colour: CAP_VIOLET_PINK, size: 0.05 } });
  expect(FLUX_ARTIFACTS.choosableIn).toEqual(['overview']);
});

test('the cap is P3\'s violet-pink and the rim P3\'s lavender (sampled from the native panel)', () => {
  const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const [cr, cg, cb] = rgb(CAP_VIOLET_PINK);
  expect(cb).toBeGreaterThan(cr);
  expect(cr - cg).toBeGreaterThanOrEqual(25);
  const [rr, rg, rb] = rgb(ORB_RIM);
  expect(rb).toBeGreaterThan(Math.max(rr, rg));
  expect(Math.min(rr, rg)).toBeGreaterThanOrEqual(170);
});

test('the overview: with his twelve, every orb stays more than 0.05 clear of the other arms, the face and the project panel, at the review desktop', () => {
  const boxes = htmlBoxes(overview, FLUX_STAGE_PANELS.overview, FLUX_STAGE_FRAMES.overview, 'desktop', SHOWN);
  expect(clearance(overview, FLUX_SLOTS.overview, placement, SHOWN, boxes)).toBeGreaterThan(0.05);
});

test('the overview at the 390 x 844 frame: the orbs stay more than 0.05 clear of the other arms and the face', () => {
  expect(clearance(overview, FLUX_SLOTS.overview, placement, SHOWN, [])).toBeGreaterThan(0.05);
});

test('the known limit: on the 390 x 844 phone the sheet and the tray (which lists every technology) cover his lowest orbs', () => {
  // P3 hangs the lower orbs below the face (down to y -2.3); the engine frames the overview centred,
  // so on a phone held upright the sheet and the tray rise to about y -1.72 over them. An engine
  // owner item (hide the hanging orbs where the tray lists every technology, or set the phone's
  // Flux in the upper screen, spec 7.11): when it lands this test flips and goes.
  const boxes = htmlBoxes(overview, FLUX_STAGE_PANELS.overview, FLUX_STAGE_FRAMES.overview, 'phone', SHOWN);
  expect(clearance(overview, FLUX_SLOTS.overview, placement, SHOWN, boxes)).toBeLessThan(0.05);
  const [tray] = boxes;
  const covered = seenOrbs(overview, FLUX_SLOTS.overview, placement, SHOWN).filter(o => o.y - o.r < overview.body.y + tray.y1 + 0.05);
  expect(covered.map(o => o.slot.arm).sort()).toEqual(['T3', 'T4', 'T5', 'T6']);
});

test('at the overview frame no orb overlaps the face, the panel (with its title) or another orb', () => {
  const orbs = seenOrbs(overview, FLUX_SLOTS.overview, placement, SHOWN);
  expect(orbs.length).toBe(SHOWN);
  const face = seenFace(overview);
  const [left, top, right, bottom] = FLUX_STAGE_PANELS.overview;
  const panel = { x0: left, x1: right, y0: bottom, y1: top };
  for (const orb of orbs) {
    expect(outsideBox(orb, face), `${orb.slot.arm}@${orb.slot.at} face`).toBeGreaterThan(0.05);
    expect(outsideBox(orb, panel), `${orb.slot.arm}@${orb.slot.at} panel`).toBeGreaterThan(0.05);
  }
  expect(leastOrbGap(orbs)).toBeGreaterThan(0.05);
});

test('the intro title and nameplate: the intro hangs no orb (its size is the least the engine takes), so none can sit under them', () => {
  // In the overview both fade out (ui/IntroOverlay); the intro's orbs are a thousandth of a unit.
  expect(placement.sizes.intro * 2 * 1024 / 5.1).toBeLessThan(0.5);
});

test('the tech focus (P4): the overview with T8 straight up, its tip orb held high beside the head', () => {
  const focus = FLUX_POSES.techFocus;
  expect(Object.keys(focus.arms)).toEqual([...ARM_IDS]);
  expect(focus.body).toEqual(overview.body);
  for (const arm of ARM_IDS.filter(a => a !== 'T8')) expect(focus.arms[arm], arm).toBe(overview.arms[arm]);
  const tip = slotPoint(focus, { arm: 'T8', at: 1, order: 1 });
  const before = slotPoint(overview, { arm: 'T8', at: 1, order: 1 });
  const headTop = focus.body.y + focus.body.scale * FLUX.head.top;
  // Held high: the tip well above the head and above where it hangs in the overview.
  expect(tip[1]).toBeGreaterThan(headTop + 1);
  expect(tip[1]).toBeGreaterThan(before[1] + 0.5);
  // Straight up: from its shoulder to the crown of its hook the arm climbs within 15 degrees of vertical.
  const shoulder = slotPoint(focus, { arm: 'T8', at: 0.62, order: 0 });
  const crown = slotPoint(focus, { arm: 'T8', at: 0.88, order: 0 });
  expect(Math.abs(Math.atan2(crown[0] - shoulder[0], crown[1] - shoulder[1]))).toBeLessThan((15 * Math.PI) / 180);
  expect(focus.headMorph).toBe(0);
  expect(focus.orbs).toBe(1);
  // His twelve stay clear of the other arms and the face here too.
  expect(clearance(focus, FLUX_SLOTS.overview, placement, SHOWN, [])).toBeGreaterThan(0.05);
});

test.each([
  ['1536 x 1024', 1536, 1024],
  ['1280 x 720', 1280, 720],
  ['390 x 844', 390, 844],
])('the detail (P5) keeps the face anchor on screen at %s, at the left of the frame', (_label, width, height) => {
  const size = { width, height };
  const camera = new THREE.PerspectiveCamera(fovFor(FLUX_STAGE_FRAMES.detail, size), width / height, 0.1, 60);
  camera.position.set(0, 0, CAMERA_Z);
  camera.updateMatrixWorld();
  const [x, y, z] = faceAnchor(FLUX_BUNDLE, 'detail');
  const { x: sx, y: sy, visible } = projectToScreen(new THREE.Vector3(x, y, z), camera, size);
  expect(visible).toBe(true);
  expect(sx).toBeGreaterThan(0);
  expect(sx).toBeLessThan(width * 0.3);
  expect(sy).toBeGreaterThan(0);
  expect(sy).toBeLessThan(height);
  expect(Object.keys(FLUX_POSES.detail.arms)).toEqual([...ARM_IDS]);
  expect(FLUX_POSES.detail.orbs).toBe(0);
});

test('the viewports are the review desktop and the phone held upright', () => {
  expect(VIEWPORTS).toEqual({ desktop: { width: 1536, height: 1024 }, phone: { width: 390, height: 844 } });
});

// --- Task 16: the pulse appear, the swell's reveal, the swing and the lift pulse (spec 7.5) --------------

const DEG = Math.PI / 180;
const cups = FLUX.suckers.pulse!;

test('his orbs appear with the pulse (0.18 s apart), are lifted over 0.3 s with a pulse, reveal with the swell and swing 18 degrees at most', () => {
  expect(FLUX_ARTIFACTS.appear).toEqual({ kind: 'pulse', step: 0.18 });
  expect(FLUX_ARTIFACTS.select).toEqual({ kind: 'armLift', ease: 0.3, scale: 1.25, threadShorten: 0, pulse: true });
  expect(SELECTS.armLift.reaction).toBe('focused');
  expect(placement.reveal).toEqual({ start: 0.35, span: 0.3, step: 0.03 });
  expect(placement.swing).toEqual({ maxAngle: 18 * DEG, settle: 0.8 });
  expect(SELECTS.armLift.settleMs(FLUX_ARTIFACTS.select)).toBe(300);
  expect('sheet' in APPEARS.pulse).toBe(false);
  // The bundle as a whole still validates: the appear needs no sheet, and his cups pulse.
  expect(() => validateBundle(FLUX_BUNDLE)).not.toThrow();
  expect(cups.speed).toBeGreaterThan(0);
});

test('the intro shows pulses and no orbs: the orbs are the least the engine takes, and no button or tray entry is offered there (A3)', () => {
  expect(choiceRemoved('intro', FLUX_ARTIFACTS)).toBe(true);
  const context = { appear: FLUX_ARTIFACTS.appear, placement, pulse: cups };
  const total = pulseLength(SHOWN, placement, 0.18, cups.speed);
  for (let i = 0; i < 16; i++) {
    for (let t = 0; t <= total + 0.5; t += 1 / 30) {
      const radius = Math.max(placement.sizes.intro, revealSize(0, i, placement.reveal!, placement.sizes.overview)) * pulseFrame(null, i, t, 16, context).scale;
      expect(radius).toBeLessThanOrEqual(INTRO_ORB_SIZE + 1e-12);
    }
  }
});

test("with his speed, no orb starts to grow before its arm's pulse reaches its slot, and the appear is over in under two seconds", () => {
  const context = { appear: FLUX_ARTIFACTS.appear, placement, pulse: cups };
  const schedule = pulseSchedule(0.18);
  for (const slot of FLUX_SLOTS.overview) {
    const index = slot.order;
    const start = orbGrowStart(slot, schedule, cups.speed);
    expect(pulseFrame(null, index, start, 16, context).scale).toBe(0);
    expect(pulseFrame(null, index, start + PULSE_GROW / 2, 16, context).scale).toBeGreaterThan(0);
    expect(start).toBeGreaterThanOrEqual(schedule.find(f => f.arm === slot.arm)!.fireAt + slot.at / cups.speed - 1e-12);
  }
  expect(pulseLength(16, placement, 0.18, cups.speed)).toBeLessThan(2);
});

test('the swell reveals the orbs: nothing up to swell 0.35, monotonic, the overview size (0.28) at swell 1 for all sixteen', () => {
  const reveal = placement.reveal!;
  for (let i = 0; i < 16; i++) {
    let last = 0;
    for (let swell = 0; swell <= 1.0000001; swell += 0.0025) {
      const size = revealSize(swell, i, reveal, placement.sizes.overview);
      expect(size, `orb ${i} at ${swell}`).toBeGreaterThanOrEqual(last - 1e-12);
      last = size;
      if (swell <= 0.35) expect(size).toBeLessThan(1e-9);
    }
    expect(revealSize(1, i, reveal, placement.sizes.overview), `orb ${i}`).toBe(0.28);
  }
});

test('the swing stays within 18 degrees for a 3 units a second step of the arm and settles within 0.8 s', () => {
  const limits = swingLimits(placement);
  expect(limits).toEqual({ maxAngle: 18 * DEG, settle: 0.8 });
  for (const secs of [0.1, 0.4, 1, 3]) {
    let state = restSwing(0);
    let worst = 0;
    let t = 0;
    for (; t <= secs; t += 1 / 120) {
      const r = pendantSwing([3, 0, 0], t, state, limits, false);
      state = r.state;
      worst = Math.max(worst, Math.abs(r.angle));
    }
    const stopped = t;
    for (; t <= stopped + 1.5; t += 1 / 120) {
      const r = pendantSwing([0, 0, 0], t, state, limits, false);
      state = r.state;
      worst = Math.max(worst, Math.abs(r.angle));
      if (t >= stopped + limits.settle) {
        expect(Math.abs(r.state.x), `${secs} s`).toBeLessThanOrEqual(1 * DEG);
        expect(Math.abs(r.angle - idleSway(t, 0, limits))).toBeLessThanOrEqual(1 * DEG);
      }
    }
    expect(worst, `${secs} s`).toBeLessThanOrEqual(18 * DEG + 1e-12);
  }
  // Reduced motion: none.
  expect(pendantSwing([3, 0, 0], 1, restSwing(0), limits, true).angle).toBe(0);
});

test('at the full swing of 18 degrees either way his twelve orbs still hang clear of the other arms and the face (a little: 0.029)', () => {
  const swung = clearance(overview, FLUX_SLOTS.overview, placement, SHOWN, [], [-18 * DEG, 0, 18 * DEG]);
  expect(swung).toBeGreaterThan(0);
  expect(swung).toBeGreaterThan(0.02);
  // The clearance at rest is the Task 12 figure, and 25 degrees (Veyra's) would take the orbs through the arms: the swing is kept small.
  expect(clearance(overview, FLUX_SLOTS.overview, placement, SHOWN, [], [0])).toBeGreaterThan(0.05);
  expect(clearance(overview, FLUX_SLOTS.overview, placement, SHOWN, [], [-25 * DEG, 25 * DEG])).toBeLessThan(0.01);
});
