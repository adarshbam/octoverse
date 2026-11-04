import * as THREE from 'three';
import type { DomeShape, Palette } from '../config/types';
import { glslColour } from '../world/colour';

/**
 * How far the reveal must travel to show the whole dome: the reveal front is an ellipse growing
 * from the dome's seat (the middle of its lower edge, where it meets the head), measured in
 * half-widths across and full heights up, so a top corner is sqrt(2) away; a little more covers
 * the soft front.
 */
export const DOME_REACH = 1.5;

/**
 * The dome at a given openness (0..1, already eased): it keeps its full size and its place over
 * the face, so it never becomes a shrinking, sliding lid; instead its glass is revealed outward
 * from its seat on the head (`reveal`, in reach units), fading in over the first moments.
 */
export function domeState(open: number) {
  const o = Math.min(1, Math.max(0, open));
  return {
    visible: o > 0.001,
    scale: 1,
    offset: 0,
    reveal: o * DOME_REACH,
    opacity: Math.min(1, o / 0.12),
  };
}

/**
 * The overview dome's glass, as in panel 3: a dark, see-through violet body (alpha 0.55 face-on),
 * a hot pink rim, softer pink over the crown, a bright line along its lower edge where it sits on
 * the face, and a soft reflection band across the inside near the top. While the head opens or
 * closes, only the glass within `uReveal` of its seat shows, behind a glowing front, so the dome
 * blooms out of the crown and folds back into it (see domeState).
 */
export function createDomeMaterial(palette: Palette, dome: DomeShape) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTint: { value: new THREE.Color(palette.domeTint) },
      uRim: { value: new THREE.Color(palette.domeRim) },
      uRimTop: { value: new THREE.Color(palette.domeRimTop) },
      uSheen: { value: new THREE.Color(palette.domeSheen) },
      uHalfHeight: { value: dome.halfHeight },
      uHalfWidth: { value: dome.halfWidth },
      uOpacity: { value: 0 },
      uReveal: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vLocal;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - world.xyz);
        vLocal = position;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint;
      uniform vec3 uRim;
      uniform vec3 uRimTop;
      uniform vec3 uSheen;
      uniform float uHalfHeight;
      uniform float uHalfWidth;
      uniform float uOpacity;
      uniform float uReveal;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vLocal;
      void main() {
        float ndv = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
        float up = clamp(vLocal.y / uHalfHeight * 0.5 + 0.5, 0.0, 1.0);
        vec3 rim = mix(uRim, uRimTop, smoothstep(0.6, 0.98, up));
        vec3 col = uTint + rim * (pow(1.0 - ndv, 4.0) * 2.4 + pow(1.0 - ndv, 12.0) * 1.6);
        // The inner reflection band, a little below the crown, faint where the glass faces the viewer.
        float band = smoothstep(0.7, 0.77, up) * (1.0 - smoothstep(0.82, 0.9, up));
        col += uSheen * band * 0.16 * smoothstep(0.15, 0.6, ndv);
        // The lower edge, where the dome sits on the face, glows as one bright line.
        float seat = 1.0 - smoothstep(0.0, 0.1, up);
        col += uRim * seat * 1.4;
        float alpha = max(mix(0.55, 0.98, pow(1.0 - ndv, 3.0)), seat);

        // The reveal: distance from the seat, in half-widths across and full heights up. Glass
        // beyond the front is not there yet; just inside it, a glowing band leads the way, gone
        // once the dome is whole.
        float m = length(vec2(vLocal.x / uHalfWidth, (vLocal.y + uHalfHeight) / (2.0 * uHalfHeight)));
        float shown = 1.0 - smoothstep(uReveal - 0.07, uReveal, m);
        float front = exp(-pow((m - (uReveal - 0.05)) / 0.035, 2.0)) * (1.0 - smoothstep(1.3, ${DOME_REACH.toFixed(2)}, uReveal));
        col += mix(uRim, ${glslColour(palette.domeRimHot)}, 0.35) * front * 1.8;
        alpha = max(alpha, front * 0.9) * shown;
        gl_FragColor = vec4(col, alpha * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}
