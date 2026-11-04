import * as THREE from 'three';
import { expect, test } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import { createOrbHaloMaterial, createOrbLogoMaterial, createOrbMaterial } from './orbMaterial';

// Nox's skin is opaque and writes depth; a bubble that tested against it would be cut away by his
// head and arms wherever its orbit passes behind them. The bubbles draw after all of his layers
// and ignore his depth, so every one shows in full, in front of him.
test('bubble glass, halo and logo draw over Nox: no depth test, no depth write', () => {
  for (const material of [createOrbMaterial('#ff0000', NOX.palette.orbFocus, NOX.palette.orbGlass), createOrbHaloMaterial('#ff0000', NOX.palette.orbFocus), createOrbLogoMaterial(new THREE.Texture())]) {
    expect(material.transparent).toBe(true);
    expect(material.depthTest).toBe(false);
    expect(material.depthWrite).toBe(false);
  }
});
