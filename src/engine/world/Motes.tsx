import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { GlowLightUniforms, GlowReach } from '../character/glowLight';
import { seeded } from './noise';
import { createMoteMaterial } from './particleMaterials';
import { useDisposables } from './useDisposables';
import { useWorldTime } from './worldTime';

const COUNT = 900;

/**
 * Red motes rising off the glowing seabed, thickest round the pillars' feet and the lower
 * corners; the nearest are big and soft, out of focus in front of the lens. `amount` is the
 * share of the motes drawn. In a world, `glow` tints them with Nox's face glow.
 */
export function Motes({ amount = 1, glow, reach }: { amount?: number; glow?: GlowLightUniforms; reach?: GlowReach }) {
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
    const material = createMoteMaterial(glow, reach);
    return { geometry, material, disposables: [geometry, material] };
  }, [glow, reach]);
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
