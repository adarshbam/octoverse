import { glslColour } from '../colour';

/**
 * The sand floor's shading (Floor.tsx puts it after the wet patches' roughness, where `floorNoise`
 * (the baked noise's puddle and patch fields), `puddle` and `vFloorWorld` are defined): pale `sand`
 * (a palette colour) laid in soft ripples that run across the seabed, with dark `rock` showing
 * through where the patch field is high, thinning toward the middle so the stage keeps its sand.
 * Sand is matt, rock a little glossier, and the wet patches stay wet and darken the sand they wet.
 * No glow: a sandy floor has no cracks, lava or sheen, so the world's `floorGlow` is not read.
 */
export function sandShading(sand: string, rock: string) {
  return /* glsl */ `
          // Sand over the seabed in ripples, rock where the patch field is high (and away from the middle).
          float sandRipple = 0.5 + 0.5 * sin(vFloorWorld.z * 5.5 + floorNoise.x * 9.0 + vFloorWorld.x * 0.8);
          float rockAmount = smoothstep(0.56, 0.74, floorNoise.y) * (0.45 + 0.55 * smoothstep(0.0, 4.0, abs(vFloorWorld.x)));
          vec3 sandColour = ${glslColour(sand)} * (0.8 + 0.4 * sandRipple) * (1.0 - 0.35 * puddle);
          vec3 rockColour = ${glslColour(rock)} * (0.65 + 0.7 * floorNoise.x);
          diffuseColor.rgb = mix(sandColour, rockColour, rockAmount);
          roughnessFactor = mix(roughnessFactor, mix(0.92, 0.7, rockAmount), (1.0 - puddle));`;
}
