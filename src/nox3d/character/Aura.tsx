import { useMemo } from 'react';
import * as THREE from 'three';
import type { AuraSettings } from '../config/types';
import { useDisposables } from '../world/useDisposables';
import { createAuraMaterial } from './auraMaterial';

/** How far behind the body's middle plane the aura sits (body units): just behind the rear arms. */
export const AURA_Z = -0.8;

/**
 * The aura, in a world: a soft magenta-violet glow in the water round Nox, deep red below. A card
 * just behind his rear arms, turned to face the camera, adding its light and writing no depth.
 * Mount it at the body's middle, in the body's own space, so it moves and turns with him.
 */
export function Aura({ aura }: { aura: AuraSettings }) {
  const { geometry, material, disposables } = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = createAuraMaterial(aura);
    return { geometry, material, disposables: [geometry, material] };
  }, [aura]);
  useDisposables(disposables);
  // The card turns to face the camera in its shader, so its bounds never fit it: it is never culled.
  return <mesh geometry={geometry} material={material} position={[0, 0, AURA_Z]} frustumCulled={false} />;
}
