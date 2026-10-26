import * as THREE from 'three';

/**
 * Sunlight focused by surface ripples into a moving net of bright lines. Tiles every unit of
 * `uv` (after Dave Hoskins' tileable water caustic). Returns roughly 0..1, mostly dark.
 */
export const causticGlsl = /* glsl */ `
  float causticAt(vec2 uv, float time) {
    const float TAU = 6.28318530718;
    vec2 p = mod(uv * TAU, TAU) - 250.0;
    vec2 i = p;
    float c = 1.0;
    float inten = 0.005;
    for (int n = 0; n < 5; n++) {
      float t = time * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
    }
    c /= 5.0;
    c = 1.17 - pow(c, 1.4);
    return pow(abs(c), 8.0);
  }
`;

/**
 * The surface light's cookie: a texture the spot light's colour is multiplied by, so caustics
 * dance on everything it lights and stop where its shadows fall. Half-float, so the bright lines
 * can push past 1 and bloom.
 */
export function createCaustics(size = 512) {
  const target = new THREE.WebGLRenderTarget(size, size, {
    type: THREE.HalfFloatType,
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
  });
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      /** Caustic tiles across the cookie. */
      uTiles: { value: 7.0 },
      /** Light let through between the lines, and the lines' extra brightness. */
      uBase: { value: 0.18 },
      uGain: { value: 2.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uTiles;
      uniform float uBase;
      uniform float uGain;
      varying vec2 vUv;
      ${causticGlsl}
      void main() {
        vec2 uv = vUv * uTiles;
        // Two layers drifting apart: the net never repeats exactly.
        float a = causticAt(uv + vec2(uTime * 0.012, 0.0), uTime * 0.42 + 23.0);
        float b = causticAt(uv * 1.0 + vec2(0.37, 0.61 - uTime * 0.009), uTime * 0.31 + 11.0);
        float c = a * 0.65 + b * 0.55 + a * b * 1.5;
        gl_FragColor = vec4(vec3(uBase + c * uGain), 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    texture: target.texture,
    uniforms: material.uniforms,
    render(gl: THREE.WebGLRenderer, time: number) {
      // The net moves slowly: redrawn at most 30 times a second.
      if (Math.abs(time - material.uniforms.uTime.value) < 1 / 30 && time !== 0) return;
      material.uniforms.uTime.value = time;
      const previous = gl.getRenderTarget();
      gl.setRenderTarget(target);
      gl.render(scene, camera);
      gl.setRenderTarget(previous);
    },
    dispose() {
      target.dispose();
      material.dispose();
      quad.geometry.dispose();
    },
  };
}
