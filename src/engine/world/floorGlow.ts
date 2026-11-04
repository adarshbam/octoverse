import { glslColour } from './colour';
import type { FloorGlow } from './types';

/**
 * The seabed's glow as the GLSL the floor compiles in (Floor.tsx): the cracks' and the lava's
 * colours as `vec3`s, and the puddles' sheen line, which mirrors the floor's glow in the world's
 * sheen colour, stronger toward the sides. A floor with no glow (`glow` 0, the world's
 * `glow.floor`) has nothing to mirror, so it has no sheen line; a black sheen adds nothing either.
 * Compiled in, not uniforms: the shader keeps the very text (and so the pixels) it had when these
 * were literals.
 */
export function floorGlowGlsl(floorGlow: FloorGlow, glow: number) {
  const sheen = glow > 0
    ? `// Puddles mirror that glow: the floor glow's sheen, stronger toward the sides.
            totalEmissiveRadiance += ${glslColour(floorGlow.sheen)} * puddle * (0.03 + 0.12 * side);`
    : '// No floor glow: the puddles have nothing to mirror.';
  return { cracks: glslColour(floorGlow.cracks), lava: glslColour(floorGlow.lava), sheen };
}
