import { type ReviewOptions, defaultReviewOptions } from '../../engine/behavior/urlState';
import type { LinkStage } from '../../engine/behavior/stageMachine';
import type { StagePose } from '../../engine/poses/types';
import type { WorldBundle } from '../types/bundle';
import type { QualityTier } from '../stage/quality';
import { LAST_LEVEL } from '../world/worldLevel';

// The options a host page gives `WorldHost` beyond the world's bundle (spec 19, amendment A2): how a
// preview is drawn, and what the head's swell needs. Each maps onto what the host already does.

/** How a preview instance (`mode: 'preview'`) is drawn: a mini octopus on a card, or a backdrop. */
export interface PreviewOptions {
  /** The stage it opens on (never the entrance: a preview does not play it). */
  stage: LinkStage;
  /** The most its quality tier may be: the tier is the lower of the device's and this. */
  tierCap?: QualityTier;
  /** `still` holds every motion (a frozen frame); `ambient` lets the world and the character move. */
  motion: 'still' | 'ambient';
  /** `full` draws the whole world; `backdrop` only its water, fog and light (the world's lowest level, no kit). */
  place: 'full' | 'backdrop';
  /** `settled` shows the artifacts simply there (no blow, no appear); `hidden` shows none. */
  artifacts: 'settled' | 'hidden';
}

/**
 * A preview's options as the review options the host reads. The stage is the one asked for, so the
 * instance never starts on `entering`; `settled` carries no sheet (the bubbles are there at once)
 * and the swell and appear sheets are not played in a frozen preview either.
 */
export function previewToReview(p: PreviewOptions): ReviewOptions {
  return {
    ...defaultReviewOptions(),
    stage: p.stage,
    freeze: p.motion === 'still',
    tierCap: p.tierCap,
    worldLevel: p.place === 'backdrop' ? LAST_LEVEL : 0,
    artifacts: p.artifacts,
  };
}

/**
 * `options` with a preview's choices laid over them: exactly the review options the preview covers
 * (stage, freeze, tier cap, world level, artifacts) replace the page's, and every other one (the
 * dev switches such as `noWebgl`, `tier`, `kitWait`) is as the page gave it.
 */
export function applyPreview(options: ReviewOptions, p: PreviewOptions): ReviewOptions {
  const { stage, freeze, tierCap, worldLevel, artifacts } = previewToReview(p);
  return { ...options, stage, freeze, tierCap, worldLevel, artifacts };
}

/** Whether a stage's pose opens the head (the swell): from this much `headMorph` on. A pose with `headMorph: 0` never swells. */
export const HEAD_OPEN_FROM = 0.5;
export const headOpens = (pose: Pick<StagePose, 'headMorph'>) => pose.headMorph >= HEAD_OPEN_FROM;

const serials = new WeakMap<WorldBundle, number>();
let serial = 0;

/**
 * The React key of the instance a bundle gets: its id and which bundle object it is. The instance
 * reads its bundle once, at mount, so a new bundle object of the same world (a hot edit, a creator
 * previewing a change to a `u-` bundle) must be a new instance, not the old world kept. Keyed on
 * the object, so an embedder must keep its bundle stable: a new object on every render remounts the
 * instance every time.
 */
export function instanceKey(bundle: WorldBundle): string {
  let n = serials.get(bundle);
  if (n === undefined) serials.set(bundle, (n = ++serial));
  return `${bundle.id}#${n}`;
}
