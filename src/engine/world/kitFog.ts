import * as THREE from 'three';

// The `fog` param of the kit-material variants (kitMaterials.ts): the share of the world's fog a
// piece that gives off its own light takes, 0 (none: it shines through the water at full) to 1 (the
// world's fog, as any other surface; the default). A world sets it below 1 for a relic that must
// read from the stage's distance, such as a doorway's membrane and its lock. The world's fog colour
// and density are unchanged: only how much of it this material mixes in.

/** The fog share a variant's params give: their `fog`, or 1 (the world's) when they set none. */
export function kitFogShare(params: { fog?: number }): number {
  return params.fog ?? 1;
}

/** What is wrong with a variant's `fog` param, in words (none when it is absent or in [0, 1]). */
export function kitFogProblems(params: { fog?: unknown }, at: string): string[] {
  if (params?.fog === undefined) return [];
  const fog = params.fog;
  return typeof fog === 'number' && Number.isFinite(fog) && fog >= 0 && fog <= 1 ? [] : [`${at}.fog must be between 0 and 1`];
}

/** three's fog mix, its factor scaled by `uKitFog`. */
const FOG_MIX = 'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );';
export const KIT_FOG_FRAGMENT = THREE.ShaderChunk.fog_fragment.replace(FOG_MIX, 'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * uKitFog );');

/**
 * Splices the fog share into a shader as three hands it to onBeforeCompile: the uniform `uKitFog`
 * (the given object, so the material keeps it) and the fog mix scaled by it. Throws if three's fog
 * chunk is not where it is expected, so a three upgrade that moves it fails loudly, not silently fogged.
 */
export function withKitFog(shader: { fragmentShader: string; uniforms: Record<string, THREE.IUniform> }, uniform: THREE.IUniform<number>) {
  if (KIT_FOG_FRAGMENT === THREE.ShaderChunk.fog_fragment || !shader.fragmentShader.includes('#include <fog_fragment>')) {
    throw new Error('kit fog: three\'s fog_fragment chunk has changed; the fog share cannot be spliced');
  }
  shader.uniforms.uKitFog = uniform;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uKitFog;')
    .replace('#include <fog_fragment>', KIT_FOG_FRAGMENT);
}
