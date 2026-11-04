// The one definition of the eight anatomical arms. `config/types.ts` and
// `content/projectTypes.ts` re-export from here so there is a single array.

/**
 * Exactly eight anatomical arms, matching the approved Nox character anatomy.
 * Arm count is strictly decoupled from technology counts.
 */
export const ARM_IDS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'] as const;

export type ArmId = (typeof ARM_IDS)[number];

export const TOTAL_ARM_COUNT = 8 as const;

export function isArmId(value: unknown): value is ArmId {
  return typeof value === 'string' && (ARM_IDS as readonly string[]).includes(value);
}
