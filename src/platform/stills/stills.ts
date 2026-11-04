import manifest from './manifest.json';

// Engine-rendered stills (scripts/platform-stills.mjs, spec 7.14). Never hand-edited; reference art is never a still.
// TemplateId and PaletteId are defined by platform Task 17; until it lands the creator half of StillKey
// repeats their literals, and Task 18 fills the creator set.
export type StillWorld = 'nox' | 'veyra' | 'flux' | 'aether';
export type StillTemplate = 'nox' | 'veyra' | 'flux' | 'aether';
export type StillPalette = 'original' | 'lavender' | 'teal' | 'mauve' | 'rose' | 'coral' | 'peach' | 'violet' | 'lilacGrey';

export type StillKey =
  | { kind: 'world'; world: StillWorld }
  | { kind: 'creator'; template: StillTemplate; palette: StillPalette };

export interface Still {
  src: string;
  width: number;
  height: number;
}

/** The manifest key string for a StillKey, e.g. `world:nox` or `creator:nox:original`. */
export function stillKey(key: StillKey): string {
  return key.kind === 'world' ? `world:${key.world}` : `creator:${key.template}:${key.palette}`;
}

/** The still for a key: its public URL and its pixel size. Throws when the manifest has no such still. */
export function stillFor(key: StillKey): Still {
  const id = stillKey(key);
  const entry = manifest.entries.find((e) => e.key === id);
  if (!entry) throw new Error(`no still recorded for ${id}`);
  return { src: `/platform/stills/${entry.file}`, width: manifest.width, height: manifest.height };
}
