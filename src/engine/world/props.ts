import type * as THREE from 'three';
import type { WorldProp } from './types';

// The animatable parts of the kit (`WorldConfig.props`): a closed table of drives (spec 9), each
// one a small move of a named node. A sequence targets a prop by its id and gives a value; the
// engine finds the node and applies the drive, so no engine code knows what a padlock is. `bob`
// is driven by the world's own clock instead (Kit.tsx, with `bobOffset`): floating rubble.

type Drive = (node: THREE.Object3D, value: number) => void;

/** Where each bobbing node rests: the bob drive moves it from there, so offsets never add up. */
const bobRest = new WeakMap<THREE.Object3D, number>();

/**
 * What each drive does with a value: `rotateZ` turns the node (radians), `emissive` sets its
 * materials' emissive intensity, `bob` lifts it that many stage units above where it rests.
 */
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
  bob: (node, value) => {
    let rest = bobRest.get(node);
    if (rest === undefined) {
      rest = node.position.y;
      bobRest.set(node, rest);
    }
    node.position.y = rest + value;
  },
} as const satisfies Record<string, Drive>;

export type PropDrive = keyof typeof PROP_DRIVES;
export const PROP_DRIVE_IDS = Object.keys(PROP_DRIVES) as PropDrive[];

/** A `bob` prop's motion: a vertical sine `amplitude` stage units either way, once every `period` seconds. */
export interface BobParams {
  amplitude: number;
  period: number;
}

/** Applies a prop's drive to its node. */
export function drive(prop: { drive: PropDrive }, node: THREE.Object3D, value: number) {
  PROP_DRIVES[prop.drive](node, value);
}

/** A prop's own phase (radians, 0 to 2π), from its id: the same every time, and props bob out of step. */
export function propPhase(id: string) {
  // FNV-1a over the id's UTF-16 units.
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return ((h >>> 0) / 4294967296) * 2 * Math.PI;
}

/**
 * A `bob` prop's offset at time `t`: between `-amplitude` and `amplitude`, periodic in `period`,
 * on the prop's own phase. With `motion` 0 (reduced motion, or the world held, as the world's own
 * live motion: liveMotion.ts) it is 0: the rubble rests where the layout puts it.
 */
export function bobOffset(t: number, prop: { id: string; bob?: BobParams }, motion: number) {
  if (!prop.bob) return 0;
  const { amplitude, period } = prop.bob;
  return amplitude * Math.sin(((2 * Math.PI) / period) * t + propPhase(prop.id)) * motion + 0;
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
