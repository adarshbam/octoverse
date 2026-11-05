import { TEMPLATES } from './templates';
import type { Personality, PersonalityId } from './types';

/**
 * The four personalities (platform spec 7.13), each one world's personality block, read from its bundle: Calm is Veyra's, Energetic
 * Flux's, Mysterious Nox's and Playful Aether's. Motion only (blink, gaze, sway, float, breath, stroke, settle, arrival); never
 * expressions or poses.
 */
export const PERSONALITIES: Readonly<Record<PersonalityId, Personality>> = {
  calm: TEMPLATES.veyra.bundle.character.personality,
  energetic: TEMPLATES.flux.bundle.character.personality,
  mysterious: TEMPLATES.nox.bundle.character.personality,
  playful: TEMPLATES.aether.bundle.character.personality,
};
