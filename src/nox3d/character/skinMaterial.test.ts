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
    const call = source.indexOf('col = worldAccent(col, N, ndv, ');
    expect(call).toBeGreaterThan(source.indexOf(ACCENT_GLSL));
    expect(call).toBeLessThan(source.indexOf('// Atmospheric depth'));
  }
});

test('world accents stay off the face glow and the arm roots, as the neon rim does', () => {
  const source = createSkinMaterial('ARM', createSkinUniforms(NOX)).fragmentShader;
  const ownGlow = source.match(/float rimFade = ([^;]*);/)?.[1];
  expect(ownGlow).toBe('(1.0 - join) * (1.0 - smoothstep(0.3, 0.65, faceGlow))');
  expect(source).toContain(`col = worldAccent(col, N, ndv, ${ownGlow});`);
});

test('the arms’ red underside band glows at the strength the config gives, 1.6 as approved (R25)', () => {
  expect(NOX.glow.underside).toBe(1.6);
  const uniforms = createSkinUniforms({ ...NOX, glow: { ...NOX.glow, underside: 1.3 } });
  expect(uniforms.uUnderside.value).toBe(1.3);
  expect(createSkinUniforms(NOX).uUnderside.value).toBe(1.6);
  const material = createSkinMaterial('ARM', uniforms);
  expect(material.fragmentShader).toMatch(/pow\(band, 1\.6\) \* uUnderside;/);
  material.dispose();
});
