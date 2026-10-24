import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { createSkinUniforms } from './skinMaterial';

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
