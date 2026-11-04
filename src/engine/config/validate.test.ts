import { expect, test } from 'vitest';
import { NOX_BUNDLE } from '../../worlds/nox/bundle';
import { NOX } from '../../worlds/nox/character';
import { BundleError, validateBundle } from '../types/bundle';
import type { JellySettings, SuckerStyle } from './types';
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

// Every number the validator clamps, with the value that replaces one that is not a number.
const poison = <T>(value: T, bad: unknown): T => {
  if (typeof value === 'number') return bad as T;
  if (Array.isArray(value)) return value.map(v => poison(v, bad)) as T;
  if (typeof value === 'object' && value !== null) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, poison(v, bad)])) as T;
  return value;
};
const clampedNumbers = (bad: unknown) => ({
  lighting: poison(NOX.lighting, bad),
  glow: {
    ...NOX.glow,
    light: poison(NOX.glow.light, bad),
    underside: bad as number,
    aura: poison(NOX.glow.aura, bad),
    grade: poison(NOX.glow.grade, bad),
  },
  armBend: bad as number,
  armFlatten: bad as number,
  skin: poison(NOX.skin, bad),
  personality: { ...NOX.personality, sway: bad as number, curl: bad as number, float: poison(NOX.personality.float, bad), breathPeriod: bad as number, blinkInterval: [bad, bad] as unknown as [number, number] },
});

test.each([['NaN', Number.NaN], ['Infinity', Number.POSITIVE_INFINITY], ['-Infinity', Number.NEGATIVE_INFINITY], ['a non-numeric string', 'abc'], ['undefined', undefined], ['null', null]])(
  'a config whose every clamped number is %s reads the Nox default for each, and is finite',
  (_name, bad) => {
    const c = clampCharacterConfig({ ...NOX, ...clampedNumbers(bad) } as never);
    // The defaults are Nox's own values (the table in validate.ts is held to the config).
    expect(c.lighting).toEqual(NOX.lighting);
    expect(c.glow).toEqual(NOX.glow);
    expect(c.armBend).toBe(NOX.armBend);
    expect(c.armFlatten).toBe(NOX.armFlatten);
    expect(c.skin).toEqual(NOX.skin);
    expect(c.personality).toEqual(NOX.personality);
    const numbers: number[] = [];
    const walk = (v: unknown) => (typeof v === 'number' ? numbers.push(v) : v && typeof v === 'object' ? Object.values(v).forEach(walk) : undefined);
    walk([c.lighting, c.glow.light, c.glow.aura, c.glow.grade, c.glow.underside, c.skin, c.personality.float, c.personality.blinkInterval]);
    expect(numbers.length).toBeGreaterThan(30);
    for (const n of numbers) expect(Number.isFinite(n)).toBe(true);
  },
);

test('a NaN reaches neither the aura shader\'s below-start nor the point light', () => {
  const nan = Number.NaN;
  const c = clampCharacterConfig({ ...NOX, glow: { ...NOX.glow, aura: { ...NOX.glow.aura, belowStart: nan }, light: { ...NOX.glow.light, intensity: nan, distance: nan, decay: nan } } });
  expect(c.glow.aura.belowStart).toBe(0.75);
  expect(c.glow.light).toEqual({ color: NOX.glow.light.color, intensity: 5, distance: 6, decay: 2 });
  expect(c.glow.aura.belowStart.toFixed(4)).toBe('0.7500');
});

