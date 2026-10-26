import { describe, expect, it } from 'vitest';
import { NO_NOX_LIGHT, createGlowLightUniforms } from '../character/glowLight';
import { createBubbleMaterial, createEmberMaterial, createMoteMaterial, createSnowMaterial } from './particleMaterials';

const MATERIALS = { bubbles: createBubbleMaterial, embers: createEmberMaterial, motes: createMoteMaterial, snow: createSnowMaterial };

describe('the particles take the face glow', () => {
  for (const [name, create] of Object.entries(MATERIALS)) {
    it(`${name}: read the shared glow uniforms, not copies`, () => {
      const glow = createGlowLightUniforms();
      const material = create(glow);
      expect(material.uniforms.uNoxLight).toBe(glow.uNoxLight);
      expect(material.uniforms.uNoxLightPos).toBe(glow.uNoxLightPos);
      material.dispose();
    });

    it(`${name}: work out the tint per particle and add it in the fragment`, () => {
      const material = create(createGlowLightUniforms());
      expect(material.vertexShader).toContain('uniform vec3 uNoxLight;');
      expect(material.vertexShader).toContain('uniform vec3 uNoxLightPos;');
      expect(material.vertexShader).toMatch(/vGlow = noxGlow\(/);
      expect(material.fragmentShader).toContain('varying vec3 vGlow;');
      expect(material.fragmentShader).toMatch(/vGlow \*/);
      material.dispose();
    });

    it(`${name}: outside a world, share the one black light`, () => {
      const material = create();
      expect(material.uniforms.uNoxLight).toBe(NO_NOX_LIGHT.uNoxLight);
      expect(material.uniforms.uNoxLight.value.toArray()).toEqual([0, 0, 0]);
      material.dispose();
    });
  }
});
