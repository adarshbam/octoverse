import { describe, expect, test } from 'vitest';
import { restFromCurve } from '../../engine/character/armChain';
import { armRadius } from '../../engine/character/armTube';
import { ARM_IDS, STAGE_IDS, type ArmId, type Point2 } from '../../engine/config/types';
import { clampCharacterConfig } from '../../engine/config/validate';
import { faceAnchor, validateBundle } from '../../engine/types/bundle';
import { HOST_ARTIFACTS } from './artifacts';
import { HOST_BUNDLE } from './bundle';
import { HOST } from './character';
import { HOST_CONTENT } from './content/index';
import { REEF_STAGE } from './place/config';
import { HOST_POSES, INTRO_TRACED } from './poses';
import { HOST_SWIM } from './swim';
import { HOST_THEME } from './theme';

// The host's bundle (platform spec 2.2, 7.1 to 7.5): a valid world with no technologies, the intro
// traced from P2, and the head, face and arm span on spec 2.2's targets. `resolveWorld` finding
// it is the registry's test (src/worlds/index.test.ts): a world may not import the registry.

/** The intro's left and right silhouette edges, in stage units: each traced arm's centre line ± its tube radius. */
function introEdges(arms: Record<ArmId, readonly Point2[]> = INTRO_TRACED) {
  let left = Infinity;
  let right = -Infinity;
  for (const id of ARM_IDS) {
    const spec = HOST.arms.find(arm => arm.id === id)!;
    const rest = restFromCurve(arms[id]);
    // Only x matters for the span: walk the resampled chain from the root.
    let x = rest.rootX;
    for (let k = 0; k <= rest.angles.length; k++) {
      const r = armRadius(k / rest.angles.length, spec, HOST);
      left = Math.min(left, x - r);
      right = Math.max(right, x + r);
      if (k < rest.angles.length) x += rest.segmentLength * Math.cos(rest.angles[k]);
    }
  }
  return { left, right, span: right - left };
}

describe('the host bundle', () => {
  test('is a valid world under the id octoverse', () => {
    expect(HOST_BUNDLE.id).toBe('octoverse');
    expect(() => validateBundle(HOST_BUNDLE)).not.toThrow();
  });

  test('has no technologies to choose, and no slots to place them in', () => {
    expect(HOST_BUNDLE.content.technologies.length).toBe(0);
    expect(HOST_ARTIFACTS.choosableIn).toEqual([]);
    expect(HOST_ARTIFACTS.placement.shells).toEqual([]);
  });

  test('its project is OctoVerse itself, with no sections', () => {
    expect(HOST_CONTENT.project).toMatchObject({ id: 'octoverse', name: 'OctoVerse', tagline: 'Create. Showcase. Belong.' });
    expect(HOST_CONTENT.project.sections ?? []).toEqual([]);
    expect(HOST_CONTENT.project.technologyUsages ?? []).toEqual([]);
    expect(HOST_BUNDLE.content).toBe(HOST_CONTENT);
  });

  test('every stage pose has exactly the eight arms, and the overview never swells the head', () => {
    expect(Object.keys(HOST_POSES.intro.arms)).toEqual([...ARM_IDS]);
    for (const stage of STAGE_IDS) expect(Object.keys(HOST_POSES[stage].arms), stage).toEqual([...ARM_IDS]);
    expect(HOST_POSES.overview.headMorph).toBe(0);
    for (const stage of STAGE_IDS) expect(HOST_POSES[stage].headMorph, stage).toBe(0);
  });

  test('the swim poses are the intro arms for now (placeholders until the host swims)', () => {
    expect(HOST_SWIM.open.arms).toEqual(HOST_POSES.intro.arms);
    expect(HOST_SWIM.trail.arms).toEqual(HOST_POSES.intro.arms);
  });

  test('the host has no head effect', () => {
    expect(HOST.headEffect).toBeNull();
  });

  test('the head is on spec 2.2: half-width 0.84 ± 0.04, top 0.33 ± 0.04, centred', () => {
    expect(HOST.head.halfWidth).toBeGreaterThanOrEqual(0.8);
    expect(HOST.head.halfWidth).toBeLessThanOrEqual(0.88);
    expect(HOST.head.top).toBeGreaterThanOrEqual(0.29);
    expect(HOST.head.top).toBeLessThanOrEqual(0.37);
    expect(Math.abs(HOST.head.centerX + HOST_POSES.intro.body.x)).toBeLessThanOrEqual(0.04);
  });

  test('the face anchor sits at the eyes, y -0.56 ± 0.05, in the intro', () => {
    expect(Math.abs(faceAnchor(HOST_BUNDLE, 'intro')[1] - -0.56)).toBeLessThanOrEqual(0.05);
  });

  test('the intro arm span is 4.70 ± 0.20 (spec 2.2)', () => {
    const { span } = introEdges();
    expect(span).toBeGreaterThanOrEqual(4.5);
    expect(span).toBeLessThanOrEqual(4.9);
  });

  test('every traced arm starts at its hidden root under the mantle', () => {
    for (const id of ARM_IDS) {
      const [x, y] = INTRO_TRACED[id][0];
      expect(Math.abs(x), id).toBeLessThan(HOST.head.halfWidth);
      expect(y, id).toBeLessThan(HOST.head.waist);
    }
  });

  test('the character is already inside the clamp: clamping changes nothing', () => {
    expect(clampCharacterConfig(HOST)).toEqual(HOST);
  });

  test('the stage backdrop has no kit, and drifts at Nox amount and 0.85 of his pace', () => {
    expect(REEF_STAGE.kit.pieces).toEqual([]);
    expect(REEF_STAGE.near).toBeUndefined();
    expect(REEF_STAGE.farPlate).toBeUndefined();
    expect(REEF_STAGE.camera.hover).toEqual({ amount: 1, pace: 0.85 });
    expect(HOST_BUNDLE.place).toBe(REEF_STAGE);
  });

  test('the theme is the host theme, with a lavender accent and focus ring', () => {
    expect(HOST_BUNDLE.theme).toBe(HOST_THEME);
    for (const colour of [HOST_THEME.accent, HOST_THEME.focusRing]) {
      const [r, g, b] = [1, 3, 5].map(i => parseInt(colour.slice(i, i + 2), 16));
      // Lavender: light, blue above red above green.
      expect(b, colour).toBeGreaterThan(r);
      expect(r, colour).toBeGreaterThan(g);
      expect(g, colour).toBeGreaterThan(120);
    }
  });
});
