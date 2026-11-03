import * as THREE from 'three';
import type { GlowLightSettings } from '../config/types';
import type { RGB } from './worldAccent';

// In a world, Nox's face glow lights what is round him. A point light reaches the seabed, the
// stone and the world's lit pieces; the bubbles, embers, motes and marine snow take no scene
// lights, so their shaders take the same light as a tint, with three's falloff and a cap. Outside
// a world the tint is black.

/**
 * The reach and decay the particles' shaders are compiled with (`GLOW_LIGHT_GLSL`): the same as
 * Nox's `glow.light.distance` and `decay` (a test holds them equal). The light's colour and
 * intensity come from the character's config; threading these two through the world's particle
 * materials is the world config's job (Task 5).
 */
export const PARTICLE_REACH = { distance: 6, decay: 2 } as const;
/** Where that light sits from the face glow (world units): below and in front, so it reaches the seabed. */
export const GLOW_LIGHT_OFFSET = new THREE.Vector3(0, -0.42, 0.5);
/**
 * The share of the light a particle takes: a quarter of what a white surface square to the light
 * shows (three's diffuse is 1/π of the light). Kept in Task 5: the light at intensity 2 and at
 * 10 (which scales this tint the same way) moved none of the colour measures round Nox.
 */
export const PARTICLE_GLOW = 0.25 / Math.PI;
/** A particle's tint is at most this on its brightest channel, so none near the glow blows out. */
export const PARTICLE_GLOW_CAP = 0.35;

/** three's point-light falloff (getDistanceAttenuation) at `distance` from the light, for its reach and decay. Mirrors the GLSL. */
export function glowFalloff(distance: number, light: Pick<GlowLightSettings, 'distance' | 'decay'>): number {
  const edge = THREE.MathUtils.clamp(1 - (distance / light.distance) ** 4, 0, 1);
  return (edge * edge) / Math.max(distance ** light.decay, 0.01);
}

/** The tint on a particle at `distance` from the light, for `light` as the particles take it; its brightest channel capped. Mirrors the GLSL. */
export function particleGlow(distance: number, light: RGB, reach: Pick<GlowLightSettings, 'distance' | 'decay'>): RGB {
  const k = glowFalloff(distance, reach);
  const peak = Math.max(...light) * k;
  const scale = peak > PARTICLE_GLOW_CAP ? (k * PARTICLE_GLOW_CAP) / peak : k;
  return [light[0] * scale, light[1] * scale, light[2] * scale];
}

export type GlowLightUniforms = ReturnType<typeof createGlowLightUniforms>;

/** Uniforms every particle in a world shares: where the light is (world space), and its colour as they take it (black: no tint). */
export function createGlowLightUniforms() {
  return {
    uNoxLightPos: { value: new THREE.Vector3() },
    uNoxLight: { value: new THREE.Color(0, 0, 0) },
  };
}

/** The particles' light outside a world: shared by all of them and never written, so always black. */
export const NO_NOX_LIGHT: GlowLightUniforms = createGlowLightUniforms();

/**
 * Sets the particles' light to the face glow's (`light`, the character's `glow.light`): its linear
 * colour times intensity times PARTICLE_GLOW, times `strength` (1 unless the glow is dimmed, as
 * when Nox comes out of the murk).
 */
export function lightParticles(uniforms: GlowLightUniforms, light: GlowLightSettings, strength = 1) {
  uniforms.uNoxLight.value.set(light.color).multiplyScalar(light.intensity * PARTICLE_GLOW * strength);
}

/** Declarations and `noxGlow(at)`, the tint on a particle at world position `at`, for a particle's vertex shader. */
export const GLOW_LIGHT_GLSL = /* glsl */ `
  #define NOX_GLOW_REACH ${PARTICLE_REACH.distance.toFixed(4)}
  #define NOX_GLOW_DECAY ${PARTICLE_REACH.decay.toFixed(4)}
  #define NOX_GLOW_CAP ${PARTICLE_GLOW_CAP.toFixed(4)}
  uniform vec3 uNoxLightPos;
  uniform vec3 uNoxLight;

  vec3 noxGlow(vec3 at) {
    // three's point-light falloff, as on the seabed.
    float d = distance(at, uNoxLightPos);
    float r = d / NOX_GLOW_REACH;
    float edge = clamp(1.0 - r * r * r * r, 0.0, 1.0);
    vec3 tint = uNoxLight * (edge * edge / max(pow(d, NOX_GLOW_DECAY), 0.01));
    float peak = max(tint.r, max(tint.g, tint.b));
    return peak > NOX_GLOW_CAP ? tint * (NOX_GLOW_CAP / peak) : tint;
  }
`;
