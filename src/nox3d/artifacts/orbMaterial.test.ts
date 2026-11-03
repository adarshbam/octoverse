import { expect, test } from 'vitest';
import { createOrbHaloMaterial, createOrbMaterial } from './orbMaterial';

// Nox's skin is opaque and writes depth; a bubble that tested against it would be cut away by his
// head and arms wherever its orbit passes behind them. The bubbles draw after all of his layers
// and ignore his depth, so every one shows in full, in front of him.
test('bubble glass and halo draw over Nox: no depth test, no depth write', () => {
  for (const material of [createOrbMaterial('#ff0000'), createOrbHaloMaterial('#ff0000')]) {
    expect(material.transparent).toBe(true);
    expect(material.depthTest).toBe(false);
    expect(material.depthWrite).toBe(false);
  }
});
