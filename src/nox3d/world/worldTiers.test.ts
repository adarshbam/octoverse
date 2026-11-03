import { expect, test } from 'vitest';
import { RELIEF_GATE, setReliefGate } from './bakedLight';
import { PHONE_WORLD_TIER, WORLD_TIERS, reliefShown, stoneCastsShadow, worldTierFor } from './worldTiers';

test('world tiers scale down monotonically', () => {
  const { high, medium, low } = WORLD_TIERS;
  for (const key of Object.keys(high) as (keyof typeof high)[]) {
    const [a, b, c] = [high[key], medium[key], low[key]];
    if (typeof a === 'boolean') {
      // A feature may be dropped on a lower tier, never gained.
      expect(Number(a) >= Number(b) && Number(b) >= Number(c), key).toBe(true);
    } else {
      expect(a >= (b as number) && (b as number) >= (c as number), key).toBe(true);
    }
  }
});

test('every tier is pinned', () => {
  expect(WORLD_TIERS).toEqual({
    high: { particles: 1, rays: 1, shadowMap: 2048, plateScale: 1, fish: true, motes: true },
    medium: { particles: 0.6, rays: 0.6, shadowMap: 1024, plateScale: 0.75, fish: true, motes: false },
    low: { particles: 0.35, rays: 0.4, shadowMap: 1024, plateScale: 0.5, fish: false, motes: false },
  });
});

test('the stone casts shadows and shows its relief at high only', () => {
  expect(stoneCastsShadow(WORLD_TIERS.high)).toBe(true);
  expect(stoneCastsShadow(WORLD_TIERS.medium)).toBe(false);
  expect(stoneCastsShadow(WORLD_TIERS.low)).toBe(false);
  expect(reliefShown(WORLD_TIERS.high)).toBe(true);
  expect(reliefShown(WORLD_TIERS.medium)).toBe(false);
  expect(reliefShown(WORLD_TIERS.low)).toBe(false);
});

test('the relief gate follows the tier and goes back to shown', () => {
  const gate = (tier: keyof typeof WORLD_TIERS) => {
    const restore = setReliefGate(reliefShown(WORLD_TIERS[tier]));
    const value = RELIEF_GATE.value;
    restore();
    expect(RELIEF_GATE.value).toBe(1);
    return value;
  };
  expect([gate('high'), gate('medium'), gate('low')]).toEqual([1, 0, 0]);
});

test('a phone draws the lowest tier with no fish and no motes, whatever tier the device picked', () => {
  expect(PHONE_WORLD_TIER).toEqual({ ...WORLD_TIERS.low, fish: false, motes: false });
  for (const tier of ['high', 'medium', 'low'] as const) expect(worldTierFor(tier, true)).toBe(PHONE_WORLD_TIER);
  expect(worldTierFor('high', false)).toBe(WORLD_TIERS.high);
});
