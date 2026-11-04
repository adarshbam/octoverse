import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useInstance } from '../host/instanceContext';
import { type BakedLight, lightMapOf, reliefOf, withBakedLight } from './bakedLight';
import { SEABED_ORDER } from './drawOrder';
import { SEABED, floorHeight, seabedLightUv } from './seabed';
import { floorGlowGlsl } from './floorGlow';
import { DEFAULT_FLOOR } from './floors';
import { mossShading } from './floors/moss';
import { makeCrackMap, makeStoneMaps } from './textures';
import type { WorldConfig } from './types';
import { useDisposables } from './useDisposables';
import { LAVA_PULSE_GLSL, useMotionAmount } from './liveMotion';
import { useWorldTime } from './worldTime';

const WIDTH = SEABED.width;
const NEAR_Z = SEABED.nearZ;
const FAR_Z = SEABED.farZ;
/** World units covered by one tile of the crack map (12 cells). */
const CRACK_TILE = 10.4;

// `#define uMotion uMotionV.x`: the shared lava term (LAVA_PULSE_GLSL) reads `uMotion`, while the
// floor's uniform is a vec2 (x is the amount), so the name is an alias over its x.
const floorGlsl = /* glsl */ `
  varying vec3 vFloorWorld;
  uniform float uTime;
  uniform vec2 uMotionV;
  #define uMotion uMotionV.x
  uniform sampler2D uCracks;
  uniform sampler2D uFloorNoise;
  vec2 fhash22(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }
  float fnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = fhash22(i).x;
    float b = fhash22(i + vec2(1.0, 0.0)).x;
    float c = fhash22(i + vec2(0.0, 1.0)).x;
    float d = fhash22(i + vec2(1.0, 1.0)).x;
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float ffbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * fnoise(p); p *= 2.03; a *= 0.5; }
    return v / 0.9375;
  }
`;

/** Texels per world unit in the baked noise: the finest feature (a wavelength of about 0.9 units) spans 14. */
const NOISE_TEXELS = 16;
const NOISE_COLS = Math.round(WIDTH * NOISE_TEXELS);
const NOISE_ROWS = Math.round((NEAR_Z - FAR_Z) * NOISE_TEXELS);

/**
 * The seabed's two value-noise fields (the puddles' and the lava patches', before their
 * thresholds), drawn once into a texture with the same GLSL the floor used per pixel, so the
 * pattern is the one the floor always had. Red: the puddles' mix; green: the patches'. The
 * floor then reads one texture instead of computing four noises for every pixel.
 */
