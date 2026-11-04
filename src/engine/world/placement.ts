import * as THREE from 'three';
import { KIT_LOD_DISTANCE, LOD_HYSTERESIS } from './kitLod';
import { floorHeight } from './seabed';
import type { Placement, WorldLayout } from './types';

// Where the kit's pieces stand. Kit.tsx places them with these functions; the bake
// (blender/security/bake_world.py) places them again in Blender and records each matrix and each
// coral's rest in near.glb, and placement.test checks these functions give the same.

/** Sets an object's transform from a placement: position, turn about y, tilt about z (applied first), scale. */
export function applyPlacement(object: THREE.Object3D, p: Placement) {
  object.position.set(...p.position);
  object.rotation.set(0, p.rotY ?? 0, p.tilt ?? 0);
  if (typeof p.scale === 'object') object.scale.set(...p.scale);
  else object.scale.setScalar(p.scale ?? 1);
}

/** The groups Kit.tsx dresses by name; any other group of a layout is plain stone. */
export const DRESSED_GROUPS = ['pillars', 'rocks', 'corals'] as const;

/** One placed piece as the loader reads the layout: its group and index in it, the piece, and where it stands. */
export interface LayoutPiece {
  group: string;
  index: number;
  piece: string;
  /** The placement's matrix, column-major (three's `Matrix4.elements`). */
  matrix: number[];
}

/** Every piece of a layout, group by group in the order the layout lists them, with its transform. Groups are read generically: any name. */
export function layoutPieces(layout: WorldLayout): LayoutPiece[] {
  const object = new THREE.Object3D();
  return Object.entries(layout.groups).flatMap(([group, placements]) =>
    placements.map((p, index) => {
      applyPlacement(object, p);
      object.updateMatrix();
      return { group, index, piece: p.piece, matrix: object.matrix.elements.slice() };
    }),
  );
}

/** A piece at full detail near the camera and its `_lod1` beyond `KIT_LOD_DISTANCE`. */
export function withLod(full: THREE.Object3D, far: THREE.Object3D) {
  const lod = new THREE.LOD();
  lod.addLevel(full, 0);
  lod.addLevel(far, KIT_LOD_DISTANCE, LOD_HYSTERESIS);
  return lod;
}

/** Coral sinks this far into whatever it rests on. */
const CORAL_SINK = 0.04;

/**
 * Where coral at (x, z) comes to rest: on the highest of `surfaces` (the boulders at full detail,
 * placed, their world matrices up to date) under it, or on the seabed, whichever is higher, sunk
 * `CORAL_SINK` into it.
 */
export function coralRest(x: number, z: number, floorY: number, surfaces: THREE.Object3D[]): { y: number; on: 'rock' | 'seabed' } {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 8, z), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObjects(surfaces, false)[0];
  const seabed = floorHeight(x, z, floorY);
  return hit && hit.point.y > seabed ? { y: hit.point.y - CORAL_SINK, on: 'rock' } : { y: seabed - CORAL_SINK, on: 'seabed' };
}
