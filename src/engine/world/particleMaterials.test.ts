import { describe, expect, it } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import { SECURITY_WORLD } from '../../worlds/nox/place/config';
import { dummyCharacter } from '../config/fixtures/dummy.character';
import { NO_NOX_LIGHT, createGlowLightUniforms } from '../character/glowLight';
import { createBubbleMaterial, createEmberMaterial, createMoteMaterial, createSnowMaterial } from './particleMaterials';

const DUMMY = dummyCharacter(NOX);

const COLOURS = SECURITY_WORLD.live.colours;
/** Each material with Nox's colours: `create(glow?, reach?)`. */
const MATERIALS = {
  bubbles: (...rest: Rest) => createBubbleMaterial(COLOURS.bubbles, ...rest),
  embers: (...rest: Rest) => createEmberMaterial(COLOURS.embers, ...rest),
  motes: (...rest: Rest) => createMoteMaterial(COLOURS.motes, ...rest),
  snow: (...rest: Rest) => createSnowMaterial(COLOURS.snow, ...rest),
};
type Rest = [glow?: Parameters<typeof createSnowMaterial>[1], reach?: Parameters<typeof createSnowMaterial>[2]];

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

// The particles' light reaches as far as the character's own point light does: the reach and decay
// are compiled in from `glow.light` (a uniform would change the shader's maths and the pixels).
describe('the particles take the reach and decay of the character\'s light', () => {
  const reachOf = (shader: string) => ({ distance: Number(/#define NOX_GLOW_REACH (\S+)/.exec(shader)![1]), decay: Number(/#define NOX_GLOW_DECAY (\S+)/.exec(shader)![1]) });

  for (const [name, create] of Object.entries(MATERIALS)) {
    it(`${name}: Nox's reach (6, 2) is compiled in unless another is given, bit for bit what it was`, () => {
      const glow = createGlowLightUniforms();
      expect(reachOf(create(glow).vertexShader)).toEqual({ distance: 6, decay: 2 });
      expect(reachOf(create(glow, NOX.glow.light).vertexShader)).toEqual({ distance: 6, decay: 2 });
      expect(create(glow, NOX.glow.light).vertexShader).toBe(create(glow).vertexShader);
      expect(create(glow).vertexShader).toContain('#define NOX_GLOW_REACH 6.0000');
      expect(create(glow).vertexShader).toContain('#define NOX_GLOW_DECAY 2.0000');
    });

    it(`${name}: another character's light distance and decay move the particles too (the dummy character reaches 5)`, () => {
      expect(DUMMY.glow.light.distance).toBe(5);
      const shader = create(createGlowLightUniforms(), DUMMY.glow.light).vertexShader;
      expect(reachOf(shader)).toEqual({ distance: DUMMY.glow.light.distance, decay: DUMMY.glow.light.decay });
      expect(shader).toContain('#define NOX_GLOW_REACH 5.0000');
      expect(shader).not.toContain('#define NOX_GLOW_REACH 6.0000');
      const slow = create(createGlowLightUniforms(), { distance: 9.5, decay: 1.5 }).vertexShader;
      expect(slow).toContain('#define NOX_GLOW_REACH 9.5000');
      expect(slow).toContain('#define NOX_GLOW_DECAY 1.5000');
    });
  }
});

describe("the particles draw in the world's colours", () => {
  const hex = (material: { uniforms: Record<string, { value: unknown }> }, name: string) => (material.uniforms[name].value as { getHexString(): string }).getHexString();

  it("Nox's are the literals they were drawn with, verbatim", () => {
    expect(COLOURS).toEqual({ bubbles: { rim: '#ff6a9a', tint: '#7a4aa8' }, embers: { color: '#ff2c3c', hot: '#ff8a5a' }, motes: { color: '#ff2238', hot: '#ff9a6a' }, snow: '#a8c0ff' });
    expect([hex(MATERIALS.bubbles(), 'uRim'), hex(MATERIALS.bubbles(), 'uTint')]).toEqual(['ff6a9a', '7a4aa8']);
    expect([hex(MATERIALS.embers(), 'uColor'), hex(MATERIALS.embers(), 'uHot')]).toEqual(['ff2c3c', 'ff8a5a']);
    expect([hex(MATERIALS.motes(), 'uColor'), hex(MATERIALS.motes(), 'uHot')]).toEqual(['ff2238', 'ff9a6a']);
    expect(hex(MATERIALS.snow(), 'uColor')).toBe('a8c0ff');
  });

  it("another world's colours reach every particle (no red in a teal world's)", () => {
    const teal = { bubbles: { rim: '#60f0d8', tint: '#2a7a88' }, embers: { color: '#30e0b8', hot: '#b4f0e0' }, motes: { color: '#58d070', hot: '#c8f0a0' }, snow: '#e0f0ff' };
    const made = [createBubbleMaterial(teal.bubbles), createEmberMaterial(teal.embers), createMoteMaterial(teal.motes), createSnowMaterial(teal.snow)];
    for (const material of made) {
      for (const name of ['uRim', 'uTint', 'uColor', 'uHot']) {
        const value = material.uniforms[name]?.value as { r: number; g: number; b: number } | undefined;
        if (value) expect(value.r <= value.g || value.r <= value.b, name).toBe(true);
      }
      material.dispose();
    }
  });
});
