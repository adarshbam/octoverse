import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { seeded } from './noise';
import { useDisposables } from './useDisposables';
import { useWorldTime } from './worldTime';

const COUNT = 900;

/**
 * Red motes rising off the glowing seabed, thickest round the pillars' feet and the lower
 * corners; the nearest are big and soft, out of focus in front of the lens. `amount` is the
 * share of the motes drawn.
 */
export function Motes({ amount = 1 }: { amount?: number }) {
  const now = useWorldTime();
  const { geometry, material, disposables } = useMemo(() => {
    const rand = seeded(61);
    const positions = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const side = rand() < 0.5 ? -1 : 1;
      const where = rand();
      let x: number;
      let y: number;
      let z: number;
      if (where < 0.45) {
        // Round the near pillars, up their faces.
        x = side * (2.6 + rand() * 1.8);
        y = -2.4 + Math.pow(rand(), 1.6) * 5.5;
        z = 1.2 - rand() * 8;
      } else if (where < 0.8) {
        // The lower corners, close to the lens.
        x = side * (1.6 + rand() * 3.2);
        y = -2.4 + Math.pow(rand(), 2) * 2.2;
        z = 0.5 + rand() * 4.5;
      } else {
        // Thinly along the seabed toward the far end.
        x = (rand() - 0.5) * 7;
        y = -2.4 + Math.pow(rand(), 2.5) * 2.5;
        z = -2 - rand() * 20;
      }
      positions.set([x, y, z], i * 3);
      seeds.set([rand(), 0.01 + Math.pow(rand(), 4) * 0.05, rand()], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 1000 },
        uColor: { value: new THREE.Color('#ff2238') },
        uHot: { value: new THREE.Color('#ff9a6a') },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aSeed;
        uniform float uTime;
        uniform float uScale;
        varying float vA;
        varying float vSoft;
        varying float vHot;
        void main() {
          vec3 p = position;
          float ph = aSeed.x * 6.2831;
          // Rising slowly, wandering, and starting over near where each began.
          float rise = fract(uTime * (0.015 + aSeed.z * 0.02) + aSeed.x);
          p.y += rise * 1.2;
          p.x += sin(uTime * 0.37 + ph) * 0.12;
          p.z += cos(uTime * 0.29 + ph * 1.7) * 0.1;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float depth = -mv.z;
          // Nearer than the stage, motes blur into soft discs.
          float blur = smoothstep(10.0, 6.0, depth);
          gl_PointSize = clamp(aSeed.y * uScale / depth * (1.0 + blur * 3.5), 1.5, 48.0);
          vSoft = blur;
          float life = smoothstep(0.0, 0.15, rise) * (1.0 - smoothstep(0.7, 1.0, rise));
          float flicker = 0.55 + 0.45 * sin(uTime * (1.3 + aSeed.z * 2.0) + ph * 7.0);
          vA = life * flicker * mix(1.0, 0.35, blur) * exp(-max(depth - 12.0, 0.0) * 0.05);
          vHot = step(0.86, aSeed.z);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uHot;
        varying float vA;
        varying float vSoft;
        varying float vHot;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float sharp = smoothstep(1.0, 0.1, d);
          float disc = smoothstep(1.0, 0.75, d) * 0.6 + smoothstep(0.9, 0.0, d) * 0.4;
          float a = mix(sharp, disc, vSoft);
          gl_FragColor = vec4(mix(uColor, uHot, vHot * (1.0 - vSoft)) * a * vA * 2.2, 1.0);
        }
      `,
    });
    return { geometry, material, disposables: [geometry, material] };
  }, []);
  useDisposables(disposables);
  // A lower amount draws only the first part of the motes, which are scattered in random order.
  useLayoutEffect(() => geometry.setDrawRange(0, Math.round(COUNT * amount)), [geometry, amount]);
  useFrame(state => {
    const camera = state.camera as THREE.PerspectiveCamera;
    material.uniforms.uTime.value = now(state);
    material.uniforms.uScale.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  });
  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={7} />;
}
