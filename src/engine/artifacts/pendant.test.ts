import { expect, test } from 'vitest';
import { ARM_IDS, type ArmId, type PendantSlot, type SwingLimits } from '../config/types';
import type { StagePose } from '../poses/types';
import { pendantFixture } from './fixtures/pendant';
import { DEFAULT_SWING, type SwingState, armPoint, assignPendants, idleSway, pendantSwing, restSwing, swingLimits, threadClearance } from './pendant';
import type { Box } from './suctionHold';

const DEG = Math.PI / 180;
const FRAME = 1 / 60;

/** Sixteen slots, two on each arm, in a plain order: the first eight one an arm, the next eight the second. */
const slots16: PendantSlot[] = ARM_IDS.flatMap((arm, i) => [{ arm, at: 0.9, order: i }, { arm, at: 0.6, order: 8 + i }]);

const perArm = (slots: readonly PendantSlot[]) => {
  const count = new Map<ArmId, number>();
  for (const slot of slots) count.set(slot.arm, (count.get(slot.arm) ?? 0) + 1);
  return count;
};

test('three technologies take the slots with order 0 to 2', () => {
  const { placed, tray } = assignPendants(3, slots16);
  expect(placed.map(p => p.slot.order)).toEqual([0, 1, 2]);
  expect(placed.map(p => p.techIndex)).toEqual([0, 1, 2]);
  expect(tray).toEqual([]);
});

test('technologies take the slots in order whatever order the table lists them in', () => {
  const shuffled = [...slots16].reverse();
  const { placed } = assignPendants(5, shuffled);
  expect(placed.map(p => p.slot.order)).toEqual([0, 1, 2, 3, 4]);
});

test('twenty technologies place sixteen and tray the last four', () => {
  const { placed, tray } = assignPendants(20, slots16);
  expect(placed).toHaveLength(16);
  expect(placed.map(p => p.techIndex)).toEqual([...Array(16).keys()]);
  expect(tray).toEqual([16, 17, 18, 19]);
});

test('no arm carries more than two, even from a table that offers more', () => {
  for (const count of [0, 1, 7, 16, 40]) {
    const { placed } = assignPendants(count, slots16);
    for (const n of perArm(placed.map(p => p.slot)).values()) expect(n).toBeLessThanOrEqual(2);
  }
  const crowded: PendantSlot[] = [0, 1, 2, 3].map(order => ({ arm: 'T1', at: 0.2 + 0.2 * order, order }));
  const { placed, tray } = assignPendants(4, crowded);
  expect(placed.map(p => p.slot.order)).toEqual([0, 1]);
  expect(tray).toEqual([2, 3]);
});

test('no technologies place none, and no slots tray every technology', () => {
  expect(assignPendants(0, slots16)).toEqual({ placed: [], tray: [] });
  expect(assignPendants(3, [])).toEqual({ placed: [], tray: [0, 1, 2] });
});

// --- The swing ---------------------------------------------------------------------------------

/** Runs the swing frame by frame: `moving` seconds at `speed`, then still for `after`; the worst angle and the angle at each frame's time. */
function run(limits: SwingLimits, speed: number, moving: number, after: number) {
  let state: SwingState = restSwing(0);
  let peak = 0;
  const angles: { t: number; angle: number }[] = [];
  const total = moving + after;
  for (let k = 0; k <= Math.round(total / FRAME); k++) {
    const t = k * FRAME;
    const out = pendantSwing([t < moving ? speed : 0, 0, 0], t, state, limits, false);
    state = out.state;
    peak = Math.max(peak, Math.abs(out.angle));
    angles.push({ t, angle: out.angle });
  }
  return { peak, angles };
}

test('with the default limits a step of 3 units a second stays within 25 degrees and settles in 1.2 s', () => {
  const { peak, angles } = run(DEFAULT_SWING, 3, 0.6, 3);
  expect(DEFAULT_SWING).toEqual({ maxAngle: 25 * DEG, settle: 1.2 });
  expect(peak).toBeLessThanOrEqual(25 * DEG + 1e-9);
  // It really swings (the limit is met by the drive, not by a swing that never starts).
  expect(peak).toBeGreaterThan(15 * DEG);
  for (const { t, angle } of angles) if (t >= 0.6 + 1.2) expect(Math.abs(angle - idleSway(t, 0, DEFAULT_SWING))).toBeLessThan(1 * DEG);
});

