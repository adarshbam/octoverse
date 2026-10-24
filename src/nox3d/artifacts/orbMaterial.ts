import * as THREE from 'three';

/**
 * A technology orb's glass, as in panel 3: a clear bubble whose rim glows in the logo's colour
 * fading to white at the very edge, with one soft highlight on the upper left. `uOpacity` fades
 * it in with the overview.
 */
export function createOrbMaterial(tint: string) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTint: { value: new THREE.Color(tint) },
      uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint;
      uniform float uOpacity;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec3 N = normalize(vN);
        float ndv = clamp(dot(N, normalize(vV)), 0.0, 1.0);
        float rim = pow(1.0 - ndv, 2.2);
        vec3 col = uTint * 0.08 + mix(uTint, vec3(1.0), pow(1.0 - ndv, 8.0) * 0.6) * rim * 2.1;
        float glint = pow(max(dot(N, normalize(vec3(-0.55, 0.65, 0.55))), 0.0), 60.0);
        col += vec3(1.0) * glint * 0.9;
        float alpha = clamp(0.06 + rim * 0.95 + glint, 0.0, 1.0);
        gl_FragColor = vec4(col, alpha * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}