test('a colour string that does not parse reads the Nox default for its field; ones that do pass as given', () => {
  const bad = { ...NOX, lighting: { ...NOX.lighting, key: { ...NOX.lighting.key, color: 'violetish' }, haze: { ...NOX.lighting.haze, color: '#12' } }, glow: { ...NOX.glow, core: 'not a colour', light: { ...NOX.glow.light, color: '' } }, palette: { ...NOX.palette, orbFocus: 12 as unknown as string, effect: { halo: 'rgba(1,2,3,0.5', stroke: '#gggggg', core: '#ffb49c' } } };
  const c = clampCharacterConfig(bad);
  expect(c.glow.core).toBe(NOX.glow.core);
  expect(c.glow.light.color).toBe(NOX.glow.light.color);
  expect(c.palette.orbFocus).toBe(NOX.palette.orbFocus);
  expect(c.palette.effect).toEqual(NOX.palette.effect);
  expect(c.lighting.key.color).toBe(NOX.lighting.key.color);
  expect(c.lighting.haze.color).toBe(NOX.lighting.haze.color);
  const fine = clampCharacterConfig({ ...NOX, glow: { ...NOX.glow, core: '#abc', light: { ...NOX.glow.light, color: 'rgb(10, 20, 30)' } }, palette: { ...NOX.palette, effect: { halo: 'rgba(10,20,30,0.25)', stroke: 'hsl(120, 50%, 50%)', core: '#A1B2C3' } } });
  expect(fine.glow.core).toBe('#abc');
  expect(fine.glow.light.color).toBe('rgb(10, 20, 30)');
  expect(fine.palette.effect).toEqual({ halo: 'rgba(10,20,30,0.25)', stroke: 'hsl(120, 50%, 50%)', core: '#A1B2C3' });
  // What three's Color.set reads, and only that: CSS names pass; spellings three would draw black do not.
  const named = clampCharacterConfig({ ...NOX, glow: { ...NOX.glow, core: 'violet' }, palette: { ...NOX.palette, orbFocus: 'Teal' } });
  expect([named.glow.core, named.palette.orbFocus]).toEqual(['violet', 'Teal']);
  for (const spelling of ['#ff4a3080', 'rgb(255 0 0)', 'rgb(1.5, 2, 3)', 'hsl(350deg, 90%, 50%)', 'oklch(0.6 0.2 20)', 'color(srgb-linear 0.1 0.2 0.3)']) {
    expect(clampCharacterConfig({ ...NOX, glow: { ...NOX.glow, core: spelling } }).glow.core, spelling).toBe(NOX.glow.core);
  }
});

test('the light direction is copied, and a bad one reads the default', () => {
  const c = clampCharacterConfig(NOX);
  expect(c.lighting.key.direction).toEqual(NOX.lighting.key.direction);
  expect(c.lighting.key.direction).not.toBe(NOX.lighting.key.direction);
  const bad = clampCharacterConfig({ ...NOX, lighting: { ...NOX.lighting, key: { ...NOX.lighting.key, direction: [Number.NaN, 1, 0] } } });
  expect(bad.lighting.key.direction).toEqual(NOX.lighting.key.direction);
});

test('an expression override keeps only the keys the face has', () => {
  const c = clampCharacterConfig({
    ...NOX,
    expressions: { curious: { browLift: 0.5, nonsense: 3, puff: 0.5, mouthRound: 2, blush: Number.NaN } as never, gentle: { __proto__: null, lidRest: 0.1, extra: 1 } as never },
  });
  expect(c.expressions).toEqual({ curious: { browLift: 0.5, puff: 0.5, mouthRound: 1 }, gentle: { lidRest: 0.1 } });
  expect(Object.keys(c.expressions!.curious!)).not.toContain('nonsense');
});

const JELLY: JellySettings = { rim: '#62eaff', rimPower: 3, crown: '#14b0cc', crownHeight: 0.5, depth: '#015f67', depthStrength: 0.6, core: '#f0eca0', coreCenter: [0, 0.1, -0.3], coreWarmth: 0.8 };
const surfaces = (mantle: unknown, arms: unknown) => clampCharacterConfig({ ...NOX, skin: { ...NOX.skin, surfaces: { mantle, arms } as never } }).skin.surfaces!;

test('Nox has no surfaces and the clamp adds none (absent is skin on both, no sparkle)', () => {
  expect(NOX.skin.surfaces).toBeUndefined();
  expect(clampCharacterConfig(NOX).skin).not.toHaveProperty('surfaces');
});

test('each surface keeps its sparkle in [0, 400] and its mode in the closed table (default skin)', () => {
  const s = surfaces({ mode: 'jelly', jelly: JELLY, sparkle: 900 }, { mode: 'glass', sparkle: -5 });
  expect(s.mantle.sparkle).toBe(400);
  expect(s.mantle.mode).toBe('jelly');
  expect(s.arms.sparkle).toBe(0);
  expect(s.arms.mode).toBe('skin');
  expect(surfaces({ sparkle: Number.NaN }, { mode: 'skin', sparkle: 12 }).mantle).toEqual({ mode: 'skin', sparkle: 0 });
  expect(surfaces({ mode: 'skin', sparkle: 12 }, { mode: 'jelly', jelly: JELLY, sparkle: 30 }).arms).toEqual({ mode: 'jelly', jelly: JELLY, sparkle: 30 });
});

