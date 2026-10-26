import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { createSkinMaterial, createSkinUniforms } from './skinMaterial';
import { ACCENT_GLSL, createAccentUniforms } from './worldAccent';

test('socket shading reads the eye centres and radii from the face layout', () => {
  const u = createSkinUniforms(NOX);
  const [[lx, ly], [rx, ry]] = NOX.face.eye.centers;
  expect(u.uEyeCenters.value.toArray()).toEqual([lx, ly, rx, ry]);
  expect(u.uEyeRadii.value.toArray()).toEqual([NOX.face.eye.rx, NOX.face.eye.ry]);
});

test('skin detail settings come from the character config', () => {
  const u = createSkinUniforms(NOX);
  const k = NOX.skin;
  expect(u.uSpeck.value.toArray()).toEqual([k.speckDensity, k.speckSize[0], k.speckSize[1], k.speckScale]);
  expect(u.uBlotch.value.toArray()).toEqual([k.blotchDensity, k.blotchScale, k.tint, k.translucency]);
  expect(u.uWet.value.toArray()).toEqual([k.wetness, k.gloss, k.streakScale, k.streakStrength]);
});

test('the world reaches the skin only through its accents: no world fog, accents before the atmospheric depth', () => {
  const u = createSkinUniforms(NOX);
  const accents = createAccentUniforms();
  for (const name of Object.keys(accents)) expect(u).toHaveProperty(name);
  for (const kind of ['HEAD', 'ARM'] as const) {
    const material = createSkinMaterial(kind, u);
    expect(material.fog).toBe(false);
    const source = material.fragmentShader;
    expect(source).toContain(ACCENT_GLSL);
    expect(source.indexOf('col = worldAccent(col, N, ndv);')).toBeGreaterThan(source.indexOf(ACCENT_GLSL));
    expect(source.indexOf('col = worldAccent(col, N, ndv);')).toBeLessThan(source.indexOf('// Atmospheric depth'));
  }
});
