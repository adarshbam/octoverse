import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { NOX_BUNDLE } from '../bundle.nox';
import { initialStage } from '../../engine/behavior/stageMachine';
import { STAGE_IDS } from '../../engine/config/types';
import { capTier } from '../stage/quality';
import { startingTier } from '../stage/useQuality';
import { LAST_LEVEL } from '../world/worldLevel';
import { defaultReviewOptions } from '../../engine/behavior/urlState';
import { type PreviewOptions, applyPreview, headOpens, instanceKey, previewToReview } from './options';

const preview = (extra: Partial<PreviewOptions> = {}): PreviewOptions => ({ stage: 'overview', motion: 'still', place: 'backdrop', artifacts: 'hidden', ...extra });

test("a preview opens on its stage, frozen when still, at the world's lowest level, with no entrance", () => {
  const review = previewToReview(preview());
  expect(review.stage).toBe('overview');
  expect(review.freeze).toBe(true);
  expect(review.worldLevel).toBe(LAST_LEVEL);
  expect(review.artifacts).toBe('hidden');
  // The stage asked for is the one it opens on: never the entrance (the stage machine takes it as it is).
  for (const stage of ['intro', 'overview', 'detail'] as const) {
    const start = initialStage({ entranceSeen: false, requested: previewToReview(preview({ stage })).stage, reducedMotion: false });
    expect(start.stage).toBe(stage);
  }
});

test('ambient motion is not frozen, a full place draws all of the world, and a tier cap rides along', () => {
  const review = previewToReview(preview({ motion: 'ambient', place: 'full', artifacts: 'settled', tierCap: 'low' }));
  expect(review.freeze).toBe(false);
  expect(review.worldLevel).toBe(0);
  expect(review.artifacts).toBe('settled');
  expect(review.tierCap).toBe('low');
  // Everything the preview does not cover is the page's default.
  expect(review.solo).toBe(false);
  expect(review.orbit).toBe(false);
  expect(review.noWebgl).toBe(false);
});

test('the tier is the lower of the probed tier and the cap', () => {
  expect(capTier('high', 'low')).toBe('low');
  expect(capTier('low', 'high')).toBe('low');
  expect(capTier('medium')).toBe('medium');
  expect(capTier('high', 'medium')).toBe('medium');
  expect(capTier('medium', 'medium')).toBe('medium');
});

test('the starting tier is held to the cap, frozen or forced; with no cap it is as it was', () => {
  expect(startingTier(previewToReview(preview({ motion: 'still', tierCap: 'low' })))).toEqual({ tier: 'low', adaptive: false });
  expect(startingTier(previewToReview(preview({ motion: 'still' })))).toEqual({ tier: 'high', adaptive: false });
  expect(startingTier({ ...previewToReview(preview({ motion: 'still', tierCap: 'high' })), tier: 'medium' })).toEqual({ tier: 'medium', adaptive: false });
});

test('a bundle whose overview pose has headMorph 0 never swells: no stage opens the head', () => {
  const poses = { ...NOX_BUNDLE.poses, overview: { ...NOX_BUNDLE.poses.overview, headMorph: 0 } };
  // The swell is opened by this alone (WorldHost passes it to the character as `headOpen`).
  for (const stage of STAGE_IDS) expect(headOpens(poses[stage]), stage).toBe(false);
  // Nox's own overview does open it: the test is not vacuous.
  expect(headOpens(NOX_BUNDLE.poses.overview)).toBe(true);
  const host = readFileSync(new URL('./WorldHost.tsx', import.meta.url), 'utf8');
  expect(host).toMatch(/headOpen=\{headOpens\(stagePoseOf\(poses, reviewSwim, shown\)\)\}/);
});

test('an instance follows its bundle: a new bundle object of the same world is a new instance, the same object the same one', () => {
  const edited = { ...NOX_BUNDLE };
  expect(instanceKey(NOX_BUNDLE)).toBe(instanceKey(NOX_BUNDLE));
  expect(instanceKey(edited)).not.toBe(instanceKey(NOX_BUNDLE));
  expect(instanceKey(edited)).toBe(instanceKey(edited));
  // The id is in the key, so another world is another instance as before.
  expect(instanceKey({ ...NOX_BUNDLE, id: 'veyra' })).toMatch(/^veyra#/);
  // The host keys its instance on it (React remounts on a new key; tests/e2e/embedding.spec.ts watches the canvas change).
  const host = readFileSync(new URL('./WorldHost.tsx', import.meta.url), 'utf8');
  expect(host).toMatch(/<EngineInstance key=\{instanceKey\(bundle\)\}/);
  expect(host).not.toMatch(/key=\{valid\.id\}/);
});

test("a preview's choices replace exactly the review options they cover; the page's other switches survive", () => {
  const page = { ...defaultReviewOptions(), noWebgl: true, kitWait: 500, tier: 'medium' as const, solo: true, stage: 'detail' as const, freeze: false };
  const merged = applyPreview(page, preview({ stage: 'intro', tierCap: 'low' }));
  expect(merged).toMatchObject({ noWebgl: true, kitWait: 500, tier: 'medium', solo: true });
  expect(merged).toMatchObject({ stage: 'intro', freeze: true, tierCap: 'low', worldLevel: LAST_LEVEL, artifacts: 'hidden' });
  expect(Object.keys(merged).sort()).toEqual(Object.keys({ ...page, tierCap: 0, worldLevel: 0, artifacts: 0 }).sort());
});
