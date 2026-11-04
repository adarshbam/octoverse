import { expect, test } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ARM_IDS } from '../../engine/config/types';
import { clampCharacterConfig } from '../../engine/config/validate';
import { faceAnchor, validateBundle } from '../../engine/types/bundle';
import { PLACEMENTS, choiceRemoved, choosableNow } from '../../engine/artifacts/strategies';
import { beadAngles, ringLineVisible, ringPoint } from '../../engine/artifacts/satellite';
import { CAMERA_Z } from '../../engine/config/stage';
import targets from './review/targets.json';
import { AETHER_BUNDLE } from './bundle';
import { AETHER } from './character';
import { AETHER_POSES } from './poses';
import { OBSERVATORY_STAGE, OBSERVATORY_WORLD } from './place/config';
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

test("the place is the observatory world (Task 9): tilt 0.04, a touch floatier than Nox, the kit, its bake and far plate; the stage backdrop is kept", () => {
  const place = AETHER_BUNDLE.place;
  expect(place).toBe(OBSERVATORY_WORLD);
  expect(place.camera.tilt).toBe(0.04);
  expect(place.camera.hover).toEqual({ amount: 1.0 * 1, pace: 0.85 * 1 });
  expect(place.kit.url).toBe('/aether/world/kit.glb');
  expect(place.near?.url).toBe('/aether/world/near.glb');
  expect(place.farPlate?.layers.length).toBe(3);
  // The stage backdrop (Tasks 1 to 8): an empty kit, no lights.
  expect(OBSERVATORY_STAGE.kit.pieces).toEqual([]);
  expect(OBSERVATORY_STAGE.lights.points).toEqual([]);
  expect(OBSERVATORY_STAGE.kit.url).toBe('/aether/world/stage.glb');
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

test('her artifacts rest on the gold ring (the satellite placement), with the values of spec 2.2 and 7.5', () => {
  const { placement } = AETHER_BUNDLE.artifacts;
  if (placement.kind !== 'satellite') throw new Error('Aether places her artifacts on the satellite ring');
  const { ring } = placement;
  expect(ring).toMatchObject({ radius: 1.25, centreY: -0.28, tilt: 1.36, roll: 0.14, beadCount: 5, keepOut: Math.PI / 4 });
  expect(ring.sway).toEqual({ amplitude: 0.21, period: [6, 9] });
  // 1.4: the spec's 1.5 px limit measured 1.49 to 1.60 px with the anti-aliased fringe at 1.5 (Task 6).
  expect(ring.line).toMatchObject({ color: '#d99982', width: 1.4 });
  expect(ring.beads).toEqual({ glass: '#93699a', rim: '#d99982', lit: [1, 3] });
  // Five homes, 54 degrees apart, evenly over the rear 270 degrees (the face's 90 degrees left clear).
  expect(ring.homes).toHaveLength(ring.beadCount);
  ring.homes.forEach((home, i) => expect((home * 180) / Math.PI).toBeCloseTo(45 + 27 + 54 * i, 9));
  // The roll is the 8 degree lift of the right side.
  expect((ring.roll * 180) / Math.PI).toBeCloseTo(8, 0);
  // No bead ever reaches the face's sector, swaying or not.
  for (let t = 0; t <= 60; t += 1 / 60) for (const a of beadAngles(t, ring, false)) expect(Math.abs(Math.atan2(Math.sin(a), Math.cos(a)))).toBeGreaterThan(ring.keepOut);
});

test("seen from P2's camera, the ring's centre and half-width are within the review targets, and it never crosses the eyes or the mouth", () => {
  const { placement } = AETHER_BUNDLE.artifacts;
  if (placement.kind !== 'satellite') throw new Error('Aether places her artifacts on the satellite ring');
  const { ring } = placement;
  const x0 = AETHER.head.centerX;
  const seen = Array.from({ length: 720 }, (_, i) => {
    const angle = (i / 720) * 2 * Math.PI;
    const [x, y, z] = ringPoint(angle, ring);
    const f = CAMERA_Z / (CAMERA_Z - z);
    return { angle, x: (x0 + x) * f, y: y * f };
  });
  const xs = seen.map(p => p.x);
  const ys = seen.map(p => p.y);
  const halfWidth = (Math.max(...xs) - Math.min(...xs)) / 2;
  const centreY = (Math.max(...ys) + Math.min(...ys)) / 2;
  const [cLow, cHigh] = targets.ring.centreY;
  const [wLow, wHigh] = targets.ring.halfWidth;
  expect(centreY).toBeGreaterThanOrEqual(cLow);
  expect(centreY).toBeLessThanOrEqual(cHigh);
  expect(halfWidth).toBeGreaterThanOrEqual(wLow);
  expect(halfWidth).toBeLessThanOrEqual(wHigh);
  // Where the line shows at all, it stays clear of the eyes (their centres +- the eye's size) and the mouth.
  const [fx, fy] = AETHER.head.faceOrigin;
  const { eye, mouth } = AETHER.face;
  const eyes = eye.centers.map(([ex, ey]) => [fx + ex, fy + ey] as const);
  for (const p of seen) {
    if (ringLineVisible(p.angle, ring) === 0) continue;
    for (const [ex, ey] of eyes) expect(Math.hypot((p.x - ex) / (eye.rx * 1.6), (p.y - ey) / (eye.ry * 1.6)), `angle ${p.angle}`).toBeGreaterThan(1);
    expect(Math.hypot(p.x - (fx + mouth.center[0]), p.y - (fy + mouth.center[1]))).toBeGreaterThan(mouth.halfWidth * 1.5);
  }
});

test('the intro offers no technology choice (spec 7.5, 8 item 14): no buttons, no tray, no ring bead to choose; the overview does', () => {
  const { artifacts } = AETHER_BUNDLE;
  expect(artifacts.choosableIn).toEqual(['overview']);
  expect(choosableNow('intro', artifacts)).toBe(false);
  expect(choiceRemoved('intro', artifacts)).toBe(true);
  expect(choosableNow('overview', artifacts)).toBe(true);
  // The beads are the ring's own: the placement lays out no artifact (no orb, button or bubbleLive spot) for them.
  const { placement } = artifacts;
  if (placement.kind !== 'satellite') throw new Error('Aether places her artifacts on the satellite ring');
  for (const stage of ['intro', 'overview'] as const) expect(PLACEMENTS.satellite.layout(AETHER_BUNDLE.content.technologies.length, placement, stage)).toEqual([]);
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