const NOISE_BAKE_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  ${floorGlsl.replace(/varying vec3 vFloorWorld;|uniform float uTime;|uniform vec2 uMotionV;|#define uMotion uMotionV.x|uniform sampler2D uCracks;|uniform sampler2D uFloorNoise;/g, '')}
  void main() {
    vec2 wp = vec2(${(-WIDTH / 2).toFixed(1)} + vUv.x * ${WIDTH.toFixed(1)}, ${FAR_Z.toFixed(1)} + vUv.y * ${(NEAR_Z - FAR_Z).toFixed(1)});
    float puddle = fnoise(wp * 0.42 + 7.3) * 0.7 + fnoise(wp * 1.1) * 0.3;
    float patchy = fnoise(wp * 0.21 + 3.1) * 0.65 + fnoise(wp * 0.53 + 1.7) * 0.35;
    gl_FragColor = vec4(puddle, patchy, 0.0, 1.0);
  }
`;

function makeNoiseTarget() {
  const target = new THREE.WebGLRenderTarget(NOISE_COLS, NOISE_ROWS, { depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  target.texture.colorSpace = THREE.NoColorSpace;
  return target;
}

function bakeNoise(gl: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget) {
  const material = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: NOISE_BAKE_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene().add(quad);
  const previous = gl.getRenderTarget();
  gl.setRenderTarget(target);
  gl.render(scene, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
  gl.setRenderTarget(previous);
  quad.geometry.dispose();
  material.dispose();
}

/**
 * The seabed: dark wet silt with glowing cracks, brightest in patches and toward the pillars. With
 * the near world `baked`, the light of the glyphs, the lava and the fill comes from its lightmap.
 */
export function Floor({ world, baked = null }: { world: WorldConfig; baked?: BakedLight | null }) {
  const now = useWorldTime();
  const motionAmount = useMotionAmount();
  const gl = useThree(state => state.gl);
  const { reliefGate } = useInstance();
  // The noise is drawn before the first frame, and again if the context is restored.
  const noise = useMemo(() => makeNoiseTarget(), []);
  useLayoutEffect(() => {
    bakeNoise(gl, noise);
    // A lost WebGL context takes the target's pixels with it: draw them again once it is restored
    // (three.js's own listener, added first, has by then rebuilt its state).
    const redraw = () => bakeNoise(gl, noise);
    gl.domElement.addEventListener('webglcontextrestored', redraw);
    return () => gl.domElement.removeEventListener('webglcontextrestored', redraw);
  }, [gl, noise]);
  useDisposables(useMemo(() => [noise], [noise]));
  const { geometry, material, time, motion, disposables } = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(WIDTH, NEAR_Z - FAR_Z, ...SEABED.segments);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0, (NEAR_Z + FAR_Z) / 2);
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, floorHeight(pos.getX(i), pos.getZ(i), world.layout.floorY));
    geometry.computeVertexNormals();
    if (baked) {
      const uv1 = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) uv1.set(seabedLightUv(pos.getX(i), pos.getZ(i)), i * 2);
      geometry.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
    }
    const maps = makeStoneMaps(41, { period: 8, strength: 3.5, pits: 0.25 });
    const tiles = new THREE.Vector2(WIDTH / 2.2, (NEAR_Z - FAR_Z) / 2.2);
    maps.normal.repeat.copy(tiles);
    maps.tone.repeat.copy(tiles);
    const time = { value: 0 };
    const motion = new THREE.Vector2(1, 0);
    const glow = world.glow.floor;
    const floorGlow = floorGlowGlsl(world.palette.floorGlow, glow);
    // The lava floor is Nox's: the cracks' glow and lava. The moss floor shades patches of moss and glows nowhere.
    const moss = (world.floor?.material ?? DEFAULT_FLOOR) === 'moss';
    const cracks = moss ? null : makeCrackMap();
    const reliefMap = baked && lightMapOf(baked.reliefMaps.seabed);
    const material = new THREE.MeshStandardMaterial({
      color: world.palette.floor,
      roughness: 0.62,
      metalness: 0,
      // Wet stone mirrors the glows round it more than the far-off surface.
      envMapIntensity: 0.08,
      map: maps.tone,
      normalMap: maps.normal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      lightMap: baked && lightMapOf(baked.atlases.seabed),
      lightMapIntensity: baked?.record.intensity ?? 1,
    });
    material.onBeforeCompile = shader => {
      shader.uniforms.uTime = time;
      shader.uniforms.uMotionV = { value: motion };
      if (cracks) shader.uniforms.uCracks = { value: cracks };
      shader.uniforms.uFloorNoise = { value: noise.texture };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFloorWorld;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vFloorWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      withBakedLight(shader, baked && reliefMap ? reliefOf(baked, reliefMap) : null, reliefGate);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${floorGlsl}`)
        .replace(
          '#include <roughnessmap_fragment>',
          /* glsl */ `#include <roughnessmap_fragment>
          // Wet patches: smooth enough to mirror the glow round them.
          vec2 floorNoise = texture2D(uFloorNoise, vec2(vFloorWorld.x * ${(1 / WIDTH).toFixed(6)} + 0.5, (vFloorWorld.z - ${FAR_Z.toFixed(1)}) * ${(1 / (NEAR_Z - FAR_Z)).toFixed(6)})).rg;
          float puddle = smoothstep(0.62, 0.7, floorNoise.x);
          roughnessFactor = mix(roughnessFactor, 0.12, puddle);${moss ? mossShading(String(world.palette.moss)) : ''}`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          moss ? '#include <emissivemap_fragment>' : /* glsl */ `#include <emissivemap_fragment>
          {
            vec2 wp = vFloorWorld.xz;
            vec4 cracks = texture2D(uCracks, wp / ${CRACK_TILE.toFixed(2)});
            float crack = cracks.r;
            float halo = cracks.g;
            float patchy = smoothstep(0.58, 0.76, floorNoise.y);
            float side = smoothstep(1.5, 3.6, abs(wp.x));
            float amount = max(patchy, side * 0.85);
            // The lava pulses slowly (liveMotion.ts); held still it keeps its mean.
            float pulse = ${LAVA_PULSE_GLSL};
            totalEmissiveRadiance += ${floorGlow.cracks} * amount * pulse * (crack * 3.4 + halo * (0.25 + 1.4 * side)) * ${glow.toFixed(2)};
            // Lava under the rubble at the sides: a broad glow, strongest near the lens.
            float lava = smoothstep(2.0, 4.5, abs(wp.x)) * smoothstep(-8.0, 1.0, wp.y);
            totalEmissiveRadiance += ${floorGlow.lava} * lava * pulse * 0.12 * ${glow.toFixed(2)};
            ${floorGlow.sheen}
          }`,
        );
    };
    const owned = [geometry, material, maps.normal, maps.tone, ...(cracks ? [cracks] : []), ...(material.lightMap ? [material.lightMap] : []), ...(reliefMap ? [reliefMap] : [])];
    return { geometry, material, time, motion, disposables: owned };
  }, [world, baked, noise, reliefGate]);
  useDisposables(disposables);
  useFrame(state => {
    time.value = now(state);
    motion.set(motionAmount, 0);
  });
  return <mesh geometry={geometry} material={material} receiveShadow renderOrder={SEABED_ORDER} />;
}
