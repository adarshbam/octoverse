import { expect, test } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import { seededRng } from '../motion/micro';
import { Attention, LOOK_POINTER_HOLD } from './attention';

const FACE = { x: 0, y: -0.17 };

/** An Attention that has idled `until` s on the look point (and the stage look `rest`, if any). */
function settled(look: { x: number; y: number }, until = 10, rest?: { x: number; y: number }) {
  const a = new Attention(NOX.personality, seededRng(2));
  let g = a.update(null, 0, 1 / 60, undefined, FACE, rest, look);
  for (let i = 1; i <= until * 60; i++) g = a.update(null, i / 60, 1 / 60, undefined, FACE, rest, look);
  return { a, g };
}

test('the eyes go to the look point, alone: the head holds, nothing counts as followed', () => {
  const { g } = settled({ x: 0.8, y: -0.17 });
  expect(g.gazeX).toBeGreaterThan(0.95);
  expect(g.headX).toBeCloseTo(0, 6);
  expect(g.headY).toBeCloseTo(0, 6);
  expect(g.tracking).toBe(false);
});

test('a pointer move overrides the look point for 1.5 s, then the look point is back', () => {
  expect(LOOK_POINTER_HOLD).toBe(1.5);
  const look = { x: 0.8, y: -0.17 };
  const { a } = settled(look);
  let g = { gazeX: 0, tracking: false };
  const at = (t: number, pointer: { x: number; y: number }) => (g = a.update(pointer, t, 1 / 60, undefined, FACE, undefined, look));
  const away = { x: -0.7, y: -0.17 };
  // The pointer moves at 10 s and then holds still.
  at(10 + 1 / 60, { x: -0.69, y: -0.17 });
  for (let t = 10 + 2 / 60; t < 11.4; t += 1 / 60) at(t, away);
  expect(g.tracking).toBe(true);
  expect(g.gazeX).toBeLessThan(-0.5);
  // Past 1.5 s from the last move it lets go and the eyes return to the look point.
  for (let t = 11.4; t < 11.6; t += 1 / 60) at(t, away);
  expect(g.tracking).toBe(false);
  for (let t = 11.6; t < 15; t += 1 / 60) at(t, away);
  expect(g.gazeX).toBeGreaterThan(0.9);
});

test("without a look point the pointer is followed for the personality's own tracking time", () => {
  const a = new Attention(NOX.personality, seededRng(2));
  a.update({ x: 0.1, y: 0 }, 1, 1 / 60);
  expect(a.update({ x: 0.1, y: 0 }, 1 + NOX.personality.micro.tracking - 0.1, 1 / 60).tracking).toBe(true);
  expect(a.update({ x: 0.1, y: 0 }, 1 + NOX.personality.micro.tracking + 0.1, 1 / 60).tracking).toBe(false);
});

test('priority: a focused orb, then the pointer, then the look point, then the stage look', () => {
  const look = { x: 0.8, y: -0.17 };
  const rest = { x: -0.8, y: -0.17 };
  // The look point beats the stage look.
  expect(settled(look, 10, rest).g.gazeX).toBeGreaterThan(0.9);
  // Without one, the stage look holds.
  expect(settled(rest, 10).g.gazeX).toBeLessThan(-0.9);
  // The pointer beats the look point; the focused orb beats the pointer.
  const a = new Attention(NOX.personality, seededRng(2));
  let g = a.update({ x: 0, y: -0.17 }, 0, 1 / 60, undefined, FACE, rest, look);
  for (let i = 1; i < 60; i++) g = a.update({ x: -0.5 + (i % 2) * 0.01, y: -0.17 }, i / 60, 1 / 60, undefined, FACE, rest, look);
  expect(g.gazeX).toBeLessThan(-0.2);
  for (let i = 60; i < 240; i++) g = a.update({ x: -0.5 + (i % 2) * 0.01, y: -0.17 }, i / 60, 1 / 60, { x: 0.6, y: -0.17 }, FACE, rest, look);
  expect(g.gazeX).toBeGreaterThan(0.9);
  expect(g.tracking).toBe(true);
});
