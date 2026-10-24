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

test('clamps skin detail into safe ranges', () => {
  const wild = { ...NOX, skin: { ...NOX.skin, speckDensity: 3, blotchDensity: -1, speckSize: [0.5, 0.1] as [number, number], wetness: 9, translucency: -2 } };
  const s = clampCharacterConfig(wild).skin;
  expect(s.speckDensity).toBe(1);
  expect(s.blotchDensity).toBe(0);
  expect(s.speckSize[0]).toBeLessThanOrEqual(s.speckSize[1]);
  expect(s.speckSize[1]).toBeLessThanOrEqual(0.45);
  expect(s.wetness).toBe(2);
  expect(s.translucency).toBe(0);
});

test('clamps the arm rest bend into a gentle range', () => {
  expect(clampCharacterConfig({ ...NOX, armBend: 2 }).armBend).toBe(0.3);
  expect(clampCharacterConfig({ ...NOX, armBend: -1 }).armBend).toBe(0);
});

test('keeps the flattened sucker side between a gentle oval and a round arm', () => {
  expect(clampCharacterConfig({ ...NOX, armFlatten: 0.2 }).armFlatten).toBe(0.7);
  expect(clampCharacterConfig({ ...NOX, armFlatten: 1.4 }).armFlatten).toBe(1);
  expect(clampCharacterConfig(NOX).armFlatten).toBe(NOX.armFlatten);
});
