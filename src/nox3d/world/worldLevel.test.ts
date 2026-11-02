import { expect, test } from 'vitest';
import { SECURITY_WORLD } from './security/config';
import { nextLevel, worldAtLevel } from './worldLevel';

test('a failing world steps from baked, to the kit lit live, to fog only, and no further', () => {
  expect(nextLevel(0)).toBe(1);
  expect(nextLevel(1)).toBe(2);
  expect(nextLevel(2)).toBeNull();
});

test('the kit level gives up near.glb and keeps everything else', () => {
  expect(SECURITY_WORLD.near).toBeDefined();
  expect(worldAtLevel(SECURITY_WORLD, 0)).toBe(SECURITY_WORLD);
  const live = worldAtLevel(SECURITY_WORLD, 1);
  expect(live.near).toBeUndefined();
  expect(live.kit).toBe(SECURITY_WORLD.kit);
  expect(live.layout).toBe(SECURITY_WORLD.layout);
});
