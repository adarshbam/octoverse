import * as THREE from 'three';

/**
 * The head's change into the overview dome, shared by every material drawn on the head mesh (the
 * skin and its glow shell), so nothing is left behind at the old outline. The mantle first lowers
 * as a round dome (aMorphMid, reached at HEAD_MORPH_MID), then, under the glass, flattens into the
 * straight-sided shape it holds in the overview (aMorph).
 */
export const HEAD_MORPH_MID = 0.6;

/** GLSL: the morph attributes and `morphedPosition()` / `morphedNormal()` for the vertex shader. */
export const headMorphVertex = /* glsl */ `
  attribute vec3 aMorph;
  attribute vec3 aMorphNormal;
  attribute vec3 aMorphMid;
  attribute vec3 aMorphMidNormal;
  uniform float uMorph;
  vec3 morphedPosition() {
    return uMorph < ${HEAD_MORPH_MID.toFixed(2)}
      ? mix(position, aMorphMid, uMorph / ${HEAD_MORPH_MID.toFixed(2)})
      : mix(aMorphMid, aMorph, (uMorph - ${HEAD_MORPH_MID.toFixed(2)}) / ${(1 - HEAD_MORPH_MID).toFixed(2)});
  }
  vec3 morphedNormal() {
    return normalize(uMorph < ${HEAD_MORPH_MID.toFixed(2)}
      ? mix(normal, aMorphMidNormal, uMorph / ${HEAD_MORPH_MID.toFixed(2)})
      : mix(aMorphMidNormal, aMorphNormal, (uMorph - ${HEAD_MORPH_MID.toFixed(2)}) / ${(1 - HEAD_MORPH_MID).toFixed(2)}));
  }
`;

/**
 * The head drawn flat white for a silhouette capture, through its morph. A silhouette capture draws
 * everything with the scene's plain white override, which knows nothing of the morph and would draw
 * the closed head in the overview; this keeps itself over the override (`allowOverride` false) and
 * reads the skin's own `morph` uniform. With the head closed (morph 0) it draws exactly what the
 * override does.
 */
export function createHeadSilhouetteMaterial(morph: { value: number }) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uMorph: morph },
    vertexShader: /* glsl */ `
      ${headMorphVertex}
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(morphedPosition(), 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      void main() {
        gl_FragColor = vec4(1.0);
      }
    `,
  });
  material.allowOverride = false;
  return material;
}
