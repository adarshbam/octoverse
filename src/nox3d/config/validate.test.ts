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

test('the config validator clamps aura and grade strengths to 0..1', () => {
  const glow = (aura: number, grade: number) => ({ ...NOX.glow, aura: { ...NOX.glow.aura, strength: aura }, grade: { ...NOX.glow.grade, strength: grade } });
  const high = clampCharacterConfig({ ...NOX, glow: glow(3, 2) }).glow;
  expect(high.aura.strength).toBe(1);
  expect(high.grade.strength).toBe(1);
  const low = clampCharacterConfig({ ...NOX, glow: glow(-1, -0.5) }).glow;
  expect(low.aura.strength).toBe(0);
  expect(low.grade.strength).toBe(0);
  expect(clampCharacterConfig(NOX).glow).toEqual(NOX.glow);
});

test('keeps the aura and grade radii positive and within the stage', () => {
  const wild = { ...NOX, glow: { ...NOX.glow, aura: { ...NOX.glow.aura, radius: -2 }, grade: { ...NOX.glow.grade, radius: 50 } } };
  const g = clampCharacterConfig(wild).glow;
  expect(g.aura.radius).toBeGreaterThan(0);
  expect(g.grade.radius).toBeLessThanOrEqual(8);
});

test('keeps the underside band strength within 0..2', () => {
  const band = (underside: number) => clampCharacterConfig({ ...NOX, glow: { ...NOX.glow, underside } }).glow.underside;
  expect(band(5)).toBe(2);
  expect(band(-1)).toBe(0);
  expect(band(0.95)).toBe(0.95);
});

test('a legacy config with none of the Task 4 fields validates and reads the Nox defaults', () => {
  const { lighting: _lighting, ...rest } = NOX;
  const { core: _core, light: _light, aura, ...glow } = NOX.glow;
  const { belowStart: _belowStart, ...legacyAura } = aura;
  const { orbFocus: _orbFocus, effect: _effect, ...palette } = NOX.palette;
  const legacy = { ...rest, glow: { ...glow, aura: legacyAura }, palette };
  expect(legacy).not.toHaveProperty('lighting');
  expect(legacy.glow).not.toHaveProperty('core');
  expect(legacy.glow).not.toHaveProperty('light');
  expect(legacy.glow.aura).not.toHaveProperty('belowStart');
  expect(legacy.palette).not.toHaveProperty('orbFocus');
  expect(legacy.palette).not.toHaveProperty('effect');
  const read = clampCharacterConfig(legacy);
  expect(read).toEqual(clampCharacterConfig(NOX));
  expect(read).toEqual(NOX);
});

test('clamps the new glow, lighting and expression fields into safe ranges', () => {
  const wild = {
    ...NOX,
    lighting: { ...NOX.lighting, key: { ...NOX.lighting.key, intensity: 50, wrap: 3 } },
    glow: { ...NOX.glow, light: { ...NOX.glow.light, intensity: 500, distance: 0, decay: 9 }, aura: { ...NOX.glow.aura, belowStart: -3 } },
    expressions: { curious: { browLift: 7, puff: -2 } },
  };
  const c = clampCharacterConfig(wild);
  expect(c.lighting.key.intensity).toBe(4);
  expect(c.lighting.key.wrap).toBe(1);
  expect(c.glow.light).toEqual({ ...NOX.glow.light, intensity: 20, distance: 0.5, decay: 4 });
  expect(c.glow.aura.belowStart).toBe(0.05);
  expect(c.expressions).toEqual({ curious: { browLift: 1, puff: 0 } });
  // The colours pass through as given.
  expect(c.glow.core).toBe(NOX.glow.core);
  expect(c.palette.effect).toEqual(NOX.palette.effect);
});
