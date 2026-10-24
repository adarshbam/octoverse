import { useFrame, useLoader } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { createGlowMaterial } from '../character/glowMaterial';
import { CAMERA_Z } from '../config/stage';

// The security realm is a painted plate (panel 2 with Nox and text removed) with live
// 3D particles, bubbles and haze in front of it. Outside the square stage the plate
// feathers into a matching gradient so wide windows never show a hard edge.

const PLATE_Z = -3;
/** Panel 2 spans 5.06 x 5.04 units at z = 0; grow it so it covers the same view at PLATE_Z. */
const PLATE_SCALE = (CAMERA_Z - PLATE_Z) / CAMERA_Z;

function createBackgroundMaterial() {
  return new THREE.ShaderMaterial({
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color('#070a1e') },
      uLow: { value: new THREE.Color('#0d0309') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() { vPos = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uLow;
      varying vec2 vPos;
      void main() { gl_FragColor = vec4(mix(uLow, uTop, smoothstep(-4.0, 4.0, vPos.y)), 1.0); }
    `,
  });
}

function createPlateMaterial(map: THREE.Texture) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uMap: { value: map }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec3 col = texture2D(uMap, vUv).rgb;
        // Slow shimmer of the light from above so the painted water never looks frozen.
        float shimmer = sin(vUv.x * 9.0 + uTime * 0.35) * sin(vUv.x * 4.0 - vUv.y * 6.0 + uTime * 0.22);
        col += vec3(0.02, 0.03, 0.08) * shimmer * smoothstep(0.45, 1.0, vUv.y);
        float edge = smoothstep(0.0, 0.07, vUv.x) * smoothstep(1.0, 0.93, vUv.x) * smoothstep(0.0, 0.05, vUv.y) * smoothstep(1.0, 0.95, vUv.y);
        gl_FragColor = vec4(col, edge);
      }
    `,
  });
}

export function Backdrop() {
  const plateTexture = useLoader(THREE.TextureLoader, '/nox/plates/intro.png');
  const { background, plate, halo } = useMemo(() => {
    plateTexture.colorSpace = THREE.SRGBColorSpace;
    plateTexture.anisotropy = 8;
    return {
      background: createBackgroundMaterial(),
      plate: createPlateMaterial(plateTexture),
      halo: createGlowMaterial('#c00c36', 0.08, 2.4),
    };
  }, [plateTexture]);
  useFrame(state => { plate.uniforms.uTime.value = state.clock.elapsedTime; });
  return (
    <group>
      <mesh position={[0, 0, -8]} material={background}>
        <planeGeometry args={[44, 26]} />
      </mesh>
      <mesh position={[0, 0, PLATE_Z]} scale={[5.06 * PLATE_SCALE, 5.04 * PLATE_SCALE, 1]} material={plate}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh position={[0.03, -0.85, -1.4]} scale={[5.0, 4.0, 1]} material={halo}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  );
}
