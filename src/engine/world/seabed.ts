import * as THREE from 'three';
import { fbm2 } from './noise';

/**
 * The seabed's extent and grid: `width` across x, from `farZ` beyond the ruin to `nearZ` past the
 * lens, in `segments` (x, z) cells. Floor.tsx draws this grid; the bake (blender/security/
 * bake_world.py) builds the same one and records it in near.glb, and validateWorld.test checks the
 * two agree.
 */
export const SEABED = { width: 26, nearZ: 7, farZ: -62, segments: [110, 260] } as const;

/**
 * Seabed height at (x, z): gentle silt dunes, rising into rubble toward the pillars, about `floorY`.
 * bake_world.py has a copy (`floor_height`); near.glb records heights it sampled, and
 * validateWorld.test checks this function gives the same ones.
 */
export function floorHeight(x: number, z: number, floorY: number) {
  const dunes = (fbm2(x * 0.22, z * 0.22, 4, 3) - 0.5) * 0.28;
  const ripple = (fbm2(x * 1.1, z * 1.1, 3, 7) - 0.5) * 0.08;
  const side = THREE.MathUtils.smoothstep(Math.abs(x), 2.2, 4.8);
  const rubble = side * (fbm2(x * 0.7, z * 0.7, 4, 11) - 0.35) * 0.55;
  return floorY + dunes + ripple + Math.max(rubble, 0);
}

/**
 * Where (x, z) falls in the seabed's lightmap (its uv1): u across from the left edge, v from the
 * near edge back. The near edge is the image's top row, as glTF stores it (bake_world.py bakes the
 * same planar map, with Blender's v pointing the other way).
 */
export function seabedLightUv(x: number, z: number): [number, number] {
  return [(x + SEABED.width / 2) / SEABED.width, (SEABED.nearZ - z) / (SEABED.nearZ - SEABED.farZ)];
}
