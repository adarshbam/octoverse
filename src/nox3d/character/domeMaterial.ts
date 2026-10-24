import * as THREE from 'three';
import type { DomeShape, Palette } from '../config/types';

/**
 * The overview dome's glass, as in panel 3: a dark, see-through violet body (alpha 0.55 face-on),
 * a hot pink rim, softer pink over the crown, a bright line along its lower edge where it sits on
 * the face, and a soft reflection band across the inside near the top. `uOpacity` fades it in as
 * the head opens.
 */
export function createDomeMaterial(palette: Palette, dome: DomeShape) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTint: { value: new THREE.Color(palette.domeTint) },
      uRim: { value: new THREE.Color(palette.domeRim) },
      uRimTop: { value: new THREE.Color(palette.domeRimTop) },
      uSheen: { value: new THREE.Color(palette.domeSheen) },
      uHalfHeight: { value: dome.halfHeight },
      uOpacity: { value: 0 },
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
      uniform float uOpacity;
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
        gl_FragColor = vec4(col, alpha * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}
