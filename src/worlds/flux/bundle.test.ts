import { expect, test } from 'vitest';
import { ARM_IDS } from '../../engine/config/types';
import { clampCharacterConfig } from '../../engine/config/validate';
import { faceAnchor, validateBundle } from '../../engine/types/bundle';
import { FLUX_BUNDLE } from './bundle';
import { FLUX } from './character';
import { FLUX_POSES } from './poses';
import { FLUX_STROKE_SECONDS } from './sequences/defaults';

// Flux's bundle (spec 6.2, 7.1, 7.8, 7.10): the shape checks the engine's validateBundle does not
// make for us, and the values the spec fixes for the head and the face anchor. That `?world=flux`
// resolves to this bundle is held in src/worlds/index.test.ts: a world's tests may not import the registry.

test('the bundle is one the engine can draw', () => {
  expect(() => validateBundle(FLUX_BUNDLE)).not.toThrow();
  expect(FLUX_BUNDLE.id).toBe('flux');
  expect(FLUX_BUNDLE.character).toBe(FLUX);
});

test('the intro pose has exactly the eight arms', () => {
  expect(Object.keys(FLUX_POSES.intro.arms)).toEqual([...ARM_IDS]);
});

test('the head: dome half width 0.70 to 0.78, top 0.22 to 0.30, small cheek lobes (spec 2.2)', () => {
  expect(FLUX.head.halfWidth).toBeGreaterThanOrEqual(0.7);
  expect(FLUX.head.halfWidth).toBeLessThanOrEqual(0.78);
  expect(FLUX.head.top).toBeGreaterThanOrEqual(0.22);
  expect(FLUX.head.top).toBeLessThanOrEqual(0.3);
  expect(FLUX.head.cheeks.radius).toBeGreaterThanOrEqual(0.06);
  expect(FLUX.head.cheeks.radius).toBeLessThanOrEqual(0.1);
});

test('the face anchor in the intro is at the eyes, y -0.54 within 0.05', () => {
  // faceAnchor is a Vec3 [x, y, z]: y is the second.
  const [, y] = faceAnchor(FLUX_BUNDLE, 'intro');
  expect(Math.abs(y - -0.54)).toBeLessThanOrEqual(0.05);
});

test("the character's own values are inside the engine's clamp: clamping changes nothing", () => {
  expect(clampCharacterConfig(FLUX)).toEqual(FLUX);
});

test('twelve technologies (spec 7.10), chosen in the overview only (ruling R1)', () => {
  expect(FLUX_BUNDLE.content.technologies.length).toBe(12);
  expect(FLUX_BUNDLE.artifacts.choosableIn).toEqual(['overview']);
});

test("the entrance's stroke is Flux's own stroke: recovery + power + glide (spec 7.8)", () => {
  const { recovery, power, glide } = FLUX.personality.swim;
  expect(recovery + power + glide).toBeCloseTo(FLUX_STROKE_SECONDS, 9);
});

test('every piece of storyboard copy is flagged as a placeholder, and the Live Demo link is labelled', () => {
  const { project } = FLUX_BUNDLE.content;
  expect(project.technologyUsages!.length).toBe(12);
  expect(project.technologyUsages!.every(u => u.placeholder === true)).toBe(true);
  expect(project.sections!.every(s => s.placeholder === true)).toBe(true);
  expect(project.sections!.map(s => s.title)).toEqual(['Overview', 'Features', 'Tech Stack', 'Architecture', 'Challenges', 'What I Learned']);
  expect(project.links!.find(l => l.kind === 'live')!.label).toBe('Live Demo');
});
