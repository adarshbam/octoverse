import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { NOX } from '../../worlds/nox/character';
import { NO_NOX_LIGHT, PARTICLE_GLOW, PARTICLE_GLOW_CAP, PARTICLE_REACH, createGlowLightUniforms, glowFalloff, glowLightGlsl, lightParticles, particleGlow } from './glowLight';

const GLOW_LIGHT = NOX.glow.light;

describe('the face glow light on the particles', () => {
  it('mirrors three’s point-light falloff for the light’s reach and decay', () => {
    // three's getDistanceAttenuation: 1 / max(d^decay, 0.01) * saturate(1 - (d / reach)^4)^2.
    const three = (d: number) => (1 / Math.max(d ** 2, 0.01)) * Math.min(Math.max(1 - (d / 6) ** 4, 0), 1) ** 2;
    for (const d of [0, 0.05, 0.1, 0.5, 1, 1.7, 3, 4.5, 5.9, 6, 7.5]) expect(glowFalloff(d, GLOW_LIGHT)).toBeCloseTo(three(d), 10);
    expect(glowFalloff(0, GLOW_LIGHT)).toBe(100);
    expect(glowFalloff(1, GLOW_LIGHT)).toBeCloseTo((1 - 1 / 1296) ** 2, 10);
    expect(glowFalloff(3, GLOW_LIGHT)).toBeCloseTo((1 / 9) * (15 / 16) ** 2, 10);
    expect(glowFalloff(GLOW_LIGHT.distance, GLOW_LIGHT)).toBe(0);
    expect(glowFalloff(10, GLOW_LIGHT)).toBe(0);
    // The reach is the config's: a shorter light is gone sooner, a steeper one falls faster.
    expect(glowFalloff(3, { distance: 3, decay: 2 })).toBe(0);
    expect(glowFalloff(2, { distance: 6, decay: 3 })).toBeLessThan(glowFalloff(2, { distance: 6, decay: 1 }));
  });

  it('is the same formula three’s shaders use', () => {
    const chunk = THREE.ShaderChunk.lights_pars_begin;
    expect(chunk).toContain('float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );');
    expect(chunk).toContain('distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );');
  });

  it('dims with distance and is gone at the light’s reach', () => {
    let last = Infinity;
    for (let d = 0.1; d <= 6; d += 0.1) {
      const now = glowFalloff(d, GLOW_LIGHT);
      expect(now).toBeLessThan(last);
      last = now;
    }
  });

  it('caps a near particle’s tint at its brightest channel and keeps its hue', () => {
    const light = [5 * PARTICLE_GLOW, 0.34 * PARTICLE_GLOW, 0.15 * PARTICLE_GLOW] as const;
    const near = particleGlow(0.2, light, GLOW_LIGHT);
    expect(Math.max(...near)).toBeCloseTo(PARTICLE_GLOW_CAP, 10);
    expect(near[1] / near[0]).toBeCloseTo(light[1] / light[0], 10);
    expect(near[2] / near[0]).toBeCloseTo(light[2] / light[0], 10);
    // Farther, under the cap: the light times the falloff, unchanged.
    const far = particleGlow(3, light, GLOW_LIGHT);
    expect(Math.max(...far)).toBeLessThan(PARTICLE_GLOW_CAP);
    far.forEach((c, i) => expect(c).toBeCloseTo(light[i] * glowFalloff(3, GLOW_LIGHT), 10));
    expect(particleGlow(6, light, GLOW_LIGHT)).toEqual([0, 0, 0]);
  });

  it('gives no tint outside a world: the shared uniforms default to black', () => {
    expect(createGlowLightUniforms().uNoxLight.value.toArray()).toEqual([0, 0, 0]);
    expect(NO_NOX_LIGHT.uNoxLight.value.toArray()).toEqual([0, 0, 0]);
    expect(particleGlow(0.5, NO_NOX_LIGHT.uNoxLight.value.toArray() as [number, number, number], GLOW_LIGHT)).toEqual([0, 0, 0]);
  });

  it('lights the particles with the face glow’s colour times intensity times their share', () => {
    const uniforms = createGlowLightUniforms();
    lightParticles(uniforms, GLOW_LIGHT);
    const expected = new THREE.Color(GLOW_LIGHT.color).multiplyScalar(GLOW_LIGHT.intensity * PARTICLE_GLOW);
    uniforms.uNoxLight.value.toArray().forEach((c, i) => expect(c).toBeCloseTo(expected.toArray()[i], 10));
  });

  it('takes the light colour and intensity from the config argument, not a module constant', () => {
    const teal = { color: '#20d0a8', intensity: 3, distance: 6, decay: 2 };
    const uniforms = createGlowLightUniforms();
    lightParticles(uniforms, teal);
    const expected = new THREE.Color('#20d0a8').multiplyScalar(3 * PARTICLE_GLOW);
    uniforms.uNoxLight.value.toArray().forEach((c, i) => expect(c).toBeCloseTo(expected.toArray()[i], 10));
    // A different colour is a different tint, and the strength still scales it.
    lightParticles(uniforms, teal, 0.5);
    uniforms.uNoxLight.value.toArray().forEach((c, i) => expect(c).toBeCloseTo(expected.toArray()[i] * 0.5, 10));
  });

  it('compiles the particles with the reach and decay the Nox config holds', () => {
    expect(PARTICLE_REACH).toEqual({ distance: NOX.glow.light.distance, decay: NOX.glow.light.decay });
  });

  it('carries the same reach, decay and cap into the GLSL', () => {
    const GLOW_LIGHT_GLSL = glowLightGlsl(PARTICLE_REACH);
    expect(GLOW_LIGHT_GLSL).toContain('uniform vec3 uNoxLightPos;');
    expect(GLOW_LIGHT_GLSL).toContain('uniform vec3 uNoxLight;');
    expect(GLOW_LIGHT_GLSL).toMatch(/#define NOX_GLOW_REACH 6\.0+\b/);
    expect(GLOW_LIGHT_GLSL).toMatch(/#define NOX_GLOW_DECAY 2\.0+\b/);
    expect(GLOW_LIGHT_GLSL).toContain(`#define NOX_GLOW_CAP ${PARTICLE_GLOW_CAP.toFixed(4)}`);
    expect(GLOW_LIGHT_GLSL).toContain('vec3 noxGlow(vec3 at)');
  });
});
