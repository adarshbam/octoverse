// The seabed's shader variants: a closed table (spec 9), one entry per variant. `palette` lists the
// palette colours the variant reads, which a world with that floor must name (validateWorld).
// 'lava-cracks' is Nox's, in Floor.tsx; 'moss' is shaded by moss.ts.

export const FLOOR_MATERIALS = {
  'lava-cracks': { palette: [] },
  moss: { palette: ['moss'] },
} as const satisfies Record<string, { palette: readonly string[] }>;

export type FloorMaterialId = keyof typeof FLOOR_MATERIALS;
export const DEFAULT_FLOOR: FloorMaterialId = 'lava-cracks';
