import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createCaustics } from './caustics';
import { makeWaterEnvironment } from './textures';
import type { WorldConfig } from './types';
import { useDisposables } from './useDisposables';
import { useWorldTime } from './worldTime';

/** Light from the surface, high above and beyond the stage: shadows, and caustics in its cookie. */
export function useSurfaceLight(world: WorldConfig) {
  const { surface } = world.lights;
  const { spot, caustics, disposables } = useMemo(() => {
    const caustics = createCaustics(512);
    const spot = new THREE.SpotLight(surface.color, surface.intensity, 0, 0.6, 0.55, 0);
    spot.position.set(...surface.position);
    spot.target.position.set(...surface.target);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.camera.near = 8;
    spot.shadow.camera.far = 60;
    spot.shadow.bias = -0.0003;
    spot.shadow.normalBias = 0.03;
    spot.shadow.radius = 4;
    spot.map = caustics.texture;
    return { spot, caustics, disposables: [spot, caustics] };
  }, [surface]);
  useDisposables(disposables);
  return { spot, caustics };
}

export function SurfaceLight({ spot, caustics }: ReturnType<typeof useSurfaceLight>) {
  const gl = useThree(s => s.gl);
  const now = useWorldTime();
  useFrame(state => caustics.render(gl, now(state)));
  return (
    <>
      <primitive object={spot} />
      <primitive object={spot.target} />
    </>
  );
}

/** What wet stone and iron reflect: the water's light all round. */
export function WaterEnvironment({ world }: { world: WorldConfig }) {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const { surfaceDir, environmentIntensity } = world.water;
  useLayoutEffect(() => {
    const env = makeWaterEnvironment(gl, new THREE.Vector3(...surfaceDir));
    scene.environment = env.texture;
    scene.environmentIntensity = environmentIntensity;
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [gl, scene, surfaceDir, environmentIntensity]);
  return null;
}
