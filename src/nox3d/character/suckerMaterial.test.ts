import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { createSkinUniforms } from './skinMaterial';
import { createCupShadowMaterial, createSuckerMaterial } from './suckerMaterial';

test('cups are lit by the same key light and underglow as the skin, so they move together', () => {
  const skin = createSkinUniforms(NOX);
  const cups = createSuckerMaterial(NOX.palette, skin);
  expect(cups.uniforms.uKeyDir).toBe(skin.uKeyDir);
  expect(cups.uniforms.uKeyLight).toBe(skin.uKeyLight);
  expect(cups.uniforms.uUnderglow).toBe(skin.uUnderglow);
});

test('the cup contact shadow takes its strength from the config, follows the key light, and never writes depth', () => {
  const skin = createSkinUniforms(NOX);
  const shadow = createCupShadowMaterial(NOX.palette, NOX.suckers, skin);
  expect(shadow.transparent).toBe(true);
  expect(shadow.depthWrite).toBe(false);
  expect(shadow.uniforms.uStrength.value).toBe(NOX.suckers.shadow);
  expect(shadow.uniforms.uKeyDir).toBe(skin.uKeyDir);
});
