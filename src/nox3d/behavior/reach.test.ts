import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { reachesForPointer, reachingArm } from './reach';

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
  expect(reachesForPointer('intro', 0, true)).toBe(true);
  expect(reachesForPointer('intro', 0, false)).toBe(false);
  expect(reachesForPointer('intro', 0.6, true)).toBe(false);
  expect(reachesForPointer('detail', 0, true)).toBe(false);
  expect(reachesForPointer('entering', 0, true)).toBe(false);
});
