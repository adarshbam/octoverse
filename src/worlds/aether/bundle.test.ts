import { expect, test } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ARM_IDS } from '../../engine/config/types';
import { clampCharacterConfig } from '../../engine/config/validate';
import { faceAnchor, validateBundle } from '../../engine/types/bundle';
import { layoutOrbits } from '../../engine/artifacts/bubbleOrbits';
import { AETHER_BUNDLE } from './bundle';
import { AETHER } from './character';
import { AETHER_POSES } from './poses';
import { AETHER_STROKE_SECONDS } from './sequences/defaults';

test('the bundle is a world the engine accepts', () => {
  expect(() => validateBundle(AETHER_BUNDLE, ['nox', 'aether'])).not.toThrow();
  expect(AETHER_BUNDLE.id).toBe('aether');
});

test('the intro pose has exactly the eight arms, in order', () => {
  expect(Object.keys(AETHER_POSES.intro.arms)).toEqual([...ARM_IDS]);
  for (const id of ARM_IDS) expect(AETHER_POSES.intro.arms[id].length, id).toBeGreaterThan(8);
});

test("the head is a round ball with small cheek lobes (spec 2.2)", () => {
  expect(AETHER.head.halfWidth).toBeGreaterThanOrEqual(0.69);
  expect(AETHER.head.halfWidth).toBeLessThanOrEqual(0.77);
  expect(AETHER.head.top).toBeGreaterThanOrEqual(0.14);
  expect(AETHER.head.top).toBeLessThanOrEqual(0.22);
  expect(AETHER.head.cheeks.radius).toBeGreaterThanOrEqual(0.04);
  expect(AETHER.head.cheeks.radius).toBeLessThanOrEqual(0.08);
});

test('the eyes land at y -0.68, 0.345 either side of the face', () => {
  expect(Math.abs(faceAnchor(AETHER_BUNDLE, 'intro')[1] - -0.68)).toBeLessThanOrEqual(0.05);
  const [oy] = [AETHER.head.faceOrigin[1]];
  const [left, right] = AETHER.face.eye.centers;
  expect(oy + left[1]).toBeCloseTo(-0.68, 2);
  expect(right[0] - left[0]).toBeCloseTo(0.69, 2);
});

test('the character is within the clamp (clamping changes nothing)', () => {
  expect(clampCharacterConfig(AETHER)).toEqual(AETHER);
});

test('the shipped bundle carries exactly the ten technologies of panel 5', () => {
  expect(AETHER_BUNDLE.content.technologies.length).toBe(10);
});

test("the entrance sheet's stroke length is the character's stroke (recovery + power + glide)", () => {
  const { recovery, power, glide } = AETHER.personality.swim;
  expect(AETHER_STROKE_SECONDS).toBeCloseTo(recovery + power + glide, 9);
});

test('her personality is spec 7.8', () => {
  const p = AETHER.personality;
  expect([p.blinkInterval, p.doubleBlinkChance, p.gazeOmega, p.headOmega, p.sway, p.curl]).toEqual([[2.8, 6.5], 0.25, 14, 2.8, 0.55, 1.25]);
  expect([p.float, p.breathPeriod]).toEqual([{ amplitude: 0.07, period: 6.8 }, 5.0]);
  expect(p.swim).toEqual({ recovery: 0.6, power: 0.24, glide: 0.85, fill: 0.04, squeeze: 0.06 });
});

test('the place is the engine backdrop spec 7.7 gives: tilt 0.04, a touch floatier than Nox, an empty kit, no lights', () => {
  const place = AETHER_BUNDLE.place;
  expect(place.camera.tilt).toBe(0.04);
  expect(place.camera.hover).toEqual({ amount: 1.0 * 1, pace: 0.85 * 1 });
  expect(place.kit.pieces).toEqual([]);
  expect(place.lights.points).toEqual([]);
  expect(place.kit.url).toBe('/aether/world/stage.glb');
});

/** A colour string as sRGB 0..255 (hex, rgb(), rgba() or color(srgb-linear ...)), or null when it is not one. */
function srgb(value: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)) as [number, number, number];
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const lin = /^color\(srgb-linear\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\)$/.exec(value);
  if (lin) return [1, 2, 3].map(i => 255 * (Number(lin[i]) <= 0.0031308 ? 12.92 * Number(lin[i]) : 1.055 * Number(lin[i]) ** (1 / 2.4) - 0.055)) as [number, number, number];
  return null;
}

/** Red: a saturated, bright colour whose hue lies within 20 degrees of red (spec 7.7: no red anywhere; pinks, magentas and amber are not red). */
function isRed([r, g, b]: [number, number, number]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 90 || (max - min) / max < 0.5) return false;
  let hue = max === r ? ((g - b) / (max - min)) * 60 : max === g ? 120 + ((b - r) / (max - min)) * 60 : 240 + ((r - g) / (max - min)) * 60;
  if (hue < 0) hue += 360;
  return hue < 20 || hue > 340;
}

function colours(value: unknown, path: string, out: [string, string][] = []): [string, string][] {
  if (typeof value === 'string' && srgb(value)) out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((item, i) => colours(item, `${path}[${i}]`, out));
  else if (typeof value === 'object' && value !== null) for (const [key, item] of Object.entries(value)) colours(item, `${path}.${key}`, out);
  return out;
}

test('there is no red anywhere in her character, place or theme (spec 7.7), and nothing falls back to a Nox red', () => {
  const all = [...colours(AETHER, 'character'), ...colours(AETHER_BUNDLE.place, 'place'), ...colours(AETHER_BUNDLE.theme, 'theme')];
  expect(all.length).toBeGreaterThan(120);
  expect(all.filter(([, value]) => isRed(srgb(value)!))).toEqual([]);
});

test('the placeholder orbit lays out any count without a visible bubble (the engine cannot take an empty shell list)', () => {
  const { placement } = AETHER_BUNDLE.artifacts;
  if (placement.kind !== 'orbit') throw new Error('the placeholder is the orbit placement');
  for (const count of [1, 10, 15, 16, 20]) {
    for (const stage of ['intro', 'overview'] as const) {
      const orbits = layoutOrbits(count, placement, stage);
      expect(orbits).toHaveLength(count);
      expect(orbits.every(o => o.size === 0 && Number.isFinite(o.radius))).toBe(true);
    }
  }
});

test('the fifteen-technology test set is not in the bundle path: no source the bundle imports names it', () => {
  const seen = new Set<string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const [, spec] of source.matchAll(/(?:from|import\()\s*'(\.[^']+)'/g)) {
      const base = resolve(dirname(file), spec);
      const found = [`${base}.ts`, `${base}/index.ts`, base].find(p => existsSync(p) && statSync(p).isFile());
      if (found && found.endsWith('.ts')) walk(found);
    }
  };
  walk(resolve(import.meta.dirname, 'bundle.ts'));
  expect(seen.size).toBeGreaterThan(8);
  for (const file of seen) expect(readFileSync(file, 'utf8'), file).not.toMatch(/testSets|AETHER_TECHNOLOGIES_15/);
});

// Stopgap: remove when the engine gains 'ringedPlanet' (spec 7.7: no red); this test failing is the cue.
// The engine's only title icon is Nox's red flame; Aether's intro title shows it until then.
test("the title icon is still the flame stopgap (this test failing is the cue to switch to 'ringedPlanet')", () => {
  expect(AETHER_BUNDLE.theme.titleIcon).toBe('flame');
});
