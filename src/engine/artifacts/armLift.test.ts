import { describe, expect, it } from 'vitest';
import { ARM_IDS, type ArmId, type Point2 } from '../config/types';
import type { StagePose } from '../poses/types';
import { ArmLiftChoreography, LIFT_MAX_TURN, RELEASE_MS, RELEASE_OVERSHOOT, armLiftTarget, busyWeight, liftProgress, liftWeightAt, releaseShape, tracedLift } from './armLift';

/** A plain arm: from its root at (-0.3, -1) out to the left and a little down, eleven points. */
const LEFT: Point2[] = Array.from({ length: 11 }, (_, k) => [-0.3 - 0.15 * k, -1 - 0.03 * k] as Point2);
/** Its mirror on the right. */
const RIGHT: Point2[] = LEFT.map(([x, y]) => [-x, y] as Point2);

const pose = (arms: Partial<Record<ArmId, Point2[]>> = {}): StagePose => ({
  arms: Object.fromEntries(ARM_IDS.map((id, i) => [id, arms[id] ?? (i < 4 ? LEFT : RIGHT)])) as Record<ArmId, Point2[]>,
  body: { x: 0, y: 0, scale: 1, yaw: 0 },
  expression: 'happy',
  headMorph: 1,
  orbs: 1,
});

const tip = (curve: readonly Point2[]) => curve[curve.length - 1];
const turnOf = (curve: readonly Point2[]) => Math.atan2(tip(curve)[1] - curve[0][1], tip(curve)[0] - curve[0][0]);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const length = (curve: readonly Point2[]) => curve.slice(1).reduce((sum, p, k) => sum + Math.hypot(p[0] - curve[k][0], p[1] - curve[k][1]), 0);

const EASE_MS = 450;

describe('the lift over time (spec 7.5: about 450 ms, ease-out, root first, tip last)', () => {
  it('reaches the target by 450 ms along the whole arm', () => {
    for (let u = 0; u <= 1; u += 0.05) {
      expect(liftProgress(EASE_MS, u, EASE_MS)).toBe(1);
      expect(liftProgress(600, u, EASE_MS)).toBe(1);
      expect(liftProgress(0, u, EASE_MS)).toBe(0);
    }
  });

  it('has the root lead the tip at 150 ms', () => {
    const root = liftProgress(150, 0, EASE_MS);
    const tipP = liftProgress(150, 1, EASE_MS);
    expect(root).toBeGreaterThan(tipP);
    expect(root).toBeGreaterThan(0.5);
    // Along the arm it falls off root to tip, every moment of the lift.
    for (let ms = 0; ms <= EASE_MS; ms += 10) for (let u = 0.1; u <= 1; u += 0.1) expect(liftProgress(ms, u, EASE_MS)).toBeLessThanOrEqual(liftProgress(ms, u - 0.1, EASE_MS) + 1e-12);
  });

  it('eases out: each point never moves back and slows into the target', () => {
    for (const u of [0, 0.5, 1]) {
      let last = 0;
      let lastStep = Infinity;
      let late = 0;
      for (let ms = 0; ms <= EASE_MS; ms += 5) {
        const p = liftProgress(ms, u, EASE_MS);
        expect(p).toBeGreaterThanOrEqual(last);
        if (p > 0 && last > 0 && ms > EASE_MS * 0.85) late = Math.max(late, p - last);
        lastStep = p - last;
        last = p;
      }
      expect(lastStep).toBeLessThan(0.01);
      expect(late).toBeLessThan(0.05);
    }
  });

  it('releasing returns to rest with an overshoot at most `settle` x the approved value', () => {
    for (const settle of [1, 0.6, 0]) {
      let least = Infinity;
      for (let ms = 0; ms <= RELEASE_MS; ms += 2) for (let u = 0; u <= 1; u += 0.1) least = Math.min(least, releaseShape(ms, u, settle));
      expect(least).toBeGreaterThanOrEqual(-settle * RELEASE_OVERSHOOT - 1e-12);
      // The settle is there, and is the personality's share of it.
      if (settle > 0) expect(least).toBeLessThan(-settle * RELEASE_OVERSHOOT * 0.9);
      for (let u = 0; u <= 1; u += 0.1) {
        expect(releaseShape(0, u, settle)).toBe(1);
        expect(releaseShape(RELEASE_MS, u, settle)).toBe(0);
      }
    }
    // Veyra's settle 0.6: the run past rest is 60% of the approved 0.1.
    expect(RELEASE_OVERSHOOT).toBe(0.1);
  });
});

