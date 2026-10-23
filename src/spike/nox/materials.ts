import * as THREE from 'three';

/**
 * Mantle colour as a function of the face glow g (0 = unlit, 1 = glow centre),
 * sampled down the centre line of panel 2 (scripts/profile.py).
 */
const GLOW_RAMP: [number, string][] = [
  [0, '#0a0d2c'], [0.07, '#1e0c30'], [0.17, '#45133e'], [0.27, '#641542'], [0.37, '#891d45'],
  [0.49, '#b9254b'], [0.61, '#e8364d'], [0.74, '#fb5254'], [0.94, '#fd7c5b'], [1, '#ff8765'],
];

function createRampTexture(stops: [number, string][]) {
  const size = 256;
  const data = new Uint8Array(size * 4);
  // Raw sRGB bytes; the texture is tagged sRGB so the GPU decodes them once.
  const colors = stops.map(([at, hex]) => [at, [1, 3, 5].map(o => parseInt(hex.slice(o, o + 2), 16))] as const);
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    let k = 0;
    while (k < colors.length - 2 && t > colors[k + 1][0]) k++;
    const [a, ca] = colors[k];
    const [b, cb] = colors[k + 1];
    const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
    data.set([0, 1, 2].map(c => Math.round(ca[c] + (cb[c] - ca[c]) * u)).concat(255), i * 4);
  }
  const texture = new THREE.DataTexture(data, size, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Shared look for every Nox skin surface. One object, so updating glow position moves it for all. */
export const skinUniforms = {
  uGlowRamp: { value: createRampTexture(GLOW_RAMP) },
  uGlowPos: { value: new THREE.Vector3(0.05, -0.97, 0.6) },
  /** Face glow extent: x spread, upward reach, downward reach. */
  uGlowShape: { value: new THREE.Vector3(0.42, 0.45, 0.2) },
  uGlowStrength: { value: 1.0 },
  uArmShadow: { value: new THREE.Color('#1c0628') },
  uArmMid: { value: new THREE.Color('#2c0f48') },
  uArmLit: { value: new THREE.Color('#4c2a7e') },
  uArmGlow: { value: new THREE.Color('#ff4a5a') },
  uBelly: { value: new THREE.Color('#d0244e') },
  uRimTop: { value: new THREE.Color('#b46ad0') },
  uRimLow: { value: new THREE.Color('#e04a96') },
  uSky: { value: new THREE.Color('#3a48c8') },
  uHeadEdge: { value: new THREE.Color('#5c2a8c') },
  /** Magenta-purple of the lower cheeks outside the glow (panel 2, x = -0.55). */
  uCheek: { value: new THREE.Color('#7b1d59') },
  uSpeck: { value: new THREE.Color('#b9a6f2') },
  uKeyDir: { value: new THREE.Vector3(-0.45, 0.8, 0.55).normalize() },
};

const skinVertex = /* glsl */ `
  attribute float aUnder;
  attribute vec2 aSpeck;
  uniform vec4 uFaceRect;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vUnder;
  varying vec2 vSpeck;
  varying vec2 vFaceUv;
  varying float vFront;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    #ifdef ARM
      vUnder = aUnder;
      vSpeck = aSpeck;
    #else
      vUnder = 0.0;
      vSpeck = uv * vec2(46.0, 26.0);
    #endif
    vFaceUv = (position.xy - uFaceRect.xy) / uFaceRect.zw;
    vFront = normal.z;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const skinFragment = /* glsl */ `
  uniform sampler2D uGlowRamp;
  uniform vec3 uGlowPos;
  uniform vec3 uGlowShape;
  uniform float uGlowStrength;
  uniform vec3 uArmShadow;
  uniform vec3 uArmMid;
  uniform vec3 uArmLit;
  uniform vec3 uArmGlow;
  uniform vec3 uBelly;
  uniform vec3 uRimTop;
  uniform vec3 uRimLow;
  uniform vec3 uSky;
  uniform vec3 uHeadEdge;
  uniform vec3 uCheek;
  uniform vec3 uSpeck;
  uniform vec3 uKeyDir;
  uniform sampler2D uFace;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vUnder;
  varying vec2 vSpeck;
  varying vec2 vFaceUv;
  varying float vFront;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vWorld);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    vec2 d = vWorld.xy - uGlowPos.xy;
    float sy = d.y > 0.0 ? uGlowShape.y : uGlowShape.z;
    float faceGlow = exp(-(d.x * d.x) / (uGlowShape.x * uGlowShape.x) - (d.y * d.y) / (sy * sy)) * uGlowStrength;
    float fres = pow(1.0 - ndv, 3.0);
    float up = N.y * 0.5 + 0.5;
    vec3 col;

    #ifdef ARM
      float under = smoothstep(0.25, 0.95, vUnder);
      col = mix(uArmShadow, uArmMid, smoothstep(0.0, 0.5, up));
      col = mix(col, uArmLit, smoothstep(0.5, 1.0, up));
      vec3 toGlow = uGlowPos - vWorld;
      float near = exp(-dot(toGlow, toGlow) / 0.14);
      col = mix(col, uArmGlow * 0.75, near * 0.45);
      col = mix(col, uBelly, under * 0.62);
      col += uBelly * pow(under, 2.0) * 0.35;
      vec3 rootGlow = texture2D(uGlowRamp, vec2(clamp(faceGlow * 0.9, 0.0, 1.0), 0.5)).rgb;
      col = mix(col, rootGlow, smoothstep(0.3, 0.8, faceGlow) * 0.7);
      vec3 rim = mix(uRimLow, uRimTop, smoothstep(0.45, 0.9, up) * (1.0 - under));
      col += rim * pow(1.0 - ndv, 2.6) * (0.4 + 1.0 * smoothstep(0.3, 0.8, up)) * 1.9;
      col += uRimTop * pow(max(N.y, 0.0), 3.0) * 0.32 * (1.0 - under);
      col += uRimLow * pow(1.0 - ndv, 7.0) * 0.9;
      vec2 cell = floor(vSpeck);
      vec2 f = fract(vSpeck) - 0.5;
      vec2 jitter = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
      float size = mix(0.06, 0.18, hash(cell + 1.7));
      float speck = smoothstep(size, size * 0.4, length(f - jitter * 0.55)) * step(0.72, hash(cell));
      col += uSpeck * speck * (1.0 - under) * (1.0 - near) * 0.12;
    #else
      col = texture2D(uGlowRamp, vec2(clamp(faceGlow, 0.0, 1.0), 0.5)).rgb;
      col = mix(col, uCheek, smoothstep(-0.3, -0.72, vWorld.y) * 0.85 * (1.0 - smoothstep(0.3, 0.7, faceGlow)));
      col += uSky * pow(max(N.y, 0.0), 4.0) * 0.3 * (1.0 - faceGlow);
      col += uRimTop * pow(max(N.y, 0.0), 10.0) * pow(1.0 - ndv, 1.5) * 0.5;
      vec3 rim = mix(uRimLow, uRimTop, smoothstep(-0.25, 0.2, vWorld.y - uGlowPos.y - 0.9));
      col += uHeadEdge * pow(1.0 - ndv, 2.0) * 0.32 * (1.0 - faceGlow);
      col += rim * pow(1.0 - ndv, 6.0) * 3.2 * (1.0 - faceGlow * 0.6) * mix(0.6, 1.0, smoothstep(-0.45, 0.1, vWorld.y));
      col += uHeadEdge * pow(max(dot(N, normalize(vec3(-0.5, 0.7, 0.5))), 0.0), 6.0) * 0.28 * (1.0 - faceGlow);
      vec2 cell = floor(vSpeck);
      vec2 f = fract(vSpeck) - 0.5;
      vec2 jitter = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
      float size = mix(0.07, 0.2, hash(cell + 1.7));
      float speck = smoothstep(size, size * 0.4, length(f - jitter * 0.55)) * step(0.8, hash(cell));
      col += uSpeck * speck * (1.0 - faceGlow) * 0.14;
    #endif

    #ifdef HEAD
      vec4 face = texture2D(uFace, vFaceUv);
      float inside = step(0.0, vFaceUv.x) * step(vFaceUv.x, 1.0) * step(0.0, vFaceUv.y) * step(vFaceUv.y, 1.0);
      float mask = face.a * inside * smoothstep(0.05, 0.3, vFront);
      col = mix(col, face.rgb, mask);
    #endif
    gl_FragColor = vec4(col, 1.0);
  }
`;

export type SkinKind = 'HEAD' | 'ARM' | 'BODY';

export function createSkinMaterial(kind: SkinKind, face?: { texture: THREE.Texture; rect: THREE.Vector4 }) {
  return new THREE.ShaderMaterial({
    defines: { [kind]: '' },
    uniforms: {
      ...skinUniforms,
      uFace: { value: face?.texture ?? null },
      uFaceRect: { value: face?.rect ?? new THREE.Vector4(0, 0, 1, 1) },
    },
    vertexShader: skinVertex,
    fragmentShader: skinFragment,
  });
}

/** Suckers read as soft glowing coral beads: hot where they face the viewer, deeper red at the edge. */
export function createSuckerMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uEdge: { value: new THREE.Color('#b0183a') },
      uBody: { value: new THREE.Color('#ff4a46') },
      uHot: { value: new THREE.Color('#ff9a7a') },
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

/** Additive soft disc, used for glows that should bloom. */
export function createGlowMaterial(color: string, strength: number, falloff = 2.2) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength }, uFalloff: { value: falloff } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      uniform float uFalloff;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = pow(clamp(1.0 - d, 0.0, 1.0), uFalloff);
        gl_FragColor = vec4(uColor * uStrength, a);
      }
    `,
  });
}
