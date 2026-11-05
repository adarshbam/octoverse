import type * as THREE from 'three';
import type { WorldProp } from './types';

// The animatable parts of the kit (`WorldConfig.props`): a closed table of drives (spec 9), each
// one a small move of a named node. A sequence targets a prop by its id and gives a value; the
// engine finds the node and applies the drive, so no engine code knows what a padlock is.

type Drive = (node: THREE.Object3D, value: number) => void;

/** What each drive does with a value: `rotateZ` turns the node (radians), `emissive` sets its materials' emissive intensity. */
export const PROP_DRIVES = {
  rotateZ: (node, value) => {
    node.rotation.z = value;
  },
  emissive: (node, value) => {
    node.traverse(child => {
      const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | undefined;
      for (const m of Array.isArray(material) ? material : material ? [material] : []) if ('emissiveIntensity' in m) m.emissiveIntensity = value;
    });
  },
} as const satisfies Record<string, Drive>;

export type PropDrive = keyof typeof PROP_DRIVES;
export const PROP_DRIVE_IDS = Object.keys(PROP_DRIVES) as PropDrive[];

/** Applies a prop's drive to its node. */
export function drive(prop: { drive: PropDrive }, node: THREE.Object3D, value: number) {
  PROP_DRIVES[prop.drive](node, value);
}

/** A prop and the placed nodes it moves (one per placement of the piece the node is attached to). */
export interface PropBinding {
  prop: WorldProp;
  nodes: readonly THREE.Object3D[];
  /** The value last applied, so a value that holds is not applied again each frame. */
  applied?: number;
}

/**
 * Applies each bound prop's value from `values` (by prop id; a prop with no value is left as it is).
 * The instance's kit values are written by the entrance (`InstanceState.kit`) and read here by the kit.
 */
export function driveProps(bindings: readonly PropBinding[], values: Readonly<Record<string, number>>) {
  for (const binding of bindings) {
    const value = values[binding.prop.id];
    if (value === undefined || value === binding.applied) continue;
    for (const node of binding.nodes) drive(binding.prop, node, value);
    binding.applied = value;
  }
}