describe('armLiftTarget (the owning arm, its lifted shape)', () => {
  it('uses the world\'s traced lift for the arm when there is one, unturned with no pointer', () => {
    const traced: Point2[] = [[-0.3, -1], [-0.6, -0.6], [-0.7, -0.1], [-0.9, 0.2]];
    const target = armLiftTarget({ arm: 'T1', at: 0.96, order: 0 }, null, pose(), traced);
    expect(target.arm).toBe('T1');
    expect(target.curve).toEqual(traced);
    // Keyboard or touch: up and forward (toward the visitor: a negative pitch).
    expect(target.pitch).toBeLessThan(0);
  });

  it('with no trace, lifts the owning arm straight up (keyboard or touch): its tip rises, its root and length stay', () => {
    for (const arm of ['T2', 'T7'] as const) {
      const rest = pose();
      const target = armLiftTarget({ arm, at: 0.9, order: 3 }, null, rest);
      expect(target.arm).toBe(arm);
      expect(target.curve[0]).toEqual(rest.arms[arm][0]);
      expect(tip(target.curve)[1]).toBeGreaterThan(tip(rest.arms[arm])[1] + 0.3);
      expect(length(target.curve)).toBeCloseTo(length(rest.arms[arm]), 9);
      // Turned toward up, by at most the lift's limit.
      const turned = Math.abs(wrap(turnOf(target.curve) - turnOf(rest.arms[arm])));
      expect(turned).toBeGreaterThan(0.3);
      expect(turned).toBeLessThanOrEqual(LIFT_MAX_TURN + 1e-9);
      expect(target.pitch).toBeLessThan(0);
    }
  });

  it('with a pointer, lifts toward it (and not forward)', () => {
    const rest = pose();
    const pointer = [-1.2, 0.4, 0] as const;
    const target = armLiftTarget({ arm: 'T2', at: 0.9, order: 3 }, pointer, rest);
    const distance = (c: readonly Point2[]) => Math.hypot(tip(c)[0] - pointer[0], tip(c)[1] - pointer[1]);
    expect(distance(target.curve)).toBeLessThan(distance(rest.arms.T2) - 0.2);
    expect(target.pitch).toBe(0);
    // A pointer below the arm lowers nothing: a lift only ever raises.
    const below = armLiftTarget({ arm: 'T2', at: 0.9, order: 3 }, [-1.5, -2.5, 0], rest);
    expect(tip(below.curve)[1]).toBeGreaterThanOrEqual(tip(rest.arms.T2)[1] - 1e-9);
  });

  it('reads a traced lift from the world\'s techFocus pose only for the overview, where it differs from it', () => {
    const traced: Point2[] = [[-0.3, -1], [-0.6, -0.6], [-0.9, 0.2]];
    const poses = { overview: pose(), intro: pose(), techFocus: pose({ T1: traced }) };
    expect(tracedLift(poses, 'overview', 'T1')).toBe(traced);
    expect(tracedLift(poses, 'overview', 'T2')).toBeUndefined();
    expect(tracedLift(poses, 'intro', 'T1')).toBeUndefined();
    // A techFocus pose that is the overview's (Nox's way) traces none.
    expect(tracedLift({ ...poses, techFocus: poses.overview }, 'overview', 'T1')).toBeUndefined();
  });
});

