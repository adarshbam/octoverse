import { expect, test } from 'vitest';
import type { Vec3 } from '../world/types';
import * as THREE from 'three';
import { type Box, HOLD_BEATS, HoldChoreography, type HoldFrame, nearestArm, pullPosition } from './suctionHold';

const FRAME = 1000 / 60;
const FACE: Box = { x0: -0.75, y0: -1.2, x1: 0.75, y1: 0.25 };

/** Runs a choreography frame by frame through `steps` of [untilMs, bubble], recording each frame's entries. */
function run(steps: [number, number | null][], instant = false, armFor = (b: number) => b) {
  const c = new HoldChoreography(armFor);
  c.instant = instant;
  const frames: { t: number; entries: HoldFrame[] }[] = [];
  let t = 0;
  for (const [until, bubble] of steps) {
    for (; t <= until; t += FRAME) {
      c.choose(bubble, t);
      frames.push({ t, entries: c.sample(t).map(e => ({ ...e })) });
    }
  }
  return frames;
}
const at = (frames: ReturnType<typeof run>, ms: number) => frames.reduce((best, f) => (Math.abs(f.t - ms) < Math.abs(best.t - ms) ? f : best));
const of = (frame: { entries: HoldFrame[] }, bubble: number) => frame.entries.find(e => e.bubble === bubble);

test('chooses the nearest arm that does not cross the face', () => {
  // The right arm's tip is nearer the bubble on Nox's left, but its way there runs across his face.
  const tips: Vec3[] = [[0.9, -0.6, 0], [-1.0, -2.5, 0], [1.6, -1.6, 0]];
  expect(Math.hypot(0.9 + 1.0, -0.6 + 0.5)).toBeLessThan(Math.hypot(0, -2.5 + 0.5));
  expect(nearestArm(tips, [-1.0, -0.5, 0], FACE)).toBe(1);
  // With nothing in the way, simply the nearest.
  expect(nearestArm(tips, [1.5, -0.9, 0], FACE)).toBe(0);
  expect(nearestArm(tips, [1.7, -2.0, 0], FACE)).toBe(2);
  // Above the head, an arm reaching up past its side is chosen, not one reaching through it.
  expect(nearestArm([[0, -1.7, 0], [-1.3, -0.4, 0]], [-0.2, 1.4, 0], FACE)).toBe(1);
  // If every way crosses the face, the nearest still holds it (never none).
  expect(nearestArm([[0, -1.7, 0], [0.2, -1.9, 0]], [0, 1.4, 0], FACE)).toBe(0);
});

test('cups flare as the arm turns, then the bubble is pulled to the tip and lifted', () => {
  const frames = run([[1600, 3]], false, () => 5);
  const first = of(frames[0], 3)!;
  expect(first.arm).toBe(5);
  // The arm turns first; the cups flare as it turns; nothing is pulled until it has.
  const turning = of(at(frames, 120), 3)!;
  expect(turning.turn).toBeGreaterThan(0);
  expect(turning.turn).toBeLessThan(1);
  expect(of(at(frames, HOLD_BEATS.flareMs[0] - 30), 3)!.flare).toBe(0);
  expect(of(at(frames, HOLD_BEATS.flareMs[0] + 60), 3)!.flare).toBeGreaterThan(0);
  expect(of(at(frames, HOLD_BEATS.pullMs[0] - 20), 3)!.pull).toBe(0);
  expect(of(at(frames, HOLD_BEATS.turnMs[1] + 20), 3)!.turn).toBe(1);
  // Mid pull: on its way along the arm, cups open.
  const pulling = of(at(frames, 490), 3)!;
  expect(pulling.pull).toBeGreaterThan(0.2);
  expect(pulling.pull).toBeLessThan(0.8);
  expect(pulling.flare).toBeGreaterThan(0.5);
  expect(pulling.lift).toBe(0);
  // At the tip, then lifted, with follow-through: the lift goes a little past and settles.
  expect(of(at(frames, HOLD_BEATS.pullMs[1] + 20), 3)!.pull).toBe(1);
  const lifts = frames.filter(f => f.t > HOLD_BEATS.liftMs[0] && f.t < HOLD_BEATS.liftMs[1]).map(f => of(f, 3)!.lift);
  expect(Math.max(...lifts)).toBeGreaterThan(1.03);
  expect(Math.max(...lifts)).toBeLessThan(1.2);
  const held = of(frames.at(-1)!, 3)!;
  expect(held).toMatchObject({ turn: 1, pull: 1, lift: 1, release: 0 });
  // Still gripping: the cups stay open while it is held.
  expect(held.flare).toBeGreaterThan(0.3);
  // Every value moves smoothly, frame to frame.
  for (let k = 1; k < frames.length; k++) {
    const a = of(frames[k - 1], 3)!;
    const b = of(frames[k], 3)!;
    for (const key of ['turn', 'flare', 'pull', 'lift'] as const) expect(Math.abs(b[key] - a[key]), `${key} at ${frames[k].t.toFixed(0)} ms`).toBeLessThan(0.16);
  }
});

