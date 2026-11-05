import { ARM_IDS, type PendantPlacement, type PendantSlot } from '../../config/types';

// A pendant placement the engine's tests run on, in place of any world's: twelve slots a stage, two
// on each of the first four arms and one on each of the rest, so the table has crowded and lone arms.
// Not a world's data (the engine imports nothing from a world): the test fixtures' own values.

const slots = (): PendantSlot[] => ARM_IDS.flatMap((arm, i) => (i < 4 ? [{ arm, at: 1, order: i }, { arm, at: 0.6, order: 8 + i }] : [{ arm, at: 1, order: i }]));

/** A fresh copy each call, so a test may edit it. */
export function pendantFixture(): PendantPlacement {
  return {
    kind: 'pendant',
    slots: { intro: slots(), overview: slots() },
    maxPerArm: 2,
    sizes: { intro: 0.12, overview: 0.15 },
    tether: { length: 0.08, color: '#7cf0ff', width: 0.014, sag: 0.12, cap: '#f0e8ac' },
  };
}
