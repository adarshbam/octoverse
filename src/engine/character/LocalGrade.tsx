import { useMemo } from 'react';
import type * as THREE from 'three';
import type { GradeSettings } from '../config/types';
import { useDisposables } from '../world/useDisposables';
import { GRADE_ORDER, createGradeGeometry, createGradeMaterial } from './localGradeMaterial';

/**
 * The local grade, in a world: the water behind Nox and near him, darker and warmer. `glow` is his
 * face glow in world space, kept up to date each frame (the world link's `at`); the discs place and
 * turn themselves from it and the camera as they are drawn, so nothing is computed here per frame.
 */
export function LocalGrade({ grade, glow, meshRef }: { grade: GradeSettings; glow: THREE.Vector3; /** The discs, for their owner to dim (uStrength) as Nox comes out of the murk. */ meshRef?: React.Ref<THREE.Mesh> }) {
  const { geometry, material, disposables } = useMemo(() => {
    const geometry = createGradeGeometry();
    const material = createGradeMaterial(grade, glow);
    return { geometry, material, disposables: [geometry, material] };
  }, [grade, glow]);
  useDisposables(disposables);
  // The discs are placed in their shader, so their bounds never fit them: they are never culled.
  return <mesh ref={meshRef} geometry={geometry} material={material} renderOrder={GRADE_ORDER} frustumCulled={false} />;
}
