import * as THREE from 'three';
import type { Palette } from '../config/types';

/** Suckers read as soft glowing coral beads: hot where they face the viewer, deeper red at the edge. */
export function createSuckerMaterial(palette: Palette) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uEdge: { value: new THREE.Color(palette.suckerEdge) },
      uBody: { value: new THREE.Color(palette.suckerBody) },
      uHot: { value: new THREE.Color(palette.suckerHot) },
      uBoost: { value: 1.9 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        vec4 world = m * vec4(position, 1.0);
        vN = normalize(mat3(m) * normal);
        vV = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uEdge;
      uniform vec3 uBody;
      uniform vec3 uHot;
      uniform float uBoost;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float facing = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
        vec3 c = mix(uEdge, uBody, smoothstep(0.05, 0.55, facing));
        c = mix(c, uHot, smoothstep(0.7, 1.0, facing) * 0.6);
        gl_FragColor = vec4(c * uBoost, 1.0);
      }
    `,
  });
}
