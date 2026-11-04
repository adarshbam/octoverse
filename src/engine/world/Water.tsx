import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { GlowLightUniforms, GlowReach } from '../character/glowLight';
import { seeded } from './noise';
import { WATER_SKY_ORDER } from './drawOrder';
import { createSnowMaterial } from './particleMaterials';
import type { WaterColours, WorldConfig } from './types';
import { useDisposables } from './useDisposables';
import { useWorldTime } from './worldTime';

/** Open water beyond the ruin: deep navy below, brightening up to the surface's rippling glow. `opening` is how many times brighter the cyan opening at the surface is than in the test scene. */
export function WaterSky({ world, caustics, opening = 1 }: { world: WorldConfig; caustics: THREE.Texture; opening?: number }) {
  const now = useWorldTime();
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uCaustics: { value: caustics },
          uSun: { value: new THREE.Vector3(...world.water.surfaceDir).normalize() },
          uHorizon: { value: new THREE.Color(world.palette.waterFar) },
          uDeep: { value: new THREE.Color(world.water.colours.deep) },
          uZenith: { value: new THREE.Color(world.water.colours.zenith) },
          uGlow: { value: new THREE.Color(world.water.colours.glow) },
          // The opening at the very top of the frame: brighter and leaning toward its own colour, fading in over the upper quarter.
          uOpenGlow: { value: new THREE.Color(world.water.colours.glow).lerp(new THREE.Color(world.water.colours.opening), Math.min(opening - 1, 1)).multiplyScalar(opening) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform sampler2D uCaustics;
          uniform vec3 uSun;
          uniform vec3 uHorizon;
          uniform vec3 uDeep;
          uniform vec3 uZenith;
          uniform vec3 uGlow;
          uniform vec3 uOpenGlow;
          varying vec3 vWorld;
          void main() {
            vec3 d = normalize(vWorld - cameraPosition);
            float e = d.y;
            vec3 c = mix(uHorizon, uDeep, smoothstep(0.0, -0.35, e));
            c = mix(c, uZenith, smoothstep(0.04, 0.6, e));
            float s = max(dot(d, uSun), 0.0);
            // The surface: a broad glow and a hot core, rippling.
            vec3 glow = mix(uGlow, uOpenGlow, smoothstep(0.06, 0.2, e));
            c += glow * (pow(s, 24.0) * 1.1 + pow(s, 90.0) * 2.5);
            vec2 suv = d.xz / max(d.y, 0.06);
            // The surface ripples: the light's caustic net (it tiles), seen from below.
            float rip = max(texture2D(uCaustics, fract(suv * 0.04)).r - 0.18, 0.0) * 0.5;
            c += glow * rip * smoothstep(0.08, 0.3, e) * pow(s, 20.0) * 1.4;
            // Faint far shafts, swaying slowly.
            float shafts = pow(0.5 + 0.5 * sin(d.x * 34.0 + sin(d.x * 6.0 + uTime * 0.17) * 2.5), 8.0);
            c += glow * shafts * 0.05 * smoothstep(-0.02, 0.3, e) * pow(s, 12.0);
            gl_FragColor = vec4(c, 1.0);
          }
        `,
      }),
    [world, caustics, opening],
  );
  const disposables = useMemo(() => [material], [material]);
  useDisposables(disposables);
  useFrame(state => {
    material.uniforms.uTime.value = now(state);
  });
  return (
    <mesh material={material} frustumCulled={false} renderOrder={WATER_SKY_ORDER}>
      <sphereGeometry args={[100, 64, 32]} />
    </mesh>
  );
}

const SHAFT_TOP = new THREE.Vector3(0.6, 13.5, -15);
const SHAFT_COUNT = 9;
/** Shafts fan out from the bright patch of surface: thin, uneven, a few broad ones behind. `spread` times as many, fanning wider. */
const shaftsFor = (spread: number) => {
  const n = Math.round(SHAFT_COUNT * Math.max(spread, 1));
  const rand = seeded(17);
  return Array.from({ length: n }, (_, i) => {
    const across = (i / (n - 1) - 0.5) * (10 + (n - SHAFT_COUNT) * 0.9) + (rand() - 0.5) * 1.1;
    const depth = -2 - rand() * 14;
    const broad = rand() < 0.25;
    return {
      to: [across, -2.4, depth] as [number, number, number],
      radius: broad ? 1.2 + rand() * 0.8 : 0.22 + rand() * 0.45,
      strength: broad ? 0.45 + rand() * 0.3 : 0.7 + rand() * 0.6,
    };
  });
};

/** Shafts of light from the surface, soft-edged, flickering as the ripples above move. `amount` is the share of the shafts drawn, evenly thinned; `colours` are the water's (`rays`, leaning toward `raysWide` as the fan widens). */
export function GodRays({ colours, amount = 1, spread = 1 }: { colours: WaterColours; amount?: number; spread?: number }) {
  const now = useWorldTime();
  const { meshes, material, disposables } = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(colours.rays).lerp(new THREE.Color(colours.raysWide), Math.min(spread - 1, 1) * 0.7) } },
      vertexShader: /* glsl */ `
        attribute float aStrength;
        varying vec3 vN;
        varying vec3 vV;
        varying float vAlong;
        varying vec3 vW;
        varying float vStrength;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - w.xyz);
          vAlong = 1.0 - uv.y;
          vStrength = aStrength;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec3 vN;
        varying vec3 vV;
        varying float vAlong;
        varying vec3 vW;
        varying float vStrength;
        float h(float n) { return fract(sin(n) * 43758.5453); }
        float n1(float x) { float i = floor(x); float f = fract(x); return mix(h(i), h(i + 1.0), f * f * (3.0 - 2.0 * f)); }
        void main() {
          float edge = pow(abs(dot(normalize(vN), normalize(vV))), 3.0);
          float fade = smoothstep(0.0, 0.2, vAlong) * (1.0 - smoothstep(0.35, 0.85, vAlong));
          float flicker = 0.55 + 0.45 * n1(vW.x * 1.3 + vW.z * 0.7 + uTime * 0.35) * n1(vAlong * 3.0 - uTime * 0.12 + vW.x);
          gl_FragColor = vec4(uColor * edge * fade * flicker * vStrength * 0.7, 1.0);
        }
      `,
    });
    const up = new THREE.Vector3(0, -1, 0);
    const kept = shaftsFor(spread).filter((_, i) => Math.floor((i + 1) * amount) > Math.floor(i * amount));
    const meshes = kept.map(({ to, radius, strength }) => {
      const end = new THREE.Vector3(...to);
      const dir = end.clone().sub(SHAFT_TOP);
      const length = dir.length();
      const geometry = new THREE.CylinderGeometry(0.08, radius, length, 24, 1, true);
      geometry.translate(0, -length / 2, 0);
      geometry.setAttribute('aStrength', new THREE.Float32BufferAttribute(new Array(geometry.attributes.position.count).fill(strength), 1));
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(SHAFT_TOP);
      mesh.quaternion.setFromUnitVectors(up, dir.normalize());
      mesh.frustumCulled = false;
      mesh.renderOrder = 5;
      return mesh;
    });
    return { meshes, material, disposables: [material, ...meshes.map(m => m.geometry)] };
  }, [colours, amount, spread]);
  useDisposables(disposables);
  useFrame(state => {
    material.uniforms.uTime.value = now(state);
  });
  return (
    <>
      {meshes.map((m, i) => <primitive key={i} object={m} />)}
    </>
  );
}

const SNOW = 2600;

/** Marine snow: fine flecks drifting down, catching the light from above, fading with distance, in the world's `colour`. `amount` is the share of the flecks drawn. In a world, `glow` tints them with Nox's face glow. */
export function MarineSnow({ colour, amount = 1, glow, reach }: { colour: string; amount?: number; glow?: GlowLightUniforms; reach?: GlowReach }) {
  const now = useWorldTime();
  const { geometry, material, disposables } = useMemo(() => {
    const rand = seeded(5);
    const positions = new Float32Array(SNOW * 3);
    const seeds = new Float32Array(SNOW * 2);
    for (let i = 0; i < SNOW; i++) {
      positions.set([(rand() - 0.5) * 18, -2.4 + rand() * 10, 6 - rand() * 40], i * 3);
      seeds.set([rand(), 0.006 + Math.pow(rand(), 3.5) * 0.03], i * 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 2));
    const material = createSnowMaterial(colour, glow, reach);
    return { geometry, material, disposables: [geometry, material] };
  }, [colour, glow, reach]);
  useDisposables(disposables);
  // A lower amount draws only the first part of the flecks, which are scattered in random order.
  useLayoutEffect(() => geometry.setDrawRange(0, Math.round(SNOW * amount)), [geometry, amount]);
  useFrame(state => {
    const camera = state.camera as THREE.PerspectiveCamera;
    material.uniforms.uTime.value = now(state);
    material.uniforms.uScale.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  });
  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={6} />;
}

const FISH = 16;

/** A loose school far down the ruin, dark against the glow, tails beating. `amount` is the share of the fish drawn; `colour` is theirs (the water's `fish`). */
export function FarFish({ colour, amount = 1 }: { colour: string; amount?: number }) {
  const now = useWorldTime();
  const { mesh, clock, school, disposables } = useMemo(() => {
    const body = new THREE.SphereGeometry(1, 14, 8);
    body.scale(1, 0.34, 0.16);
    const tail = new THREE.BufferGeometry();
    tail.setAttribute('position', new THREE.Float32BufferAttribute([-0.85, 0, 0, -1.45, 0.38, 0, -1.45, -0.38, 0, -0.85, 0, 0, -1.45, -0.38, 0, -1.45, 0.38, 0], 3));
    tail.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1], 3));
    tail.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(12).fill(0), 2));
    const geometry = mergeTwo(body, tail);
    const material = new THREE.MeshBasicMaterial({ color: colour });
    const uTime = { value: 0 };
    material.onBeforeCompile = shader => {
      shader.uniforms.uTime = uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `#include <begin_vertex>
          float beat = sin(uTime * 7.0 + instanceMatrix[3].x * 3.0 + instanceMatrix[3].y * 5.0);
          transformed.z += beat * 0.28 * max(0.0, -position.x - 0.2);`,
        );
    };
    const mesh = new THREE.InstancedMesh(geometry, material, FISH);
    mesh.frustumCulled = false;
    const rand = seeded(91);
    const school = Array.from({ length: FISH }, () => ({
      x: rand() * 16 - 8,
      y: 2.2 + rand() * 2.2,
      z: -22 - rand() * 9,
      s: 0.13 + rand() * 0.08,
      speed: 0.25 + rand() * 0.1,
      phase: rand() * 6.28,
    }));
    return { mesh, clock: { uTime }, school, disposables: [mesh, geometry, material] };
  }, [colour]);
  useDisposables(disposables);
  const m = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    mesh.count = Math.round(FISH * amount);
  }, [mesh, amount]);
  useFrame(state => {
    const t = now(state);
    clock.uTime.value = t;
    school.forEach((f, i) => {
      const x = ((f.x - t * f.speed + 8) % 16 + 16) % 16 - 8;
      m.position.set(x, f.y + Math.sin(t * 0.4 + f.phase) * 0.15, f.z);
      m.rotation.set(0, Math.PI, Math.sin(t * 0.4 + f.phase) * 0.08);
      m.scale.setScalar(f.s);
      m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const ai = a.index ? a.toNonIndexed() : a;
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const x = ai.attributes[name] as THREE.BufferAttribute;
    const y = b.attributes[name] as THREE.BufferAttribute;
    const data = new Float32Array(x.array.length + y.array.length);
    data.set(x.array as Float32Array, 0);
    data.set(y.array as Float32Array, x.array.length);
    out.setAttribute(name, new THREE.BufferAttribute(data, x.itemSize));
  }
  return out;
}
