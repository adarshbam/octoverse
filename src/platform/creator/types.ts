// The creator's data (platform spec 7.13), types and the presets' names only. Task 17 owns the palettes' maths and Task 18 the
// validation and the draft's storage; here the creator composition (Task 10) needs the shapes and the words on screen.

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

/** Calm is Veyra's personality, Energetic Flux's, Mysterious Nox's, Playful Aether's (spec 7.13). */
export type PersonalityId = 'calm' | 'energetic' | 'mysterious' | 'playful';
export const PERSONALITY_IDS: readonly PersonalityId[] = ['calm', 'energetic', 'mysterious', 'playful'];
export const PERSONALITY_NAMES: Readonly<Record<PersonalityId, string>> = { calm: 'Calm', energetic: 'Energetic', mysterious: 'Mysterious', playful: 'Playful' };

// Placeholders until the shared technology catalogue (Task 19) and the section list exist: plain ids.
export type TechnologyId = string;
export type SectionId = string;
/** A local image of a project (stored in the browser only; Task 18). */
export interface DraftMediaRef {
  id: string;
  name: string;
  type: 'image/png' | 'image/jpeg' | 'image/webp';
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
