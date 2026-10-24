import * as THREE from 'three';
import type { Palette } from '../config/types';

/**
 * Sucker cups, as in the high-quality panel: a glowing peach rim around a red slit of a hollow,
 * the outer wall running down into the arm's red underside, and a small wet highlight from the
 * key light. Shaded in the cup's own space (radius 1, opening along +z).
 */
export function createSuckerMaterial(palette: Palette, keyDir: THREE.Vector3) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uEdge: { value: new THREE.Color(palette.suckerEdge) },
      uBody: { value: new THREE.Color(palette.suckerBody) },
      uHot: { value: new THREE.Color(palette.suckerHot) },
      uHollow: { value: new THREE.Color(palette.suckerHollow) },
      uKeyDir: { value: keyDir },
      uBoost: { value: 1.22 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocal;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        vec4 world = m * vec4(position, 1.0);
        vLocal = position;
        vN = normalize(mat3(m) * normal);
        vV = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uEdge;
      uniform vec3 uBody;
      uniform vec3 uHot;
      uniform vec3 uHollow;
      uniform vec3 uKeyDir;
      uniform float uBoost;
      varying vec3 vLocal;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        // The bowl's inside faces away from the lathe's outward normals: light whichever side is seen.
        vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
        vec3 V = normalize(vV);
        float r = length(vLocal.xy);
        float h = vLocal.z;
        // A peach face with a small red slit of a hollow at its centre, as in the painting.
        vec3 c = mix(uHollow, uBody, smoothstep(0.16, 0.42, r));
        float rim = smoothstep(0.58, 0.8, r) * smoothstep(0.18, 0.46, h);
        c = mix(c, uHot, rim);
        // The outer wall runs down into the arm's red underside.
        c = mix(c, uEdge, smoothstep(0.92, 1.0, r) * (1.0 - smoothstep(0.05, 0.4, h)));
        // Cups seen edge-on darken a little; cups facing the viewer glow.
        c *= mix(0.72, 1.0, smoothstep(0.0, 0.6, abs(dot(N, V))));
        // A small wet highlight on the rim.
        float spec = pow(max(dot(N, normalize(uKeyDir + V)), 0.0), 40.0);
        c += vec3(1.0, 0.86, 0.8) * spec * 0.55 * rim;
        gl_FragColor = vec4(c * uBoost, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
}