describe('ArmLiftChoreography (one chosen at a time)', () => {
  const arms: ArmId[] = ['T1', 'T8', 'T2', 'T7'];
  const make = () => new ArmLiftChoreography(i => arms[i]);

  it('lifts the chosen pendant\'s own arm', () => {
    const lift = make();
    lift.choose(2, 1000);
    const [frame] = lift.sample(1000 + EASE_MS);
    expect(frame.bubble).toBe(2);
    expect(frame.arm).toBe('T2');
    for (let u = 0; u <= 1; u += 0.1) expect(liftWeightAt(frame, u, EASE_MS, 0.6)).toBe(1);
  });

  it('choosing a second pendant releases the first', () => {
    const lift = make();
    lift.choose(0, 0);
    lift.sample(500);
    lift.choose(3, 500);
    const frames = lift.sample(600);
    const first = frames.find(f => f.bubble === 0)!;
    const second = frames.find(f => f.bubble === 3)!;
    expect(first.releasing).toBe(true);
    expect(second.releasing).toBe(false);
    // It lowers root first, as it lifted.
    expect(liftWeightAt(first, 0, EASE_MS, 0.6)).toBeLessThan(1);
    expect(frames.filter(f => !f.releasing)).toHaveLength(1);
    // The first is gone once its release is over.
    expect(lift.sample(500 + RELEASE_MS + 1).map(f => f.bubble)).toEqual([3]);
  });

  it('choosing none lets go; a release from part way starts from where the lift was', () => {
    const lift = make();
    lift.choose(1, 0);
    lift.choose(null, 100);
    const [frame] = lift.sample(100);
    expect(frame.releasing).toBe(true);
    const at = liftWeightAt(frame, 0, EASE_MS, 0.6);
    expect(at).toBeCloseTo(liftProgress(100, 0, EASE_MS), 9);
  });

  it('with motion off (instant) is lifted at once, and let go at once with no overshoot', () => {
    const lift = make();
    lift.instant = true;
    lift.choose(0, 0);
    const [frame] = lift.sample(0);
    for (let u = 0; u <= 1; u += 0.1) expect(liftWeightAt(frame, u, EASE_MS, 0.6)).toBe(1);
    lift.choose(null, 10);
    expect(lift.sample(10)).toEqual([]);
  });

  it('a frozen still can show any moment of the lift (`hold=` ms)', () => {
    const lift = make();
    lift.choose(0, 0);
    const [frame] = lift.sample(150);
    expect(liftWeightAt(frame, 0, EASE_MS, 0.6)).toBeGreaterThan(liftWeightAt(frame, 1, EASE_MS, 0.6));
  });
});

describe('the busy-arm hook (Task 16 flourish)', () => {
  it('an arm is busy while it holds or lifts, and a flourish yields to the larger', () => {
    expect(busyWeight(0, 0)).toBe(0);
    expect(busyWeight(0.4, 0)).toBe(0.4);
    expect(busyWeight(0, 0.7)).toBe(0.7);
    expect(busyWeight(0.3, 0.7)).toBe(0.7);
    // The release's settle dips the lift below 0: that is still an arm at work, not a negative busy.
    expect(busyWeight(0, -0.05)).toBe(0.05);
  });
});

describe('a lifting arm starts no flourish (the scheduler with the busy-arm hook as Octopus wires it)', () => {
  it('never starts a flourish on the arm that is lifting, and does on it once it is at rest', async () => {
    const { FlourishScheduler } = await import('../behavior/flourish');
    const hold = new Float32Array(8);
    const liftW = new Float32Array(8);
    liftW[0] = 0.3;
    const busy = (arm: ArmId) => busyWeight(hold[ARM_IDS.indexOf(arm)], liftW[ARM_IDS.indexOf(arm)]) > 0;
    // A scheduler whose draws always pick T1 first (rng 0), at a high rate so it starts often.
    const scheduler = new FlourishScheduler(60, () => 0);
    const started: ArmId[] = [];
    for (let t = 0; t < 120; t += 0.05) {
      const playing = scheduler.step(t, busy);
      if (playing && !started.includes(ARM_IDS[playing.index])) started.push(ARM_IDS[playing.index]);
    }
    expect(started).not.toContain('T1');
    expect(started.length).toBeGreaterThan(0);
  });
});
