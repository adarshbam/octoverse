import { expect, test } from 'vitest';
import { glyphPanelLook } from './textures';

test('glyph panels vary in wear and brightness by a seeded hash per panel', () => {
  // Every panel of the corridor: 14 pillars with up to 5 glyph cells each.
  const looks = Array.from({ length: 14 }, (_, pillar) => Array.from({ length: 5 }, (_, cell) => glyphPanelLook(pillar, cell))).flat();
  // The same panel always looks the same.
  expect(glyphPanelLook(3, 2)).toEqual(glyphPanelLook(3, 2));
  for (const { wear, brightness } of looks) {
    expect(wear).toBeGreaterThanOrEqual(0);
    expect(wear).toBeLessThanOrEqual(1);
    expect(brightness).toBeGreaterThanOrEqual(0.6);
    expect(brightness).toBeLessThanOrEqual(1.3);
  }
  // Uneven, not a repeating pattern: each spread over most of its range, and neighbours differ.
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
  expect(spread(looks.map(l => l.wear))).toBeGreaterThan(0.7);
  expect(spread(looks.map(l => l.brightness))).toBeGreaterThan(0.4);
  const sameAsNext = looks.filter((l, i) => i > 0 && l.brightness === looks[i - 1].brightness).length;
  expect(sameAsNext).toBeLessThan(looks.length / 4);
  // Brightness averages about 1, so the corridor as a whole glows as it did.
  const mean = looks.reduce((sum, l) => sum + l.brightness, 0) / looks.length;
  expect(mean).toBeGreaterThan(0.9);
  expect(mean).toBeLessThan(1.1);
});
