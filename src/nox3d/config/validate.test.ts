import { expect, test } from 'vitest';
import { NOX } from './nox.character';
import { clampCharacterConfig } from './validate';

test('NOX is unchanged by clamping', () => {
  expect(clampCharacterConfig(NOX)).toEqual(NOX);
});

test('clamps personality into safe ranges', () => {
  const wild = { ...NOX, personality: { ...NOX.personality, sway: 5, float: { amplitude: 1, period: 1 }, breathPeriod: 0.5 } };
  const c = clampCharacterConfig(wild);
  expect(c.personality.sway).toBe(1);
  expect(c.personality.float).toEqual({ amplitude: 0.08, period: 4 });
  expect(c.personality.breathPeriod).toBe(3);
});

test('rejects anything but exactly eight arms T1..T8', () => {
  expect(() => clampCharacterConfig({ ...NOX, arms: NOX.arms.slice(0, 7) })).toThrow(/eight arms/);
});
