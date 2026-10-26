import { expect, test } from 'vitest';
import { worldTime } from './worldTime';

test('the world runs on the clock', () => {
  expect(worldTime(12.5, { freeze: false })).toBe(12.5);
  expect(worldTime(12.5, { freeze: false, t: 4.8 })).toBe(12.5);
});

test('a frozen world holds one moment: t, or 6', () => {
  expect(worldTime(12.5, { freeze: true })).toBe(6);
  expect(worldTime(12.5, { freeze: true, t: 4.8 })).toBe(4.8);
  expect(worldTime(99, { freeze: true, t: 0 })).toBe(0);
});
