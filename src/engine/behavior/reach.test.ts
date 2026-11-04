import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { NOX } from '../../nox3d/config/nox.character';
import { REACH_RANGE, bubbleHotFor, reachesForPointer, reachingArm } from './reach';

const head = NOX.head;
const tips = [{ x: -1.8, y: -0.6 }, { x: -1.2, y: -1.6 }, { x: 1.9, y: -0.7 }];

test('the arm whose tip is nearest the pointer reaches for it', () => {
  expect(reachingArm(tips, { x: -2.1, y: -0.5 }, head)).toBe(0);
  expect(reachingArm(tips, { x: 2.2, y: -0.8 }, head)).toBe(2);
});

test('no arm reaches for a pointer out of range', () => {
  expect(reachingArm(tips, { x: 0, y: 2.5 }, head)).toBe(-1);
});

test('no arm reaches into the head: hovering the face only makes Nox smile', () => {
  const nearHead = [{ x: -0.95, y: -0.5 }];
  expect(reachingArm(nearHead, { x: head.centerX - 0.6, y: -0.5 }, head)).toBe(-1);
  expect(reachingArm(nearHead, { x: head.centerX, y: (head.top + head.bottom) / 2 }, head)).toBe(-1);
});

test('an arm reaches for the pointer only in the intro: not while the orbs are out, nor beside the detail panel', () => {
  expect(reachesForPointer('intro', 0, true, false)).toBe(true);
  expect(reachesForPointer('intro', 0, false, false)).toBe(false);
  expect(reachesForPointer('intro', 0.6, true, false)).toBe(false);
  expect(reachesForPointer('detail', 0, true, false)).toBe(false);
  expect(reachesForPointer('entering', 0, true, false)).toBe(false);
});

test('pointer reach pauses while a bubble is hot', () => {
  expect(reachesForPointer('intro', 0, true, true)).toBe(false);
  expect(reachesForPointer('intro', 0, true, false)).toBe(true);
});

test('an unbounded range reaches the nearest arm for a target far outside the default range, still never into the head', () => {
  const far = { x: -6, y: -1 };
  expect(reachingArm(tips, far, head)).toBe(-1);
  expect(reachingArm(tips, far, head, Infinity)).toBe(0);
  expect(reachingArm(tips, { x: 7, y: -2 }, head, Infinity)).toBe(2);
  expect(reachingArm([{ x: -0.95, y: -0.5 }], { x: head.centerX, y: (head.top + head.bottom) / 2 }, head, Infinity)).toBe(-1);
  // The default range is unchanged.
  expect(REACH_RANGE).toBe(0.8);
  expect(reachingArm(tips, { x: -2.1, y: -0.5 }, head, REACH_RANGE)).toBe(0);
});

test("a forced reach (the host's attend) lifts the stage and tracking gates, but not a hot bubble", () => {
  expect(reachesForPointer('overview', 1, true, false, true)).toBe(true);
  expect(reachesForPointer('overview', 1, true, true, true)).toBe(false);
  expect(reachesForPointer('detail', 1, false, false, true)).toBe(true);
  // Not forced: today's rule.
  expect(reachesForPointer('overview', 1, true, false)).toBe(false);
  expect(reachesForPointer('overview', 1, true, false, false)).toBe(false);
});

test('a focused technology holds the arms for a forced reach (the suction hold runs), and changes nothing for the pointer own reach', () => {
  expect(bubbleHotFor(false, true, true)).toBe(true);
  expect(bubbleHotFor(true, false, true)).toBe(true);
  expect(bubbleHotFor(false, false, true)).toBe(false);
  // Not forced: only the hover counts, as before.
  expect(bubbleHotFor(false, true, false)).toBe(false);
  expect(reachesForPointer('overview', 1, true, bubbleHotFor(false, true, true), true)).toBe(false);
  expect(reachesForPointer('overview', 1, true, bubbleHotFor(false, false, true), true)).toBe(true);
  const octopus = readFileSync(new URL('../character/Octopus.tsx', import.meta.url), 'utf8');
  expect(octopus).toMatch(/bubbleHotFor\(instance\.hover\.bubble, selected >= 0, attendReach\)/);
});

