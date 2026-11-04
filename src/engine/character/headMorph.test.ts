import { expect, test } from 'vitest';
import { createHeadSilhouetteMaterial, headMorphVertex } from './headMorph';

test('the head silhouette follows the head morph, white, and keeps itself over the scene override', () => {
  const morph = { value: 0.4 };
  const material = createHeadSilhouetteMaterial(morph);
  // A silhouette capture sets the scene's plain white override; the head must not take it, or
  // the overview mask shows the closed head instead of the open one.
  expect(material.allowOverride).toBe(false);
  // It reads the skin's own morph uniform, so it opens in step with the head.
  expect(material.uniforms.uMorph).toBe(morph);
  expect(material.vertexShader).toContain(headMorphVertex);
  expect(material.vertexShader).toContain('morphedPosition()');
  expect(material.fragmentShader).toContain('vec4(1.0)');
  material.dispose();
});
