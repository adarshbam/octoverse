import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import type { CharacterConfig, JellySettings, SurfaceLook } from '../config/types';
import { createSkinMaterial, createSkinUniforms, faceWeight, surfaceLooks } from './skinMaterial';
import { ACCENT_GLSL, createAccentUniforms } from './worldAccent';

// Nox's skin program before the jelly mode existed (taken from the sources at fcfedba, before the
// edit): the fragment text is one string for every kind (the kind is a define), and so is the vertex.
const NOX_FRAGMENT_SHA256 = 'f4192b071d932f9a9d3e2c945f3226d6ab3985d8e59c66a6a93eb5903d435842';
const NOX_VERTEX_SHA256 = '3a635ac8cd224651b0ac29c572028ef4a39678b783031273e17f48d55eff870a';
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

const JELLY: JellySettings = { rim: '#62eaff', rimPower: 3, crown: '#14b0cc', crownHeight: 0.5, depth: '#015f67', depthStrength: 0.6, core: '#f0eca0', coreCenter: [0, 0.1, -0.3], coreWarmth: 0.8 };
const jelly = (sparkle = 0, settings: JellySettings = JELLY): SurfaceLook => ({ mode: 'jelly', jelly: settings, sparkle });
const SKIN: SurfaceLook = { mode: 'skin', sparkle: 0 };
const withSurfaces = (mantle: SurfaceLook, arms: SurfaceLook): CharacterConfig => ({ ...NOX, skin: { ...NOX.skin, surfaces: { mantle, arms } } });
/** The head and arm materials a character's config gives, each on its own surface's look, as Octopus builds them. */
const materials = (config: CharacterConfig) => {
  const u = createSkinUniforms(config);
  const looks = surfaceLooks(config.skin);
  return { head: createSkinMaterial('HEAD', u, config.palette.rimHot, undefined, looks.mantle), arm: createSkinMaterial('ARM', u, config.palette.rimHot, undefined, looks.arms) };
};

test("Nox's skin program is the text it was before the jelly mode: mantle and arms, absent surfaces or plain skin", () => {
  for (const config of [NOX, withSurfaces(SKIN, SKIN)]) {
    const { head, arm } = materials(config);
    for (const [material, kind] of [[head, 'HEAD'], [arm, 'ARM']] as const) {
      expect(sha(material.fragmentShader)).toBe(NOX_FRAGMENT_SHA256);
      expect(sha(material.vertexShader)).toBe(NOX_VERTEX_SHA256);
      expect(material.defines).toEqual({ [kind]: '' });
    }
  }
  // The call without a look (the older signature) is Nox's too.
  expect(sha(createSkinMaterial('ARM', createSkinUniforms(NOX), NOX.palette.rimHot).fragmentShader)).toBe(NOX_FRAGMENT_SHA256);
  expect(surfaceLooks(NOX.skin)).toEqual({ mantle: SKIN, arms: SKIN });
});

test('a jelly surface compiles the JELLY branch, its colours and shape read from the config into uniforms', () => {
  const { head } = materials(withSurfaces(jelly(), SKIN));
  expect(head.defines).toEqual({ HEAD: '', JELLY: '' });
  expect(head.fragmentShader).toContain('#ifdef JELLY');
  expect(head.fragmentShader).toContain('col = jellyLook(col, N, V, ndv, faceGlow, join);');
  const u = head.uniforms;
  expect(u.uJellyRim.value).toEqual(new THREE.Color(JELLY.rim));
  expect(u.uJellyCrown.value).toEqual(new THREE.Color(JELLY.crown));
  expect(u.uJellyDepth.value).toEqual(new THREE.Color(JELLY.depth));
  expect(u.uJellyCore.value).toEqual(new THREE.Color(JELLY.core));
  expect(u.uJellyShape.value.toArray()).toEqual([JELLY.rimPower, JELLY.crownHeight, JELLY.depthStrength, JELLY.coreWarmth]);
  expect(u.uJellyCoreCenter.value.toArray()).toEqual([...JELLY.coreCenter]);
  // The jelly takes no colour of its own: the only vec3 constants it holds are the luminance weights.
  const source = head.fragmentShader;
  const start = source.indexOf('#ifdef JELLY');
  const branch = source.slice(start, source.indexOf('#endif', start));
  expect(branch).toContain('vec3 jellyLook(');
  expect(branch.match(/vec3\([^)]*\)/g) ?? []).toEqual([]);
  expect(branch).not.toMatch(/#[0-9a-fA-F]{6}/);
});

test('the jelly allocates no render target: one pass, no transmission, only the textures the skin already reads', () => {
  const source = readFileSync(resolve(__dirname, 'skinMaterial.ts'), 'utf8');
  expect(source).not.toMatch(/RenderTarget|transmission/);
  const { head, arm } = materials(withSurfaces(jelly(120), jelly(80)));
  for (const material of [head, arm]) {
    const textures = Object.entries(material.uniforms).filter(([, u]) => u.value instanceof THREE.Texture || u.value === null).map(([name]) => name).sort();
    expect(textures).toEqual(['uCausticMap', 'uFace', 'uGlowRamp']);
    expect('transmission' in material).toBe(false);
  }
});

