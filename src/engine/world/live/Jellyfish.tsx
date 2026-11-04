import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useMotionAmount } from '../liveMotion';
import type { JellyfishConfig } from '../types';
import { useDisposables } from '../useDisposables';
import type { WorldTier } from '../worldTiers';
import { useWorldTime } from '../worldTime';
import { LIVE_ELEMENTS } from './index';
import { JELLY_GLSL, bellGeometry, drawOrder, filamentGeometry, jellyCount, scatterJellies } from './jelly';

type JellyUniforms = { uTime: THREE.IUniform<number>; uMotion: THREE.IUniform<number>; uDrift: THREE.IUniform<number>; uSpan: THREE.IUniform<THREE.Vector2> };

/** Writes the frame's clock and motion into the jellyfish's uniforms. */
function writeClock(uniforms: JellyUniforms, time: number, motion: number) {
  uniforms.uTime.value = time;
  uniforms.uMotion.value = motion;
}

/** A see-through material in `color` (the config's), its vertices moved by the jellyfish terms and `part`'s own. */
function jellyMaterial(color: string, uniforms: JellyUniforms, part: 'bell' | 'filament') {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: part === 'bell' ? 0.75 : 0.6, depthWrite: false, side: THREE.DoubleSide });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    const filament = part === 'filament';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${JELLY_GLSL.common}\n${filament ? 'attribute vec2 aFil;\nvarying float vJH;' : 'varying float vJRim;'}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>${JELLY_GLSL.instance}${filament ? `${JELLY_GLSL.filament}\n  vJH = jH;` : JELLY_GLSL.bell}`)
      // The bell is denser where it is seen edge-on (its rim), clearer where it is seen face-on.
      .replace('#include <project_vertex>', filament ? '#include <project_vertex>' : '#include <project_vertex>\n  vJRim = 1.0 - abs(dot(normalize(-mvPosition.xyz), normalize(normalMatrix * (mat3(instanceMatrix) * normal))));');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${filament ? 'varying float vJH;' : 'varying float vJRim;'}`)
      .replace(
        '#include <color_fragment>',
        filament
          ? '#include <color_fragment>\n  diffuseColor.a *= 1.0 - 0.85 * vJH;'
          : '#include <color_fragment>\n  diffuseColor.a *= mix(0.25, 1.0, vJRim);\n  diffuseColor.rgb *= mix(0.8, 1.4, vJRim);',
      );
  };
  return material;
}

/**
 * The jellyfish: bells in the config's `bell` colour, trailing filaments in its `filament` colour,
 * each pulsing on its own beat and drifting slowly up through the config's region (vertex shader;
 * still when the world's motion is held). One draw for the bells and one for the filaments; the
 * tier sets how many (`count` at its quality), the nearest drawn last.
 */
export function Jellyfish({ config, tier }: { config: JellyfishConfig; tier: Pick<WorldTier, 'quality'> }) {
  const now = useWorldTime();
  const motionAmount = useMotionAmount();
  const { bells, filaments, swarm, uniforms, disposables } = useMemo(() => {
    const shape = LIVE_ELEMENTS.jellyfish;
    const swarm = scatterJellies(config, shape);
    const uniforms: JellyUniforms = {
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uDrift: { value: config.drift },
      uSpan: { value: new THREE.Vector2(config.region.min[1], config.region.max[1]) },
    };
    const bellShape = bellGeometry(shape);
    const filamentShape = filamentGeometry(shape);
    const bellMaterial = jellyMaterial(config.bell, uniforms, 'bell');
    const filamentMaterial = jellyMaterial(config.filament, uniforms, 'filament');
    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
      geometry.setAttribute('aJelly', new THREE.InstancedBufferAttribute(new Float32Array(swarm.length * 3), 3));
      const m = new THREE.InstancedMesh(geometry, material, swarm.length);
      m.frustumCulled = false;
      return m;
    };
    const bells = mesh(bellShape, bellMaterial);
    const filaments = mesh(filamentShape, filamentMaterial);
    return { bells, filaments, swarm, uniforms, disposables: [bellShape, filamentShape, bellMaterial, filamentMaterial, bells, filaments] };
  }, [config]);
  useDisposables(disposables);
  const count = jellyCount(config, tier);
  // The tier's share of the swarm, farthest first, written once per tier change (never per frame).
  useLayoutEffect(() => {
    const drawn = drawOrder(swarm, Math.min(count, swarm.length));
    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    const upright = new THREE.Quaternion();
    for (const mesh of [bells, filaments]) {
      const jelly = mesh.geometry.getAttribute('aJelly') as THREE.InstancedBufferAttribute;
      drawn.forEach((j, i) => {
        mesh.setMatrixAt(i, matrix.compose(position.set(...j.position), upright, scale.setScalar(j.size)));
        jelly.setXYZ(i, j.phase, j.period, j.size);
      });
      mesh.count = drawn.length;
      mesh.instanceMatrix.needsUpdate = true;
      jelly.needsUpdate = true;
    }
  }, [bells, filaments, swarm, count]);
  useFrame(state => writeClock(uniforms, now(state), motionAmount));
  return (
    <>
      <primitive object={filaments} />
      <primitive object={bells} />
    </>
  );
}
