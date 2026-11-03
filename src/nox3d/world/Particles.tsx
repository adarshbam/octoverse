import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { GlowLightUniforms } from '../character/glowLight';
import { type BubbleField, STAGE_BUBBLES } from './bubbleField';
import { createBubbleMaterial, createEmberMaterial } from './particleMaterials';
import { useDisposables } from './useDisposables';
import { useWorldTime } from './worldTime';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Glassy bubbles: clear centre, bright fresnel rim, one specular glint. In a world, `glow` tints them with Nox's face glow; `time` gives the clock they drift on. */
export function Bubbles({ density = 1, glow, field = STAGE_BUBBLES, time }: { density?: number; glow?: GlowLightUniforms; field?: BubbleField; time?: (state: { clock: { elapsedTime: number } }) => number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { bubbles, material, geometry, disposables } = useMemo(() => {
    const rand = seeded(11);
    const bubbles = Array.from({ length: field.count }, () => {
      let x = (rand() - 0.5) * field.width;
      let z = field.z0 + rand() * field.dz;
      // Keep bubbles from drifting across the face.
      if (Math.abs(x) < 0.95 && z > -0.7 && z < 1) z = -1.2 - rand();
      if (Math.abs(x) < 0.3 && z > -1.6 && z < 1) x += x < 0 ? -0.4 : 0.4;
      return { x, y: field.bottom + rand() * (field.top - field.bottom), z, r: (0.022 + Math.pow(rand(), 2.2) * 0.075) * field.size, speed: 0.06 + rand() * 0.1, phase: rand() * 10 };
    });
    const material = createBubbleMaterial(glow);
    const geometry = new THREE.SphereGeometry(1, 20, 14);
    return { bubbles, material, geometry, disposables: [material, geometry] };
  }, [glow, field]);
  useDisposables(disposables);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(state => {
    const t = time ? time(state) : state.clock.elapsedTime;
    bubbles.forEach((b, i) => {
      const travel = (b.y - field.bottom + t * b.speed) % (field.top - field.bottom);
      dummy.position.set(b.x + Math.sin(t * 0.9 + b.phase) * 0.04, field.bottom + travel, b.z);
      const wobble = 1 + Math.sin(t * 3 + b.phase) * 0.04;
      dummy.scale.set(b.r * wobble, b.r / wobble, b.r);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current!.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, field.count]} count={Math.round(field.count * density)} frustumCulled={false} />;
}

const EMBER_COUNT = 460;

/** Drifting crimson motes, denser along the seabed like the reference. In a world, `glow` tints them with Nox's face glow, and they drift on the world's clock (held still by `?freeze`, like the rest of it). `scale` makes that many times as many (the first 460 are the same motes). */
export function Embers({ density = 1, glow, scale = 1 }: { density?: number; glow?: GlowLightUniforms; scale?: number }) {
  const now = useWorldTime();
  const total = Math.round(EMBER_COUNT * Math.max(scale, 1));
  const { geometry, material, disposables } = useMemo(() => {
    const rand = seeded(23);
    const positions = new Float32Array(total * 3);
    const phase = new Float32Array(total);
    const size = new Float32Array(total);
    for (let i = 0; i < total; i++) {
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
  }, [glow, total]);
  useDisposables(disposables);
  // Lower tiers draw only the first part of the motes, which are scattered in random order.
  useLayoutEffect(() => geometry.setDrawRange(0, Math.round(total * density)), [geometry, density, total]);

  useFrame(state => {
    const camera = state.camera as THREE.PerspectiveCamera;
    material.uniforms.uTime.value = now(state);
    material.uniforms.uScale.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
