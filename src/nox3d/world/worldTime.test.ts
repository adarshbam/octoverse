import { expect, test } from 'vitest';
import { ambientTime, worldTime } from './worldTime';

test('the world runs on the clock', () => {
  expect(worldTime(12.5, { freeze: false })).toBe(12.5);
  expect(worldTime(12.5, { freeze: false, t: 4.8 })).toBe(12.5);
});

test('a frozen world holds one moment: t, or 6', () => {
  expect(worldTime(12.5, { freeze: true })).toBe(6);
  expect(worldTime(12.5, { freeze: true, t: 4.8 })).toBe(4.8);
  expect(worldTime(99, { freeze: true, t: 0 })).toBe(0);
});

test('ambient bubbles drift on the world clock, and hold one moment with reduced motion', () => {
  expect(ambientTime(12.5, { freeze: false }, false)).toBe(12.5);
  expect(ambientTime(12.5, { freeze: true, t: 3 }, false)).toBe(3);
  expect(ambientTime(12.5, { freeze: false }, true)).toBe(6);
  expect(ambientTime(99, { freeze: false, t: 2 }, true)).toBe(2);
});
