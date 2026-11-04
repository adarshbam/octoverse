import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import type { SuckerStyle } from '../config/types';
import { createSkinUniforms } from './skinMaterial';
import { FLARE_ARMS, createCupArmAttribute, createCupShadowMaterial, createSuckerMaterial } from './suckerMaterial';
import { CUP_EMBED, type SuckerRow } from './suckerRow';

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

// Nox's cup programs before the frill style existed (taken at aaf1158, before the edit).
const NOX_CUP_VERTEX_SHA256 = 'c44635a27e08f86d9307ecf95ea234ff68611bc9940179a91e0e63d9b47a2525';
const NOX_CUP_FRAGMENT_SHA256 = '952d44988fef3012033161543d82f21f3a0aea6976c23cf7ae03d1fd6b98c201';
const NOX_SHADOW_VERTEX_SHA256 = '668fe6a969b47b95a1025cf34a9ed9713d6725b1cbd8b7e675ebb0bd000263e5';
const NOX_SHADOW_FRAGMENT_SHA256 = '469da3230c853eb28df47c0d329466730c949cd03fdec528e7ef80f1e261c892';
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

const FRILL: SuckerStyle = { rimWidth: 0.22, scallop: 0.6, edge: '#e0dc9c', rim: '#f6f0ba', hollow: '#6a9478', glow: 1.3 };

test("with no style, Nox's cup and shadow programs are the text they were, with the same uniforms", () => {
  const skin = createSkinUniforms(NOX);
  for (const cups of [createSuckerMaterial(NOX.palette, skin), createSuckerMaterial(NOX.palette, skin, undefined), createSuckerMaterial(NOX.palette, skin, NOX.suckers.style)]) {
    expect(sha(cups.vertexShader)).toBe(NOX_CUP_VERTEX_SHA256);
    expect(sha(cups.fragmentShader)).toBe(NOX_CUP_FRAGMENT_SHA256);
    expect(Object.keys(cups.uniforms).filter(k => k.startsWith('uFrill'))).toEqual([]);
  }
  const shadow = createCupShadowMaterial(NOX.palette, NOX.suckers, skin);
  expect(sha(shadow.vertexShader)).toBe(NOX_SHADOW_VERTEX_SHA256);
  expect(sha(shadow.fragmentShader)).toBe(NOX_SHADOW_FRAGMENT_SHA256);
});

test('a frill style takes its colours and glow from the config into uniforms, and its text holds no colour', () => {
  const skin = createSkinUniforms(NOX);
  const cups = createSuckerMaterial(NOX.palette, skin, FRILL);
  expect(cups.uniforms.uFrillEdge.value).toEqual(new THREE.Color(FRILL.edge));
  expect(cups.uniforms.uFrillRim.value).toEqual(new THREE.Color(FRILL.rim));
  expect(cups.uniforms.uFrillHollow.value).toEqual(new THREE.Color(FRILL.hollow));
  expect(cups.uniforms.uFrill.value.toArray()).toEqual([FRILL.rimWidth, CUP_EMBED + FRILL.scallop, CUP_EMBED, FRILL.glow]);
  // Still lit with the skin, and still flaring per arm.
  expect(cups.uniforms.uKeyDir).toBe(skin.uKeyDir);
  expect(cups.uniforms.uFlare.value).toHaveLength(FLARE_ARMS);
  // The frill reads its colours, its glow in place of Nox's boost, and is not flattened edge-on.
  for (const name of ['uFrillEdge', 'uFrillRim', 'uFrillHollow', 'uFrill']) expect(cups.fragmentShader).toContain(`uniform ${name === 'uFrill' ? 'vec4' : 'vec3'} ${name};`);
  expect(cups.fragmentShader).toContain('c *= uFrill.w;');
  expect(cups.fragmentShader).not.toContain('c *= uBoost;');
  expect(cups.fragmentShader).not.toContain('slit');
  expect(cups.vertexShader).not.toContain('facing');
  // What the frill added holds no colour: no hex, no vec3 of numbers (the hue ratchet's spellings).
  const nox = createSuckerMaterial(NOX.palette, skin).fragmentShader;
  const added = cups.fragmentShader.split('\n').filter(line => !nox.includes(line));
  expect(added.length).toBeGreaterThan(8);
  for (const line of added) {
    expect(line).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(line).not.toMatch(/vec[34]\(\s*[-.\d]+\s*,/);
  }
});

test('two frill styles differing only in colours compile the same program (only uniforms differ)', () => {
  const skin = createSkinUniforms(NOX);
  const pink: SuckerStyle = { ...FRILL, edge: '#ffe0ee', rim: '#fff4fa', hollow: '#c890b0' };
  const a = createSuckerMaterial(NOX.palette, skin, FRILL);
  const b = createSuckerMaterial(NOX.palette, skin, pink);
  expect(b.vertexShader).toBe(a.vertexShader);
  expect(b.fragmentShader).toBe(a.fragmentShader);
  expect(b.uniforms.uFrillRim.value).toEqual(new THREE.Color(pink.rim));
});