test('jelly settings are clamped, and a missing or unreadable colour reads the character’s own palette (no colour in the engine)', () => {
  const wild = { ...JELLY, rim: 'not a colour', rimPower: 99, crownHeight: -1, depthStrength: 4, coreWarmth: Number.NaN, coreCenter: [Number.NaN, 0, 9] };
  const j = surfaces({ mode: 'jelly', jelly: wild, sparkle: 50 }, { mode: 'skin', sparkle: 0 }).mantle.jelly!;
  expect(j.rim).toBe(NOX.palette.rimTop);
  expect(j.rimPower).toBe(8);
  expect(j.crownHeight).toBe(0);
  expect(j.depthStrength).toBe(1);
  expect(j.coreWarmth).toBe(1);
  expect(j.coreCenter).toEqual([0, 0, 2]);
  const fallback = surfaces({ mode: 'jelly', sparkle: 0 }, { mode: 'skin', sparkle: 0 }).mantle.jelly!;
  expect([fallback.rim, fallback.crown, fallback.depth, fallback.core]).toEqual([NOX.palette.rimTop, NOX.palette.headEdge, NOX.palette.blotch, NOX.glow.core]);
  // A skin surface carries no jelly.
  expect(surfaces({ mode: 'skin', jelly: JELLY, sparkle: 0 }, { mode: 'skin', sparkle: 0 }).mantle).toEqual({ mode: 'skin', sparkle: 0 });
});

test('validateBundle names a surface mode the engine has not got, and a jelly colour that does not parse', () => {
  const withSurfaces = (mantle: unknown) => ({ ...NOX_BUNDLE, character: { ...NOX_BUNDLE.character, skin: { ...NOX_BUNDLE.character.skin, surfaces: { mantle, arms: { mode: 'skin', sparkle: 0 } } as never } } });
  const field = (bundle: typeof NOX_BUNDLE) => {
    try {
      validateBundle(bundle);
    } catch (error) {
      if (error instanceof BundleError) return error.field;
      throw error;
    }
    return null;
  };
  expect(field(withSurfaces({ mode: 'glass', sparkle: 0 }))).toBe('character.skin.surfaces.mantle.mode');
  expect(field(withSurfaces({ mode: 'jelly', jelly: { ...JELLY, crown: 'bluish' }, sparkle: 0 }))).toBe('character.skin.surfaces.mantle.jelly.crown');
  expect(field(withSurfaces({ mode: 'jelly', jelly: JELLY, sparkle: 60 }))).toBeNull();
});

const FRILL: SuckerStyle = { rimWidth: 0.22, scallop: 0.6, edge: '#e0dc9c', rim: '#f6f0ba', hollow: '#6a9478', glow: 1.3 };
const suckerStyle = (style: unknown) => clampCharacterConfig({ ...NOX, suckers: { ...NOX.suckers, style: style as SuckerStyle } }).suckers.style!;

test('Nox has no cup style and the clamp adds none (absent is the sunk discs)', () => {
  expect(NOX.suckers.style).toBeUndefined();
  expect(clampCharacterConfig(NOX).suckers).not.toHaveProperty('style');
  expect(clampCharacterConfig(NOX).suckers).toEqual(NOX.suckers);
});

test('a cup frill style is clamped, and a missing or unreadable colour reads the character’s own cup colours', () => {
  expect(suckerStyle(FRILL)).toEqual(FRILL);
  const s = suckerStyle({ ...FRILL, rimWidth: 2, scallop: -1, glow: Number.NaN, rim: 'not a colour', edge: undefined });
  expect(s.rimWidth).toBe(0.5);
  expect(s.scallop).toBe(0);
  expect(s.glow).toBe(1);
  expect([s.edge, s.rim, s.hollow]).toEqual([NOX.palette.suckerEdge, NOX.palette.suckerHot, FRILL.hollow]);
});

test('validateBundle names a cup style colour that does not parse', () => {
  const bundle = { ...NOX_BUNDLE, character: { ...NOX_BUNDLE.character, suckers: { ...NOX_BUNDLE.character.suckers, style: { ...FRILL, hollow: 'greenish' } } } };
  try {
    validateBundle(bundle);
    expect.unreachable('validateBundle took an unreadable cup colour');
  } catch (error) {
    expect(error).toBeInstanceOf(BundleError);
    expect((error as BundleError).field).toBe('character.suckers.style.hollow');
  }
  expect(() => validateBundle({ ...NOX_BUNDLE, character: { ...NOX_BUNDLE.character, suckers: { ...NOX_BUNDLE.character.suckers, style: FRILL } } })).not.toThrow();
});
