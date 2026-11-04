import type * as THREE from 'three';
import { type GlowParams, glowBrightest, glowProblems, makeGlowMaterial } from './glowMaterial';
import { type LedParams, ledBrightest, ledProblems, makeLedMaterial } from './ledMaterial';
import { type MembraneParams, makeMembraneMaterial, membraneBrightest, membraneProblems } from './membraneMaterial';

// The kit-material variants (engine contract amendment A1: F4b, A8): a closed table, one entry per
// variant, each a module of the engine. A world assigns a variant to a named node of its kit
// (`WorldConfig.materials`, by node name: a placed piece and its lod1, or a node of `kit.nodes`)
// and gives its parameters, the colours among them; no shader here holds a world's colour.
// Kit.tsx draws an assigned node with its variant in place of the group's dressing.

/** One variant: how its material is made from its params, what can be wrong with them, and the brightest emissive luminance it can draw (the relic rule's measure). */
interface KitMaterialVariant<P> {
  make: (params: P) => { material: THREE.Material; update: (t: number, motion: number) => void };
  problems: (params: P, at: string) => string[];
  brightest: (params: P) => number;
}

export const KIT_MATERIAL_VARIANTS = {
  /** An energy membrane across a doorway: flowing light lines, brighter at the edge (membraneMaterial.ts). Veyra's portal; Aether's arch reuses it. */
  membrane: { make: makeMembraneMaterial, problems: membraneProblems, brightest: membraneBrightest } satisfies KitMaterialVariant<MembraneParams>,
  /** A piece that gives off its own light, pulsing slowly (glowMaterial.ts): glowing plants, a lit lock. */
  glow: { make: makeGlowMaterial, problems: glowProblems, brightest: glowBrightest } satisfies KitMaterialVariant<GlowParams>,
  /** Status lights that blink, each on its own beat, in the vertex colour the kit gives them (ledMaterial.ts): Flux's racks and towers. */
  led: { make: makeLedMaterial, problems: ledProblems, brightest: ledBrightest } satisfies KitMaterialVariant<LedParams>,
} as const;

export type KitMaterialId = keyof typeof KIT_MATERIAL_VARIANTS;
export const KIT_MATERIAL_IDS = Object.keys(KIT_MATERIAL_VARIANTS) as KitMaterialId[];

/** A kit node drawn with a kit-material variant: the node's name, the variant, and its params. */
export type KitMaterialAssignment = { node: string } & (
  | { material: 'membrane'; params: MembraneParams }
  | { material: 'glow'; params: GlowParams }
  | { material: 'led'; params: LedParams }
);

/** A kit material as made for an assignment: the material and its per-frame update (world time, motion 0 or 1). */
export type KitMaterialInstance = ReturnType<(typeof KIT_MATERIAL_VARIANTS)[KitMaterialId]['make']>;

/** The material for an assignment, made by its variant. */
export function makeKitMaterial(assignment: KitMaterialAssignment): KitMaterialInstance {
  switch (assignment.material) {
    case 'membrane':
      return KIT_MATERIAL_VARIANTS.membrane.make(assignment.params);
    case 'glow':
      return KIT_MATERIAL_VARIANTS.glow.make(assignment.params);
    case 'led':
      return KIT_MATERIAL_VARIANTS.led.make(assignment.params);
  }
}

/** The brightest emissive luminance (linear) an assignment's material can draw. */
export function kitMaterialBrightest(assignment: KitMaterialAssignment): number {
  switch (assignment.material) {
    case 'membrane':
      return KIT_MATERIAL_VARIANTS.membrane.brightest(assignment.params);
    case 'glow':
      return KIT_MATERIAL_VARIANTS.glow.brightest(assignment.params);
    case 'led':
      return KIT_MATERIAL_VARIANTS.led.brightest(assignment.params);
  }
}

/** What is wrong with an assignment's variant and params, in words. */
export function kitMaterialProblems(assignment: KitMaterialAssignment, at: string): string[] {
  if (!(KIT_MATERIAL_IDS as string[]).includes(assignment.material)) return [`${at} has material "${String(assignment.material)}", which is not one of ${KIT_MATERIAL_IDS.join(', ')}`];
  switch (assignment.material) {
    case 'membrane':
      return KIT_MATERIAL_VARIANTS.membrane.problems(assignment.params, `${at}.params`);
    case 'glow':
      return KIT_MATERIAL_VARIANTS.glow.problems(assignment.params, `${at}.params`);
    case 'led':
      return KIT_MATERIAL_VARIANTS.led.problems(assignment.params, `${at}.params`);
  }
}

/** The assignment for a kit node: by its own name, or a piece's for its `_lod1`; undefined when it has none. */
export function kitMaterialFor(materials: readonly KitMaterialAssignment[] | undefined, node: string): KitMaterialAssignment | undefined {
  if (!materials) return undefined;
  const name = node.endsWith('_lod1') ? node.slice(0, -'_lod1'.length) : node;
  return materials.find(m => m.node === name);
}