test('jelly on the arms only: a jelly arm material and a skin mantle', () => {
  const { head, arm } = materials(withSurfaces(SKIN, jelly()));
  expect(arm.defines).toEqual({ ARM: '', JELLY: '' });
  expect(head.defines).toEqual({ HEAD: '' });
  expect(sha(head.fragmentShader)).toBe(NOX_FRAGMENT_SHA256);
  expect(head.uniforms).not.toHaveProperty('uJellyRim');
});

test('changing the jelly core colour or its centre changes only uniform values, never the shader', () => {
  const a = materials(withSurfaces(jelly(60), jelly(60))).head;
  const b = materials(withSurfaces(jelly(60, { ...JELLY, core: '#80ff40', coreCenter: [0.2, -0.1, 0.4] }), jelly(60))).head;
  expect(b.fragmentShader).toBe(a.fragmentShader);
  expect(b.vertexShader).toBe(a.vertexShader);
  expect(b.defines).toEqual(a.defines);
  expect(b.uniforms.uJellyCore.value).not.toEqual(a.uniforms.uJellyCore.value);
  expect(b.uniforms.uJellyCoreCenter.value.toArray()).toEqual([0.2, -0.1, 0.4]);
});

test('sparkles: a define only where a surface has them, at the configured density, under one shared shimmer wave', () => {
  const { head, arm } = materials(withSurfaces(jelly(150), { mode: 'skin', sparkle: 40 }));
  expect(head.defines).toEqual({ HEAD: '', JELLY: '', SPARKLE: '' });
  expect(arm.defines).toEqual({ ARM: '', SPARKLE: '' });
  expect(head.uniforms.uSparkle.value).toBe(150);
  expect(arm.uniforms.uSparkle.value).toBe(40);
  expect(head.fragmentShader).toContain('#ifdef SPARKLE');
  // The shimmer (Task 18) and the twinkle clock are the character's, shared by every surface.
  expect(head.uniforms.uSparkleWave).toBe(arm.uniforms.uSparkleWave);
  expect(head.uniforms.uSparkleWave.value).toBe(0);
  expect(head.uniforms.uSkinTime).toBe(arm.uniforms.uSkinTime);
  // Off without sparkles.
  expect(materials(withSurfaces(jelly(0), SKIN)).head.defines).toEqual({ HEAD: '', JELLY: '' });
});

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
    const material = createSkinMaterial(kind, u, NOX.palette.rimHot);
    expect(material.fog).toBe(false);
    const source = material.fragmentShader;
    expect(source).toContain(ACCENT_GLSL);
    const call = source.indexOf('col = worldAccent(col, N, ndv, ');
    expect(call).toBeGreaterThan(source.indexOf(ACCENT_GLSL));
    expect(call).toBeLessThan(source.indexOf('// Atmospheric depth'));
  }
});

test('world accents stay off the face glow and the arm roots, as the neon rim does', () => {
  const source = createSkinMaterial('ARM', createSkinUniforms(NOX), NOX.palette.rimHot).fragmentShader;
  const ownGlow = source.match(/float rimFade = ([^;]*);/)?.[1];
  expect(ownGlow).toBe('(1.0 - join) * (1.0 - smoothstep(0.3, 0.65, faceGlow))');
  expect(source).toContain(`col = worldAccent(col, N, ndv, ${ownGlow});`);
});

test('face features never show on the back', () => {
  expect(faceWeight(-0.5)).toBe(0);
  expect(faceWeight(-1)).toBe(0);
  expect(faceWeight(0.05)).toBe(0);
  expect(faceWeight(0.0999)).toBe(0);
  expect(faceWeight(0.9)).toBe(1);
  expect(faceWeight(0.2)).toBeGreaterThan(0);
  expect(faceWeight(0.2)).toBeLessThan(1);
  // The shader masks the face texture with the same weight.
  const source = createSkinMaterial('HEAD', createSkinUniforms(NOX), NOX.palette.rimHot).fragmentShader;
  expect(source).toContain('float mask = face.a * inside * faceWeight(vFront);');
});

test('the arms’ red underside band glows at the strength the config gives, 1.6 as approved (R25)', () => {
  expect(NOX.glow.underside).toBe(1.6);
  const uniforms = createSkinUniforms({ ...NOX, glow: { ...NOX.glow, underside: 1.3 } });
  expect(uniforms.uUnderside.value).toBe(1.3);
  expect(createSkinUniforms(NOX).uUnderside.value).toBe(1.6);
  const material = createSkinMaterial('ARM', uniforms, NOX.palette.rimHot);
  expect(material.fragmentShader).toMatch(/pow\(band, 1\.6\) \* uUnderside;/);
  material.dispose();
});
