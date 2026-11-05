// The creator's data (platform spec 7.13), types and the presets' names only. Task 17 owns the palettes' maths (palettes.ts), the
// templates, personalities and technology catalogue; Task 18 the validation and the draft's storage. This file is the ONE
// definition of TemplateId, PaletteId and PersonalityId (stills.ts and the creator import them from here).
import type { WorldBundle } from '../../engine/types/bundle';

// The platform reaches the engine's contract types through the one module its boundary allows (engine/types/bundle), so these are
// read off WorldBundle, never imported from a deeper engine module.
/** A world's character configuration (the engine's `CharacterConfig`). */
export type CharacterConfig = WorldBundle['character'];
/** A personality block: the motion of blink, gaze, sway, float, breath, stroke and the micro-animations (the engine's `Personality`). */
export type Personality = CharacterConfig['personality'];
/** A project of a world (the engine's `Project`; a creator draft project becomes one in draftToContent). */
export type Project = WorldBundle['content']['project'];
/** A technology of a catalogue or a project (the engine's `Technology`: id, name, category, iconKey). */
export type Technology = WorldBundle['content']['technologies'][number];

/** One of the four worlds' octopus templates. The listed order is the house order of Explore and the landing (Veyra, Flux, Nox, Aether). */
export type TemplateId = 'nox' | 'veyra' | 'flux' | 'aether';
export const TEMPLATE_IDS: readonly TemplateId[] = ['veyra', 'flux', 'nox', 'aether'];
export const TEMPLATE_NAMES: Readonly<Record<TemplateId, string>> = { veyra: 'Veyra', flux: 'Flux', nox: 'Nox', aether: 'Aether' };

/** "Original" is the template's own colours; the other eight are P4's swatches (swatchColours.ts). */
export type PaletteId = 'original' | 'lavender' | 'teal' | 'mauve' | 'rose' | 'coral' | 'peach' | 'violet' | 'lilacGrey';
export const PALETTE_IDS: readonly PaletteId[] = ['original', 'lavender', 'teal', 'mauve', 'rose', 'coral', 'peach', 'violet', 'lilacGrey'];
export const PALETTE_NAMES: Readonly<Record<PaletteId, string>> = {
  original: 'Original',
  lavender: 'Lavender',
  teal: 'Teal',
  mauve: 'Mauve',
  rose: 'Rose',
  coral: 'Coral',
  peach: 'Peach',
  violet: 'Violet',
  lilacGrey: 'Lilac grey',
};

/**
 * A colour field of a CharacterConfig, named by a dotted path (`'skin.surfaces.mantle.jelly.crown'`, `'glow.halo.color'`, a
 * list index is a number: `'glow.ramp.9.1'`). A palette moves the colour at each slot of a template; nothing else.
 */
export type ColourSlot = string;

/**
 * One of the four worlds' octopuses as a creator template (spec 7.13): its world's bundle without the id and the content
 * (read from the bundle, never copied), the colour slots a palette may move, the face glow's reference colour and the path of the
 * upper-head colour the face rule measures against.
 */
export interface CreatorTemplate {
  id: TemplateId;
  bundle: Omit<WorldBundle, 'id' | 'content'>;
  /** Crown, depth, rim, arm top and halo colours only (never the face, the cups or the lighting). */
  slots: readonly ColourSlot[];
  /** The template's approved face glow, `#rrggbb`, read from its bundle (the colour at `faceGlowAt`): never moved by a palette. */
  faceGlow: string;
  /** The path of the face glow in the character (a glow ramp's last stop, or the glow card's core, whichever the world approved as its face). */
  faceGlowAt: ColourSlot;
  /** The path of the upper-head colour (one of `slots`, so a palette moves it); the face glow must stand out from it. */
  upperHead: ColourSlot;
}

/** Calm is Veyra's personality, Energetic Flux's, Mysterious Nox's, Playful Aether's (spec 7.13). */
export type PersonalityId = 'calm' | 'energetic' | 'mysterious' | 'playful';
export const PERSONALITY_IDS: readonly PersonalityId[] = ['calm', 'energetic', 'mysterious', 'playful'];
export const PERSONALITY_NAMES: Readonly<Record<PersonalityId, string>> = { calm: 'Calm', energetic: 'Energetic', mysterious: 'Mysterious', playful: 'Playful' };

// Placeholders until the shared technology catalogue (Task 19) and the section list exist: plain ids.
export type TechnologyId = string;
export type SectionId = string;
/** The three image types a draft accepts (checked by signature, never by file name; storage.ts). */
export type DraftMediaType = 'image/png' | 'image/jpeg' | 'image/webp';
/** A local image of a project: the blob lives in the browser's `media` store under `id` (storage.ts), never in the draft. */
export interface DraftMediaRef {
  id: string;
  name: string;
  type: DraftMediaType;
  /** Bytes, at most 2 MB. */
  size: number;
}

export interface DraftProject {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  sections: { id: SectionId; body: string }[];
  /** https only (validated by Task 18). */
  links: { live?: string; repo?: string };
  /** From the shared catalogue, declared order, 0 to 30. */
  technologies: TechnologyId[];
  usage: Partial<Record<TechnologyId, string>>;
  /** Local images, 0 to 4. */
  media: DraftMediaRef[];
}

export interface CreatorDraft {
  version: 1;
  octopus: { template: TemplateId; palette: PaletteId; personality: PersonalityId; name: string };
  profile: { handle: string; tagline: string; about: string; location?: string; link?: string };
  /** 0 to 8. */
  projects: DraftProject[];
  updatedAt: string;
}