test("Flux's limits (18 degrees, 0.8 s) bound the same step and settle in 0.8 s", () => {
  const flux = { maxAngle: 18 * DEG, settle: 0.8 };
  const { peak, angles } = run(flux, 3, 0.6, 3);
  expect(peak).toBeLessThanOrEqual(18 * DEG + 1e-9);
  expect(peak).toBeGreaterThan(10 * DEG);
  for (const { t, angle } of angles) if (t >= 0.6 + 0.8) expect(Math.abs(angle - idleSway(t, 0, flux))).toBeLessThan(1 * DEG);
});

test('a gentler arm swings a pendant less, and it still settles', () => {
  const slow = run(DEFAULT_SWING, 0.3, 0.3, 3);
  const fast = run(DEFAULT_SWING, 3, 0.3, 3);
  expect(slow.peak).toBeLessThan(fast.peak);
  for (const { t, angle } of slow.angles) if (t >= 0.3 + 1.2) expect(Math.abs(angle - idleSway(t, 0, DEFAULT_SWING))).toBeLessThan(1 * DEG);
});

test('the swing is the same at any frame rate', () => {
  const at = (step: number) => {
    let state = restSwing(0);
    let angle = 0;
    for (let t = 0; t <= 1.0001; t += step) {
      const out = pendantSwing([t < 0.4 ? 2 : 0, 0, 0], t, state, DEFAULT_SWING, false);
      state = out.state;
      angle = out.angle;
    }
    return angle;
  };
  expect(Math.abs(at(1 / 120) - at(1 / 30))).toBeLessThan(2 * DEG);
});

test('a hitch (a long frame) does not throw the pendant out of its limit', () => {
  let state = restSwing(0);
  state = pendantSwing([3, 0, 0], 0, state, DEFAULT_SWING, false).state;
  const out = pendantSwing([3, 0, 0], 5, state, DEFAULT_SWING, false);
  expect(Math.abs(out.angle)).toBeLessThanOrEqual(25 * DEG + 1e-9);
});

test('a config without swing swings exactly as one with 25 degrees and 1.2 s', () => {
  const base = pendantFixture();
  const { swing: _swing, ...without } = base;
  expect(swingLimits(without)).toEqual({ maxAngle: 25 * DEG, settle: 1.2 });
  expect(swingLimits({ ...without, swing: { maxAngle: 25 * DEG, settle: 1.2 } })).toEqual(swingLimits(without));
  const a = run(swingLimits(without), 3, 0.6, 2).angles.map(f => f.angle);
  const b = run({ maxAngle: 25 * DEG, settle: 1.2 }, 3, 0.6, 2).angles.map(f => f.angle);
  expect(a).toEqual(b);
  expect(swingLimits({ ...without, swing: { maxAngle: 18 * DEG, settle: 0.8 } })).toEqual({ maxAngle: 18 * DEG, settle: 0.8 });
});

test('with reduced motion the angle is 0, always', () => {
  let state = restSwing(0);
  for (let k = 0; k < 120; k++) {
    const out = pendantSwing([3, 0, 0], k * FRAME, state, DEFAULT_SWING, true);
    state = out.state;
    expect(out.angle).toBe(0);
  }
  // Back to motion: it starts from rest, not from a swing it never made.
  expect(Math.abs(pendantSwing([0, 0, 0], 2, state, DEFAULT_SWING, false).angle)).toBeLessThan(3 * DEG);
});

test('at rest a pendant sways a little by itself, within a few degrees, and pendants are out of step', () => {
  const samples = (seed: number) => [...Array(200).keys()].map(k => idleSway(k * 0.1, seed, DEFAULT_SWING));
  const a = samples(0);
  expect(Math.max(...a.map(Math.abs))).toBeGreaterThan(0.5 * DEG);
  expect(Math.max(...a.map(Math.abs))).toBeLessThan(4 * DEG);
  expect(samples(1.7)).not.toEqual(a);
});

