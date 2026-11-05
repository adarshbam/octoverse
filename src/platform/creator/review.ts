import type { WorldBundle } from '../../engine/types/bundle';
import { assembleBundle } from './assembleBundle';
import { emptyDraft } from './draft';
import { draftToContent } from './draftToContent';
import type { CreatorReview } from './reviewParam';
import { TEMPLATES } from './templates';
import type { PersonalityId, TemplateId } from './types';

// The bundle behind the dev-only `?creator=<template>.<palette>` review address (platform spec 7.14): what the engine's review
// capture photographs for the creator stills. A still shows no personality, so each template wears its own world's.

/** The personality of each template's own world (Calm is Veyra's, Energetic Flux's, Mysterious Nox's, Playful Aether's). */
export const DEFAULT_PERSONALITY: Readonly<Record<TemplateId, PersonalityId>> = { veyra: 'calm', flux: 'energetic', nox: 'mysterious', aether: 'playful' };

/** `assembleBundle(template, { palette, personality: default, name: '', handle: 'review' }, emptyContent)`. */
export function creatorReviewBundle({ template, palette }: CreatorReview): WorldBundle {
  const emptyContent = draftToContent(emptyDraft(), null);
  return assembleBundle(TEMPLATES[template], { palette, personality: DEFAULT_PERSONALITY[template], name: '', handle: 'review' }, emptyContent);
}