test('retargets mid-pull and never holds two', () => {
  // Bubble 0 is chosen, then 1 mid-pull, then 0 again while it is still on its way home.
  const frames = run([[450, 0], [700, 1], [2600, 0]]);
  for (const f of frames) expect(f.entries.filter(e => e.release === 0).length, `at ${f.t.toFixed(0)} ms`).toBeLessThanOrEqual(1);
  // The first lets go from where it was, the moment the second is chosen.
  const before = of(at(frames, 450), 0)!;
  const after = of(frames.find(f => f.t > 450)!, 0)!;
  expect(before.pull).toBeGreaterThan(0);
  expect(after.release).toBeGreaterThan(0);
  expect(Math.abs(after.pull - before.pull)).toBeLessThan(0.1);
  expect(of(at(frames, 600), 1)!.release).toBe(0);
  // Chosen again on its way home, it comes back from where it is; the second lets go and is gone.
  expect(of(at(frames, 760), 0)!.release).toBe(0);
  expect(of(at(frames, 760), 1)!.release).toBeGreaterThan(0);
  expect(of(at(frames, 700 + HOLD_BEATS.releaseMs + 40), 1)).toBeUndefined();
  expect(of(at(frames, 2000), 0)).toMatchObject({ turn: 1, pull: 1, lift: 1 });
  // Nothing ever jumps.
  for (let k = 1; k < frames.length; k++) {
    for (const e of frames[k].entries) {
      const prev = of(frames[k - 1], e.bubble);
      if (!prev) continue;
      for (const key of ['turn', 'flare', 'pull', 'lift'] as const) expect(Math.abs(e[key] - prev[key]), `${key} of ${e.bubble} at ${frames[k].t.toFixed(0)} ms`).toBeLessThan(0.16);
    }
  }
  expect(frames.at(-1)!.entries.map(e => e.bubble)).toEqual([0]);
});

test('release returns the bubble to its orbit', () => {
  const frames = run([[1500, 2], [1500 + HOLD_BEATS.releaseMs + 100, null]]);
  const releasing = frames.filter(f => f.t > 1500 && of(f, 2));
  expect(releasing.length).toBeGreaterThan(20);
  for (let k = 1; k < releasing.length; k++) {
    const a = of(releasing[k - 1], 2)!;
    const b = of(releasing[k], 2)!;
    expect(b.pull).toBeLessThanOrEqual(a.pull);
    expect(b.release).toBeGreaterThan(a.release);
  }
  // The arm turns back after the bubble has started home.
  const early = of(at(frames, 1500 + 100), 2)!;
  expect(early.pull).toBeLessThan(early.turn);
  expect(frames.at(-1)!.entries).toEqual([]);
});

test('reduced motion: the bubble moves to the tip without the pull animation', () => {
  const frames = run([[400, 4], [800, null]], true, () => 2);
  const shown = frames.filter(f => f.t <= 400);
  for (const f of shown) expect(of(f, 4)).toMatchObject({ arm: 2, turn: 1, pull: 1, lift: 1, release: 0 });
  // The cups hold as they grip, with no flare animation.
  expect(new Set(shown.map(f => of(f, 4)!.flare)).size).toBe(1);
  // Letting go returns it at once.
  expect(frames.find(f => f.t > 400)!.entries).toEqual([]);
});

test('the pull swings round Nox, not across him: from the orbit to the tip on an arc bowed outward', () => {
  const centre = { x: 0, y: 0.25 };
  const orbit = new THREE.Vector3(0.82, 1.75, -0.4);
  const tip = new THREE.Vector3(1.1, -0.2, -0.6);
  const out = new THREE.Vector3();
  expect(pullPosition(orbit, tip, 0, centre, out).toArray()).toEqual(orbit.toArray());
  expect(pullPosition(orbit, tip, 1, centre, out).distanceTo(tip)).toBeLessThan(1e-9);
  // Half way it is further out from his middle than the straight way, clear of the title's 1.4 half width.
  pullPosition(orbit, tip, 0.5, centre, out);
  expect(out.x).toBeGreaterThan(1.4);
  expect(Math.hypot(out.x - centre.x, out.y - centre.y)).toBeGreaterThan(Math.hypot(0.96 - centre.x, 0.775 - centre.y));
});