// --- Thread clearance --------------------------------------------------------------------------

/**
 * A pose of eight straight arms hanging side by side: arm k runs from (k, 0) down to (k, -2), so
 * neighbours are 1 apart; the face's box sits above them, y 0.5 to 2, x 2 to 5. (Veyra's own slots
 * are checked on her own poses in src/worlds/veyra/artifacts.test.ts.)
 */
const straightPose = { arms: Object.fromEntries(ARM_IDS.map((id, k) => [id, [[k, 0], [k, -0.5], [k, -1], [k, -1.5], [k, -2]]])) } as unknown as Pick<StagePose, 'arms'>;
const FACE: Box = { x0: 2, y0: 0.5, x1: 5, y1: 2 };
const STYLE = pendantFixture().tether;

test('an arm hanging its pendant beside another arm is as clear of it as the geometry says', () => {
  // T1 (x 0) hangs a pendant at its middle: the orb's edge is 1 - radius from T2's centre line (no arm thickness given).
  const slot: PendantSlot = { arm: 'T1', at: 0.5, order: 0 };
  const clear = threadClearance(straightPose, [slot], FACE, { style: STYLE, radius: 0.2 });
  expect(clear).toBeCloseTo(1 - 0.2, 2);
  // Taking the other arm's thickness off.
  const thick = threadClearance(straightPose, [slot], FACE, { style: STYLE, radius: 0.2, armRadius: () => 0.1 });
  expect(thick).toBeCloseTo(1 - 0.2 - 0.1, 2);
});

test('a longer thread or a bigger orb is closer to what hangs below or beside, and a swing brings the orb nearer the next arm', () => {
  const slot: PendantSlot = { arm: 'T1', at: 0.5, order: 0 };
  const base = threadClearance(straightPose, [slot], FACE, { style: STYLE, radius: 0.2 });
  expect(threadClearance(straightPose, [slot], FACE, { style: STYLE, radius: 0.4 })).toBeLessThan(base);
  const swung = threadClearance(straightPose, [slot], FACE, { style: { ...STYLE, length: 0.6 }, radius: 0.2, angles: [0.4] });
  expect(swung).toBeLessThan(base);
  // Without geometry only the attach point counts: it is 1 from the next arm.
  expect(threadClearance(straightPose, [slot], FACE)).toBeCloseTo(1, 2);
});

test('the face is measured too: a thread or orb that reaches its box has no clearance', () => {
  // T3 hangs from (2, 0): a box below its root, where the thread runs, is touched.
  const below: Box = { x0: 1.7, y0: -0.8, x1: 3, y1: -0.2 };
  const slot: PendantSlot = { arm: 'T3', at: 0, order: 0 };
  expect(threadClearance(straightPose, [slot], below, { style: { ...STYLE, length: 0.5 }, radius: 0.2 })).toBeLessThanOrEqual(0);
  // The attach point alone, inside a box over the root, is inside it too.
  expect(threadClearance(straightPose, [slot], { x0: 1.5, y0: -1, x1: 2.5, y1: 1 })).toBe(0);
  // A box well off to the side is not touched, and its distance is what is measured.
  const clear = threadClearance(straightPose, [slot], { x0: 4.5, y0: -2, x1: 6, y1: 2 }, { style: STYLE, radius: 0.2 });
  expect(clear).toBeGreaterThan(0.1);
});

test('a pendant does not count against its own arm, and no slots leave nothing to measure', () => {
  const clear = threadClearance(straightPose, [{ arm: 'T5', at: 1, order: 0 }], FACE, { style: STYLE, radius: 0.2 });
  expect(clear).toBeGreaterThan(0.5);
  expect(threadClearance(straightPose, [], FACE)).toBe(Infinity);
});

test('the arm point is found on the arm, by arc fraction', () => {
  const line = straightPose.arms.T4 as unknown as [number, number][];
  expect(armPoint(line, 0)[0]).toBeCloseTo(3, 6);
  expect(armPoint(line, 0)[1]).toBeCloseTo(0, 6);
  expect(armPoint(line, 0.5)[1]).toBeCloseTo(-1, 2);
  expect(armPoint(line, 1)[1]).toBeCloseTo(-2, 6);
});
