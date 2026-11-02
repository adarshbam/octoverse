import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { type BakedLight, lightMapOf, reliefOf, withBakedLight } from './bakedLight';
import { SEABED, floorHeight, seabedLightUv } from './seabed';
import { makeCrackMap, makeStoneMaps } from './textures';
import type { WorldConfig } from './types';
import { useDisposables } from './useDisposables';
import { useWorldTime } from './worldTime';

const WIDTH = SEABED.width;
const NEAR_Z = SEABED.nearZ;
const FAR_Z = SEABED.farZ;
/** World units covered by one tile of the crack map (12 cells). */
const CRACK_TILE = 10.4;

const floorGlsl = /* glsl */ `
  varying vec3 vFloorWorld;
  uniform float uTime;
  uniform sampler2D uCracks;
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

/**
 * The seabed: dark wet silt with glowing cracks, brightest in patches and toward the pillars. With
 * the near world `baked`, the light of the glyphs, the lava and the fill comes from its lightmap.
 */
export function Floor({ world, baked = null }: { world: WorldConfig; baked?: BakedLight | null }) {
  const now = useWorldTime();
  const { geometry, material, time, disposables } = useMemo(() => {
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
    const cracks = makeCrackMap();
    const reliefMap = baked && lightMapOf(baked.reliefMaps.seabed);
    const material = new THREE.MeshStandardMaterial({
      color: world.palette.floor,
      roughness: 0.62,
      metalness: 0,
      // Wet stone mirrors the red glows round it more than the far-off surface.
      envMapIntensity: 0.2,
      map: maps.tone,
      normalMap: maps.normal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      lightMap: baked && lightMapOf(baked.atlases.seabed),
      lightMapIntensity: baked?.record.intensity ?? 1,
    });
    material.onBeforeCompile = shader => {
      shader.uniforms.uTime = time;
      shader.uniforms.uCracks = { value: cracks };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFloorWorld;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vFloorWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      withBakedLight(shader, baked && reliefMap ? reliefOf(baked, reliefMap) : null);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${floorGlsl}`)
        .replace(
          '#include <roughnessmap_fragment>',
          /* glsl */ `#include <roughnessmap_fragment>
          // Wet patches: smooth enough to mirror the glow round them.
          float puddle = smoothstep(0.62, 0.7, fnoise(vFloorWorld.xz * 0.42 + 7.3) * 0.7 + fnoise(vFloorWorld.xz * 1.1) * 0.3);
          roughnessFactor = mix(roughnessFactor, 0.12, puddle);`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          /* glsl */ `#include <emissivemap_fragment>
          {
            vec2 wp = vFloorWorld.xz;
            vec4 cracks = texture2D(uCracks, wp / ${CRACK_TILE.toFixed(2)});
            float crack = cracks.r;
            float halo = cracks.g;
            float patchy = smoothstep(0.58, 0.76, fnoise(wp * 0.21 + 3.1) * 0.65 + fnoise(wp * 0.53 + 1.7) * 0.35);
            float side = smoothstep(1.5, 3.6, abs(wp.x));
            float amount = max(patchy, side * 0.85);
            float pulse = 0.72 + 0.28 * sin(uTime * 0.9 + wp.x * 1.7 + wp.y * 0.9);
            totalEmissiveRadiance += vec3(1.0, 0.09, 0.05) * amount * pulse * (crack * 3.4 + halo * (0.25 + 1.4 * side));
            // Lava under the rubble at the sides: a broad glow, strongest near the lens.
            float lava = smoothstep(2.0, 4.5, abs(wp.x)) * smoothstep(-8.0, 1.0, wp.y);
            totalEmissiveRadiance += vec3(1.0, 0.12, 0.04) * lava * pulse * 0.12;
            // Puddles mirror that glow: a red sheen, stronger toward the sides.
            totalEmissiveRadiance += vec3(1.0, 0.1, 0.05) * puddle * (0.03 + 0.12 * side);
          }`,
        );
    };
    const owned = [geometry, material, maps.normal, maps.tone, cracks, ...(material.lightMap ? [material.lightMap] : []), ...(reliefMap ? [reliefMap] : [])];
    return { geometry, material, time, disposables: owned };
  }, [world, baked]);
  useDisposables(disposables);
  useFrame(state => {
    time.value = now(state);
  });
  return <mesh geometry={geometry} material={material} receiveShadow />;
}
