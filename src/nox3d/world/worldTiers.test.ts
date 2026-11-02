import { expect, test } from 'vitest';
import { WORLD_TIERS } from './worldTiers';

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

test('high is the full world', () => {
  expect(WORLD_TIERS.high).toEqual({ particles: 1, rays: 1, shadowMap: 2048, plateScale: 1, fish: true, motes: true });
});
