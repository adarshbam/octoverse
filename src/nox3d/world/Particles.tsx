import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { GlowLightUniforms } from '../character/glowLight';
import { createBubbleMaterial, createEmberMaterial } from './particleMaterials';
import { useDisposables } from './useDisposables';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const BUBBLE_COUNT = 22;
const TOP = 2.9;
const BOTTOM = -2.9;

/** Glassy bubbles: clear centre, bright fresnel rim, one specular glint. In a world, `glow` tints them with Nox's face glow. */
export function Bubbles({ density = 1, glow }: { density?: number; glow?: GlowLightUniforms }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { bubbles, material, geometry, disposables } = useMemo(() => {
    const rand = seeded(11);
    const bubbles = Array.from({ length: BUBBLE_COUNT }, () => {
      let x = (rand() - 0.5) * 5.2;
      let z = -1.6 + rand() * 2.4;
      // Keep bubbles from drifting across the face.
      if (Math.abs(x) < 0.95 && z > -0.7) z = -1.2 - rand();
      if (Math.abs(x) < 0.3) x += x < 0 ? -0.4 : 0.4;
      return { x, y: BOTTOM + rand() * (TOP - BOTTOM), z, r: 0.022 + Math.pow(rand(), 2.2) * 0.075, speed: 0.06 + rand() * 0.1, phase: rand() * 10 };
    });
    const material = createBubbleMaterial(glow);
    const geometry = new THREE.SphereGeometry(1, 20, 14);
    return { bubbles, material, geometry, disposables: [material, geometry] };
  }, [glow]);
  useDisposables(disposables);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(state => {
    const t = state.clock.elapsedTime;
    bubbles.forEach((b, i) => {
      const travel = (b.y - BOTTOM + t * b.speed) % (TOP - BOTTOM);
      dummy.position.set(b.x + Math.sin(t * 0.9 + b.phase) * 0.04, BOTTOM + travel, b.z);
      const wobble = 1 + Math.sin(t * 3 + b.phase) * 0.04;
      dummy.scale.set(b.r * wobble, b.r / wobble, b.r);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current!.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, BUBBLE_COUNT]} count={Math.round(BUBBLE_COUNT * density)} frustumCulled={false} />;
}

const EMBER_COUNT = 460;

/** Drifting crimson motes, denser along the seabed like the reference. In a world, `glow` tints them with Nox's face glow. */
export function Embers({ density = 1, glow }: { density?: number; glow?: GlowLightUniforms }) {
  const { geometry, material, disposables } = useMemo(() => {
    const rand = seeded(23);
    const positions = new Float32Array(EMBER_COUNT * 3);
    const phase = new Float32Array(EMBER_COUNT);
    const size = new Float32Array(EMBER_COUNT);
    for (let i = 0; i < EMBER_COUNT; i++) {
      const low = rand() < 0.72;
      const side = rand() < 0.5 ? -1 : 1;
      const x = low ? side * (0.9 + rand() * 2.0) : (rand() - 0.5) * 5.4;
      const y = low ? -2.7 + rand() * 1.3 : -2.5 + rand() * 5;
      positions.set([x, y, -2.2 + rand() * 2.6], i * 3);
      phase[i] = rand();
      size[i] = 0.008 + Math.pow(rand(), 3) * 0.03;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const material = createEmberMaterial(glow);
    return { geometry, material, disposables: [geometry, material] };
  }, [glow]);
  useDisposables(disposables);
  // Lower tiers draw only the first part of the motes, which are scattered in random order.
  useLayoutEffect(() => geometry.setDrawRange(0, Math.round(EMBER_COUNT * density)), [geometry, density]);

  useFrame(state => {
    const camera = state.camera as THREE.PerspectiveCamera;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uScale.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
