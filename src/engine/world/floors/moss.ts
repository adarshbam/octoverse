import { glslColour } from '../colour';

/**
 * The moss floor's shading (Floor.tsx puts it after the wet patches' roughness, where `floorNoise`
 * (the baked noise's puddle and patch fields), `puddle` and `vFloorWorld` are defined): patches
 * of `moss` (a palette colour) over the silt, thickest where the patch field is high and thinning
 * toward the middle, matt where they grow, and the wet patches kept wet. No glow: a mossy floor has
 * no cracks, lava or sheen, so the world's `floorGlow` is not read.
 */
export function mossShading(moss: string) {
  return /* glsl */ `
          // Moss over the silt: the patch field decides where, the middle stays barer.
          float mossAmount = smoothstep(0.42, 0.68, floorNoise.y) * (0.55 + 0.45 * smoothstep(0.0, 4.0, abs(vFloorWorld.x)));
          diffuseColor.rgb = mix(diffuseColor.rgb, ${glslColour(moss)} * (0.65 + 0.7 * floorNoise.x), mossAmount);
          roughnessFactor = mix(roughnessFactor, 0.9, mossAmount * (1.0 - puddle));`;
}
