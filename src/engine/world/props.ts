import type * as THREE from 'three';

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
