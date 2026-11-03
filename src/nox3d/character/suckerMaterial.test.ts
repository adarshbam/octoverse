import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { createSkinUniforms } from './skinMaterial';
import { FLARE_ARMS, createCupArmAttribute, createCupShadowMaterial, createSuckerMaterial } from './suckerMaterial';
import type { SuckerRow } from './suckerRow';

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

test('each arm has its own cup flare, none at rest, and each cup knows its arm and its place along it', () => {
  const cups = createSuckerMaterial(NOX.palette, createSkinUniforms(NOX));
  expect(Array.from(cups.uniforms.uFlare.value as Float32Array)).toEqual(new Array(FLARE_ARMS).fill(0));
  const row = (arcs: number[]) => ({ count: arcs.length, suckers: arcs.map(arc => ({ arc })) }) as unknown as SuckerRow;
  const attribute = createCupArmAttribute([{ row: row([0.5, 1]), length: 2 }, { row: row([1.5]), length: 3 }]);
  expect(Array.from(attribute.array)).toEqual([0, 0.25, 0, 0.5, 1, 0.5]);
});
