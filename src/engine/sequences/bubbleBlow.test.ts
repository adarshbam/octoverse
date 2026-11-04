import * as THREE from 'three';
import { beforeAll, expect, test } from 'vitest';
import { NOX } from '../../nox3d/config/nox.character';
import { BLOW_SHEET_WAIT, BLOW_STAGGER, type BlowFrame, BlowRun, blowFrame, blowLength, blowMouth, blowPosition, bubblesExist } from './bubbleBlow';
import { SEQUENCE_DEFAULTS } from '../../nox3d/sequences/defaults';
import { loadNoxSequences } from '../../nox3d/sequences/nox.sequences';
import type { Sequences } from './theatre';

let seq: Sequences;
beforeAll(async () => {
  seq = await loadNoxSequences();
});
const at = (i: number, s: number) => blowFrame(seq, i, s);
const COUNT = 15;
/** One bubble's blow, as Nox's loaded sheet has it. */
const LENGTH = () => seq.length('bubbleBlow');
const BLOW_MOUTH = blowMouth(NOX.head, NOX.face);

test('the mouth is worked out from the head and face: Nox\'s is where the module constant put it', () => {
  // Hard-coded from the module constant BLOW_MOUTH this function replaced (Task 5).
  expect(BLOW_MOUTH[0]).toBeCloseTo(0.058, 12);
  expect(BLOW_MOUTH[1]).toBeCloseTo(-0.84, 12);
  expect(BLOW_MOUTH[2]).toBeCloseTo(0.5397649575610644, 12);
  // Another head and mouth moves it with them.
  const moved = blowMouth({ ...NOX.head, faceOrigin: [0.5, NOX.head.faceOrigin[1] + 0.1] }, NOX.face);
  expect(moved[0]).toBeCloseTo(BLOW_MOUTH[0] + 0.5 - NOX.head.faceOrigin[0], 12);
  expect(moved[1]).toBeCloseTo(BLOW_MOUTH[1] + 0.1, 12);
});

test('no bubble exists before the entrance settles', () => {
  // The bubbles belong to the intro, the overview and a technology focus: never the entrance.
  expect(bubblesExist('entering')).toBe(false);
  expect(bubblesExist('detail')).toBe(false);
  for (const stage of ['intro', 'overview', 'techFocus'] as const) expect(bubblesExist(stage)).toBe(true);

  // Through the whole entrance, sheet loaded, the blow never starts: no bubble has any size.
  const run = new BlowRun();
  for (let i = 0; i < 160; i++) run.step({ exist: bubblesExist('entering'), still: false, ready: true, dt: 0.05, count: COUNT, length: LENGTH() });
  expect(run.seconds).toBeNull();
  expect(run.done).toBe(false);
  expect(run.blowing).toBe(false);
  // Settled into the intro, the blow starts from its first moment: every bubble still in the mouth.
  run.step({ exist: bubblesExist('intro'), still: false, ready: true, dt: 0.05, count: COUNT, length: LENGTH() });
  expect(run.seconds).toBe(0);
  expect(run.blowing).toBe(true);
  for (let i = 0; i < COUNT; i++) expect(at(i, run.seconds!).scale).toBe(0);
  // It runs on frame time and ends when the last bubble is full size.
  let steps = 0;
  while (!run.done && steps++ < 1000) run.step({ exist: true, still: false, ready: true, dt: 0.05, count: COUNT, length: LENGTH() });
  expect(steps * 0.05).toBeCloseTo(blowLength(COUNT, LENGTH()), 1);
  expect(run.blowing).toBe(false);
});

test('motion off (reduced motion, ?freeze): the bubbles are simply there, with no blow and no puff', () => {
  const run = new BlowRun();
  run.step({ exist: false, still: true, ready: true, dt: 0.05, count: COUNT, length: LENGTH() });
  expect(run.done).toBe(false);
  run.step({ exist: true, still: true, ready: true, dt: 0.05, count: COUNT, length: LENGTH() });
  expect(run.done).toBe(true);
  expect(run.blowing).toBe(false);
  // Motion turned off mid-blow ends it at once.
  const mid = new BlowRun();
  mid.step({ exist: true, still: false, ready: true, dt: 0.05, count: COUNT, length: LENGTH() });
  mid.step({ exist: true, still: false, ready: true, dt: 0.05, count: COUNT, length: LENGTH() });
  mid.step({ exist: true, still: true, ready: true, dt: 0.05, count: COUNT, length: LENGTH() });
  expect(mid.done).toBe(true);
});

test('a still of the blow (`at`) holds that moment; a sheet that never comes gives way to the plain fade', () => {
  const still = new BlowRun();
  for (let i = 0; i < 5; i++) still.step({ exist: true, still: true, ready: true, dt: 0.05, count: COUNT, length: LENGTH(), at: 0.6 });
  expect(still.seconds).toBe(0.6);
  expect(still.blowing).toBe(true);
  const late = new BlowRun();
  let steps = 0;
  while (!late.done && steps++ < 1000) late.step({ exist: true, still: false, ready: false, dt: 0.05, count: COUNT, length: LENGTH() });
  expect(late.seconds).toBeNull();
  expect(steps * 0.05).toBeCloseTo(BLOW_SHEET_WAIT, 1);
  // One that failed gives way at once.
  const failed = new BlowRun();
  failed.step({ exist: true, still: false, ready: false, failed: true, dt: 0.05, count: COUNT, length: LENGTH() });
  expect(failed.done).toBe(true);
});

