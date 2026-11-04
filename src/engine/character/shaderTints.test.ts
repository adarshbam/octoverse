import { expect, test } from 'vitest';
import { NOX_BUNDLE } from '../../worlds/nox/bundle';
import { NOX } from '../../worlds/nox/character';
import { createOrbMaterial } from '../artifacts/orbMaterial';
import { dummyCharacter } from '../config/fixtures/dummy.character';
import { type LegacyCharacterConfig, clampCharacterConfig } from '../config/validate';
import { BundleError, validateBundle } from '../types/bundle';
import { createDomeMaterial } from './domeMaterial';
import { createSkinMaterial, createSkinUniforms } from './skinMaterial';
import { createSuckerMaterial } from './suckerMaterial';

// The tints the character's shaders compiled in as literals (fix wave A) are palette fields now:
// Nox's GLSL is the text it was, word for word, and another character's tints reach the shaders.

const DUMMY = dummyCharacter(NOX);
const skin = (config: typeof NOX, kind: 'HEAD' | 'ARM') => createSkinMaterial(kind, createSkinUniforms(config), config.palette.rimHot).fragmentShader;

test("Nox's shaders hold the very lines they held before the tints were data", () => {
  expect(skin(NOX, 'ARM')).toContain('col += mix(rim, vec3(1.0, 0.85, 1.0), 0.3) * pow(1.0 - ndv, 14.0) * 1.6 * rimFade;');
  expect(skin(NOX, 'HEAD')).toContain('col += mix(rim, vec3(1.0, 0.85, 1.0), 0.6) * pow(1.0 - ndv, 16.0) * 1.6 * belowChin;');
  expect(createDomeMaterial(NOX.palette, NOX.dome).fragmentShader).toContain('col += mix(uRim, vec3(1.0, 0.85, 0.95), 0.35) * front * 1.8;');
  expect(createSuckerMaterial(NOX.palette, createSkinUniforms(NOX)).fragmentShader).toContain('c += uKeyLight * vec3(1.0, 0.9, 0.84) * spec * 0.5 * rim;');
  const orb = createOrbMaterial('#ff0000', NOX.palette.orbFocus, NOX.palette.orbGlass).fragmentShader;
  expect(orb).toContain('vec3 env = mix(vec3(1.0, 0.42, 0.12), vec3(0.62, 0.36, 1.0), smoothstep(-0.55, 0.55, N.y));');
  expect(orb).toContain('env = mix(env, vec3(0.25, 0.55, 1.0), smoothstep(0.25, 0.9, -N.x) * smoothstep(0.6, -0.2, N.y) * 0.7);');
  expect(orb).toContain('vec3 col = uTint * 0.006 + vec3(0.002, 0.0015, 0.004) + env * ring');
});

test("another character's tints reach the skin, dome, cups and orbs, and Nox's are gone from them", () => {
  for (const kind of ['HEAD', 'ARM'] as const) {
    expect(skin(DUMMY, kind)).toContain('mix(rim, vec3(0.85, 1.0, 0.95)');
    expect(skin(DUMMY, kind)).not.toContain('vec3(1.0, 0.85, 1.0)');
  }
  expect(createDomeMaterial(DUMMY.palette, DUMMY.dome).fragmentShader).not.toContain('vec3(1.0, 0.85, 0.95)');
  expect(createSuckerMaterial(DUMMY.palette, createSkinUniforms(DUMMY)).fragmentShader).not.toContain('vec3(1.0, 0.9, 0.84)');
  const orb = createOrbMaterial('#00ff88', DUMMY.palette.orbFocus, DUMMY.palette.orbGlass).fragmentShader;
  for (const nox of ['vec3(1.0, 0.42, 0.12)', 'vec3(0.62, 0.36, 1.0)', 'vec3(0.25, 0.55, 1.0)', 'vec3(0.002, 0.0015, 0.004)']) expect(orb).not.toContain(nox);
});

test("a legacy config without the tints reads Nox's, and the legacy defaults equal Nox's config", () => {
  const { rimHot: _r, domeRimHot: _d, suckerSpecular: _s, orbGlass: _o, ...palette } = NOX.palette;
  const legacy: LegacyCharacterConfig = { ...NOX, palette };
  const read = clampCharacterConfig(legacy).palette;
  expect([read.rimHot, read.domeRimHot, read.suckerSpecular, read.orbGlass]).toEqual([NOX.palette.rimHot, NOX.palette.domeRimHot, NOX.palette.suckerSpecular, NOX.palette.orbGlass]);
  // A tint that is not a colour reads the default quietly in the clamp ...
  expect(clampCharacterConfig({ ...NOX, palette: { ...NOX.palette, rimHot: 'hot pink' } }).palette.rimHot).toBe(NOX.palette.rimHot);
  // ... and a linear one stands as written.
  expect(clampCharacterConfig({ ...NOX, palette: { ...NOX.palette, rimHot: 'color(srgb-linear 0.5 1 0.9)' } }).palette.rimHot).toBe('color(srgb-linear 0.5 1 0.9)');
});

test('validateBundle names a tint that is not a colour, and takes a linear one', () => {
  const withPalette = (change: Record<string, unknown>) => ({ ...NOX_BUNDLE, character: { ...NOX_BUNDLE.character, palette: { ...NOX_BUNDLE.character.palette, ...change } } });
  const field = (bundle: typeof NOX_BUNDLE) => {
    try {
      validateBundle(bundle);
    } catch (error) {
      if (error instanceof BundleError) return error.field;
      throw error;
    }
    return null;
  };
  expect(field(withPalette({ rimHot: 'pinkish' }))).toBe('character.palette.rimHot');
  expect(field(withPalette({ suckerSpecular: 'color(srgb-linear 1 0.9)' }))).toBe('character.palette.suckerSpecular');
  expect(field(withPalette({ orbGlass: { ...NOX.palette.orbGlass, side: 'blue-ish' } }))).toBe('character.palette.orbGlass.side');
  expect(field(withPalette({ domeRimHot: 'color(srgb-linear 0.2 1 0.8)' }))).toBeNull();
});
