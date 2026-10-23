import * as THREE from 'three';
import type { CharacterConfig } from '../config/types';

/**
 * Mantle colour ramp texture: raw sRGB bytes, tagged sRGB so the GPU decodes
 * them once. Stops are (glow strength, hex) sampled from the reference.
 */
export function createRampTexture(stops: readonly (readonly [number, string])[]) {
  const size = 256;
  const data = new Uint8Array(size * 4);
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

export type SkinUniforms = ReturnType<typeof createSkinUniforms>;

/** One uniform set per character, shared by every skin surface so glow moves together. */
export function createSkinUniforms(config: CharacterConfig) {
  const { palette: p, glow } = config;
  const color = (hex: string) => ({ value: new THREE.Color(hex) });
  const [[lx, ly], [rx, ry]] = config.face.eye.centers;
  return {
    /** Eye sockets in head-local units: both centres (x, y, x, y) and the eye radii. */
    uEyeCenters: { value: new THREE.Vector4(lx, ly, rx, ry) },
    uEyeRadii: { value: new THREE.Vector2(config.face.eye.rx, config.face.eye.ry) },
    uGlowRamp: { value: createRampTexture(glow.ramp) },
    uGlowPos: { value: new THREE.Vector3(...glow.center) },
    /** Face glow extent: x spread, upward reach, downward reach. */
    uGlowShape: { value: new THREE.Vector3(glow.spreadX, glow.reachUp, glow.reachDown) },
    uGlowStrength: { value: 1.0 },
    uArmShadow: color(p.armShadow),
    uArmMid: color(p.armMid),
    uArmLit: color(p.armLit),
    uArmGlow: color(p.armGlow),
    uBelly: color(p.belly),
    uRimTop: color(p.rimTop),
    uRimLow: color(p.rimLow),
    uSky: color(p.sky),
    uHeadEdge: color(p.headEdge),
    uCheek: color(p.cheek),
    uSpeck: color(p.speck),
    uKeyDir: { value: new THREE.Vector3(-0.45, 0.8, 0.55).normalize() },
  };
}

const skinVertex = /* glsl */ `
  attribute float aUnder;
  attribute float aU;
  attribute vec2 aSpeck;
  uniform vec4 uFaceRect;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vUnder;
  varying float vU;
  varying vec2 vSpeck;
  varying vec2 vFaceUv;
  varying float vFront;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    #ifdef ARM
      vUnder = aUnder;
      vU = aU;
      vSpeck = aSpeck;
    #else
      vUnder = 0.0;
      vU = 1.0;
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
  uniform vec4 uFaceRect;
  uniform vec4 uEyeCenters;
  uniform vec2 uEyeRadii;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vUnder;
  varying float vU;
  varying vec2 vSpeck;
  varying vec2 vFaceUv;
  varying float vFront;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    // Webs render double-sided; light the side the camera sees.
    vec3 N = normalize(vNormalW) * (gl_FrontFacing ? 1.0 : -1.0);
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
      vec3 mantle = texture2D(uGlowRamp, vec2(clamp(faceGlow, 0.0, 1.0), 0.5)).rgb;
      mantle = mix(mantle, uCheek, smoothstep(-0.3, -0.72, vWorld.y) * 0.85 * (1.0 - smoothstep(0.3, 0.7, faceGlow)));
      float join = 1.0 - smoothstep(0.05, 0.28, vU);
      col = mix(col, mantle, join);
      vec3 rim = mix(uRimLow, uRimTop, smoothstep(0.45, 0.9, up) * (1.0 - under));
      col += rim * pow(1.0 - ndv, 2.6) * (0.4 + 1.0 * smoothstep(0.3, 0.8, up)) * 1.9 * (1.0 - join);
      col += uRimTop * pow(max(N.y, 0.0), 3.0) * 0.32 * (1.0 - under);
      col += uRimLow * pow(1.0 - ndv, 7.0) * 0.9 * (1.0 - join);
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
      // Rim and edge colour run down around the cheeks, and fade out on the neck between the arms.
      float belowChin = smoothstep(uGlowPos.y - 0.05, uGlowPos.y + 0.15, vWorld.y);
      col += uHeadEdge * pow(1.0 - ndv, 2.0) * 0.32 * (1.0 - faceGlow) * belowChin;
      col += rim * pow(1.0 - ndv, 6.0) * 3.2 * (1.0 - faceGlow * 0.6) * mix(0.6, 1.0, smoothstep(-0.45, 0.1, vWorld.y)) * belowChin;
      // Crown sheen: a tight highlight toward the upper left; the forehead stays dark navy.
      col += uHeadEdge * pow(max(dot(N, normalize(vec3(-0.5, 0.7, 0.5))), 0.0), 14.0) * 0.22 * (1.0 - faceGlow);
      vec2 cell = floor(vSpeck);
      vec2 f = fract(vSpeck) - 0.5;
      vec2 jitter = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
      float size = mix(0.07, 0.2, hash(cell + 1.7));
      float speck = smoothstep(size, size * 0.4, length(f - jitter * 0.55)) * step(0.8, hash(cell));
      col += uSpeck * speck * (1.0 - faceGlow) * 0.14;
    #endif

    #ifdef HEAD
      // Eye sockets: the skin darkens (at most 18%) within 1.25x each eye's radii, so the eyes sit in the face.
      vec2 local = vFaceUv * uFaceRect.zw + uFaceRect.xy;
      vec2 radii = uEyeRadii * 1.25;
      float socket = max(
        1.0 - smoothstep(0.55, 1.0, length((local - uEyeCenters.xy) / radii)),
        1.0 - smoothstep(0.55, 1.0, length((local - uEyeCenters.zw) / radii)));
      col *= 1.0 - 0.18 * socket * smoothstep(0.05, 0.3, vFront);
      vec4 face = texture2D(uFace, vFaceUv);
      float inside = step(0.0, vFaceUv.x) * step(vFaceUv.x, 1.0) * step(0.0, vFaceUv.y) * step(vFaceUv.y, 1.0);
      float mask = face.a * inside * smoothstep(0.05, 0.3, vFront);
      col = mix(col, face.rgb, mask);
    #endif
    gl_FragColor = vec4(col, 1.0);
  }
`;

export type SkinKind = 'HEAD' | 'ARM' | 'BODY';

export function createSkinMaterial(kind: SkinKind, uniforms: SkinUniforms, face?: { texture: THREE.Texture; rect: THREE.Vector4 }) {
  return new THREE.ShaderMaterial({
    defines: { [kind]: '' },
    uniforms: {
      ...uniforms,
      uFace: { value: face?.texture ?? null },
      uFaceRect: { value: face?.rect ?? new THREE.Vector4(0, 0, 1, 1) },
    },
    vertexShader: skinVertex,
    fragmentShader: skinFragment,
  });
}
