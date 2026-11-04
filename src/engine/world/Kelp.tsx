import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { KELP_SWAY_GLSL, useMotionAmount } from './liveMotion';
import { LIVE_ELEMENTS, type LiveElementId } from './live';
import { scatterStrands, strandGeometry } from './live/strands';
import type { StrandConfig } from './types';
import { useDisposables } from './useDisposables';
import { useWorldTime } from './worldTime';

type StrandUniforms = Record<'uTime' | 'uMotion' | 'uSway', THREE.IUniform<number>>;

/** Writes the frame's clock and motion into the strands' uniforms. */
function writeClock(uniforms: StrandUniforms, time: number, motion: number) {
  uniforms.uTime.value = time;
  uniforms.uMotion.value = motion;
}

/** Draws the first `amount` of the strands, which are scattered in random order. */
function showShare(mesh: THREE.InstancedMesh, amount: number) {
  mesh.count = Math.round(mesh.instanceMatrix.count * amount);
}

/**
 * Kelp or seagrass: the config's strands, instanced from one ribbon, each leaning with the
 * current from its root (vertex shader; still when the world's motion is held). They take the
 * config's colour, darker toward the root. `amount` is the share drawn (the quality tier's).
 */
export function Strands({ id, config, floorY, amount = 1 }: { id: LiveElementId; config: StrandConfig; floorY: number; amount?: number }) {
  const now = useWorldTime();
  const motionAmount = useMotionAmount();
  const { mesh, uniforms, disposables } = useMemo(() => {
    const shape = LIVE_ELEMENTS[id];
    const strands = scatterStrands(config, shape, floorY);
    const geometry = strandGeometry(shape);
    const uniforms: StrandUniforms = { uTime: { value: 0 }, uMotion: { value: 1 }, uSway: { value: config.sway } };
    const material = new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uMotion;\nuniform float uSway;\nvarying float vStrandH;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n  vStrandH = clamp(position.y, 0.0, 1.0);\n  ${KELP_SWAY_GLSL}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vStrandH;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= mix(0.4, 1.0, vStrandH);');
    };
    const mesh = new THREE.InstancedMesh(geometry, material, strands.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    strands.forEach((s, i) => {
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, s.yaw);
      mesh.setMatrixAt(i, m.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(1, s.height, 1)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return { mesh, uniforms, disposables: [geometry, material, mesh] };
  }, [id, config, floorY]);
  useDisposables(disposables);
  useLayoutEffect(() => showShare(mesh, amount), [mesh, amount]);
  useFrame(state => writeClock(uniforms, now(state), motionAmount));
  return <primitive object={mesh} />;
}