test('each bubble emerges from the mouth and grows with a wobble to full size', () => {
  // Puff 0 to 0.25 s: the cheeks fill and the mouth rounds; no bubble yet.
  expect(at(0, 0)).toEqual({ puff: 0, mouthRound: 0, emerged: 0, scale: 0, wobble: 0 });
  for (const s of [0.05, 0.1, 0.2]) {
    const f = at(0, s);
    expect(f.scale).toBe(0);
    expect(f.emerged).toBe(0);
    expect(f.puff).toBeGreaterThan(0);
  }
  expect(at(0, 0.1).puff).toBeLessThan(at(0, 0.2).puff);
  expect(at(0, 0.15).mouthRound).toBeCloseTo(1, 6);
  expect(at(0, 0.25).puff).toBeCloseTo(1, 6);
  // Pop 0.25 to 0.33 s: the cheeks empty and the bubble pops out, already a good size.
  expect(at(0, 0.25).scale).toBeCloseTo(0, 6);
  expect(at(0, 0.29).scale).toBeGreaterThan(0.15);
  expect(at(0, 0.33).puff).toBeCloseTo(0, 6);
  expect(at(0, 0.33).scale).toBeGreaterThan(0.35);
  expect(at(0, 0.33).scale).toBeLessThan(0.6);
  // Wobble-grow 0.33 to 0.9 s: the size only grows, the wobble swings both ways and dies away.
  const grow = Array.from({ length: 58 }, (_, k) => at(0, 0.33 + k * 0.01));
  for (let k = 1; k < grow.length; k++) expect(grow[k].scale).toBeGreaterThanOrEqual(grow[k - 1].scale - 1e-9);
  const swings = grow.map(f => f.wobble);
  const signs = swings.filter(w => Math.abs(w) > 0.01).map(Math.sign);
  const flips = signs.filter((s, k) => k > 0 && s !== signs[k - 1]).length;
  expect(flips).toBeGreaterThanOrEqual(3);
  const peak = (from: number, to: number) => Math.max(...swings.slice(from, to).map(Math.abs));
  expect(peak(0, 20)).toBeGreaterThan(peak(38, 58));
  expect(peak(0, 58)).toBeLessThan(0.25);
  // It leaves the mouth as it pops and arrives at its orbit by the end.
  expect(at(0, 0.33).emerged).toBeLessThan(0.1);
  expect(at(0, 0.6).emerged).toBeGreaterThan(0.5);
  // From 0.9 s it is full size on its orbit, still, and the face is back to normal.
  const done: BlowFrame = { puff: 0, mouthRound: 0, emerged: 1, scale: 1, wobble: 0 };
  for (const s of [0.9, 1.5, 99]) {
    const f = at(0, s);
    for (const key of Object.keys(done) as (keyof BlowFrame)[]) expect(f[key], `${key} at ${s}`).toBeCloseTo(done[key], 6);
  }
});

test('the path runs from the mouth to the orbit, round the front of the head', () => {
  const orbit = new THREE.Vector3(0, 1.8, -0.5);
  const out = new THREE.Vector3();
  expect(blowPosition(BLOW_MOUTH, orbit, 0, out).toArray()).toEqual([...BLOW_MOUTH]);
  expect(blowPosition(BLOW_MOUTH, orbit, 1, out).distanceTo(orbit)).toBeLessThan(1e-9);
  // Even to a place behind the head it never passes through it: in front of the face all the way up.
  for (let k = 1; k < 20; k++) {
    const p = blowPosition(BLOW_MOUTH, orbit, k / 20, out);
    if (p.y < 0.3) expect(p.z).toBeGreaterThan(BLOW_MOUTH[2]);
  }
  // The mouth is on the front of the face, below its middle.
  expect(BLOW_MOUTH[1]).toBeLessThan(-0.7);
  expect(BLOW_MOUTH[2]).toBeGreaterThan(0.4);
});

test('bubbles are blown in order, 0.18 s apart', () => {
  expect(BLOW_STAGGER).toBe(0.18);
  expect(SEQUENCE_DEFAULTS.bubbleBlow.length).toBeCloseTo(0.9, 9);
  expect(blowLength(COUNT, LENGTH())).toBeCloseTo(14 * 0.18 + 0.9, 9);
  for (const i of [1, 4, 14]) {
    for (const s of [0.1, 0.3, 0.6, 1.2, 2.5, 3.3]) {
      const own = at(i, s);
      const first = at(0, s - i * BLOW_STAGGER);
      for (const key of Object.keys(own) as (keyof BlowFrame)[]) expect(own[key], `${i} ${key} at ${s}`).toBeCloseTo(first[key], 6);
    }
  }
  // Each pops 0.18 s after the one before it.
  const pops = Array.from({ length: COUNT }, (_, i) => {
    let s = 0;
    while (at(i, s).scale === 0) s += 0.002;
    return s;
  });
  pops.forEach((s, i) => expect(s).toBeCloseTo(0.25 + i * 0.18, 2));
  // Every bubble is full size once the blow is over.
  for (let i = 0; i < COUNT; i++) expect(at(i, blowLength(COUNT, LENGTH())).scale).toBeCloseTo(1, 6);
});

test("a step must say how long one blow is: leaving it out is a type error (a run without it never ended)", () => {
  const run = new BlowRun();
  // @ts-expect-error `length` is required
  const step: Parameters<BlowRun['step']>[0] = { exist: true, still: false, ready: true, dt: 0.05, count: COUNT };
  run.step({ ...step, length: LENGTH() });
  let steps = 0;
  while (!run.done && steps++ < 1000) run.step({ ...step, length: LENGTH() });
  expect(run.done).toBe(true);
});
