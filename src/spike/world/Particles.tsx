import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

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

/** Glassy bubbles: clear centre, bright fresnel rim, one specular glint. */
export function Bubbles() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { bubbles, material, geometry } = useMemo(() => {
    const rand = seeded(11);
    const bubbles = Array.from({ length: BUBBLE_COUNT }, () => {
      let x = (rand() - 0.5) * 5.2;
      let z = -1.6 + rand() * 2.4;
      // Keep bubbles from drifting across the face.
      if (Math.abs(x) < 0.95 && z > -0.7) z = -1.2 - rand();
      if (Math.abs(x) < 0.3) x += x < 0 ? -0.4 : 0.4;
      return { x, y: BOTTOM + rand() * (TOP - BOTTOM), z, r: 0.022 + Math.pow(rand(), 2.2) * 0.075, speed: 0.06 + rand() * 0.1, phase: rand() * 10 };
    });
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uRim: { value: new THREE.Color('#ff6a9a') }, uTint: { value: new THREE.Color('#7a4aa8') } },
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
        uniform vec3 uRim;
        uniform vec3 uTint;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vec3 N = normalize(vN);
          float f = pow(1.0 - abs(dot(N, normalize(vV))), 2.2);
          float spec = pow(max(dot(N, normalize(vec3(-0.45, 0.6, 0.7))), 0.0), 70.0);
          vec3 c = mix(uTint, uRim, f) * (0.4 + f * 1.4) + spec * 2.2;
          gl_FragColor = vec4(c, 0.05 + f * 0.7 + spec);
        }
      `,
    });
    return { bubbles, material, geometry: new THREE.SphereGeometry(1, 20, 14) };
  }, []);

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

  return <instancedMesh ref={mesh} args={[geometry, material, BUBBLE_COUNT]} frustumCulled={false} />;
}

const EMBER_COUNT = 460;

/** Drifting crimson motes, denser along the seabed like the reference. */
export function Embers() {
  const { geometry, material } = useMemo(() => {
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
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uScale: { value: 1000 }, uColor: { value: new THREE.Color('#ff2c3c') }, uHot: { value: new THREE.Color('#ff8a5a') } },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        attribute float aSize;
        uniform float uTime;
        uniform float uScale;
        varying float vA;
        varying float vHot;
        void main() {
          vec3 p = position;
          p.y += fract(uTime * 0.012 + aPhase) * 0.5 - 0.25;
          p.x += sin(uTime * 0.4 + aPhase * 6.28) * 0.05;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max(1.5, aSize * uScale / -mv.z);
          vA = 0.45 + 0.55 * sin(uTime * 1.7 + aPhase * 40.0);
          vHot = step(0.85, fract(aPhase * 7.0));
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uHot;
        varying float vA;
        varying float vHot;
        void main() {
          float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
          gl_FragColor = vec4(mix(uColor, uHot, vHot) * 2.6 * vA, a);
        }
      `,
    });
    return { geometry, material };
  }, []);

  useFrame(state => {
    const camera = state.camera as THREE.PerspectiveCamera;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uScale.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
