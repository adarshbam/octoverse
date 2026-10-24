import * as THREE from 'three';
import { expect, test } from 'vitest';
import { NOX } from '../config/nox.character';
import { createHaloMaterial } from './haloMaterial';

test('the halo takes its reach, colours and strengths from the character config', () => {
  const halo = NOX.glow.halo;
  const arm = createHaloMaterial(halo, 'ARM');
  const head = createHaloMaterial(halo, 'HEAD');
  expect(arm.uniforms.uWidth.value).toBe(halo.armWidth);
  expect(head.uniforms.uWidth.value).toBe(halo.headWidth);
  expect(arm.uniforms.uColor.value.getHexString()).toBe(halo.color.slice(1));
  expect(arm.uniforms.uBand.value.getHexString()).toBe(halo.band.slice(1));
  expect(arm.uniforms.uStrength.value.toArray()).toEqual([halo.strength, halo.bandStrength]);
});

test('the halo glows round the outside of the shape only: additive, behind the surface, never writing depth', () => {
  const m = createHaloMaterial(NOX.glow.halo, 'ARM');
  expect(m.transparent).toBe(true);
  expect(m.depthWrite).toBe(false);
  expect(m.blending).toBe(2); // THREE.AdditiveBlending
  expect(m.side).toBe(1); // THREE.BackSide
});

test('the head shell grows out from the head centre it is given', () => {
  const centre = new THREE.Vector3(0.1, -0.2, 0);
  expect(createHaloMaterial(NOX.glow.halo, 'HEAD', centre).uniforms.uCentre.value).toBe(centre);
});
