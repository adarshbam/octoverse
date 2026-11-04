// What the showcase pages say about a world, read from the world's own content modules (platform spec 7.11, 7.12):
// its name and epithet (`<id>.ts`), its project's id, tagline and screenshot (`<id>Project.ts`) and its technologies in
// declared order (`<id>Technologies.ts`). Bare data files all: never a world's bundle, so a page's chunk holds no kit.
// Nothing is copied or invented: a field the content does not have (a link, a location, a usage note) is absent here too.
import { aether } from '../../worlds/aether/content/aether';
import { aetherProject } from '../../worlds/aether/content/aetherProject';
import { aetherTechnologies } from '../../worlds/aether/content/aetherTechnologies';
import { flux } from '../../worlds/flux/content/flux';
import { fluxProject } from '../../worlds/flux/content/fluxProject';
import { fluxTechnologies } from '../../worlds/flux/content/fluxTechnologies';
import { nox } from '../../worlds/nox/content/nox';
import { noxProject } from '../../worlds/nox/content/noxProject';
import { noxTechnologies } from '../../worlds/nox/content/noxTechnologies';
import { veyra } from '../../worlds/veyra/content/veyra';
import { veyraProject } from '../../worlds/veyra/content/veyraProject';
import { veyraTechnologies } from '../../worlds/veyra/content/veyraTechnologies';

export type ShowcaseWorld = 'veyra' | 'flux' | 'nox' | 'aether';

/** One technology of a world's project, in the content's order. `note` is the content's usage note and is absent while the content has none. */
export interface TechnologyView {
  id: string;
  name: string;
  category: string;
  note?: string;
  /** The content flags the note as storyboard text standing in until the owner supplies the real one. */
  placeholder?: true;
}

export interface WorldContent {
  world: ShowcaseWorld;
  name: string;
  epithet: string;
  /** The project's id, which is its route slug (`/@<handle>/<slug>`). */
  slug: string;
  projectTitle: string;
  tagline: string;
  /** The world's overview text (its content's summary, then the introduction the intro shows). */
  overview: string;
  introduction: string;
  technologies: readonly TechnologyView[];
  /** The project's screenshot, only where the content has one: the lighter preview image when it has one. */
  screenshot?: { src: string; alt: string };
  /** A profile link or a location, only where the world's content supplies one (none does yet). */
  link?: string;
  location?: string;
}

interface Source {
  identity: { name: string; epithet: string; project: string; tagline: string; introduction: readonly string[]; summary: string };
  project: {
    id: string;
    media?: readonly { type: string; url: string; previewUrl?: string; alt: string }[];
    technologyUsages?: readonly { technologyId: string; role?: string; summary?: string; placeholder?: boolean }[];
  };
  technologies: readonly { id: string; name: string; category: string }[];
}

const SOURCES: Record<ShowcaseWorld, Source> = {
  veyra: { identity: veyra, project: veyraProject, technologies: veyraTechnologies },
  flux: { identity: flux, project: fluxProject, technologies: fluxTechnologies },
  nox: { identity: nox, project: noxProject, technologies: noxTechnologies },
  aether: { identity: aether, project: aetherProject, technologies: aetherTechnologies },
};

/** A string field the content may or may not carry (the content modules have no `link` or `location` today). */
const supplied = (identity: object, key: 'link' | 'location'): string | undefined => {
  const value = (identity as Record<string, unknown>)[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
};

function build(world: ShowcaseWorld): WorldContent {
  const { identity, project, technologies } = SOURCES[world];
  const shot = project.media?.find(m => m.type === 'screenshot');
  const link = supplied(identity, 'link');
  const location = supplied(identity, 'location');
  return {
    world,
    name: identity.name,
    epithet: identity.epithet,
    slug: project.id,
    projectTitle: identity.project,
    tagline: identity.tagline,
    overview: identity.summary,
    introduction: identity.introduction.join(' '),
    technologies: technologies.map(t => {
      const usage = project.technologyUsages?.find(u => u.technologyId === t.id);
      const note = usage?.summary ?? usage?.role;
      return { id: t.id, name: t.name, category: t.category, ...(note !== undefined && { note, ...(usage?.placeholder && { placeholder: true as const }) }) };
    }),
    ...(shot && { screenshot: { src: shot.previewUrl ?? shot.url, alt: shot.alt } }),
    ...(link !== undefined && { link }),
    ...(location !== undefined && { location }),
  };
}

const CONTENT: Record<ShowcaseWorld, WorldContent> = { veyra: build('veyra'), flux: build('flux'), nox: build('nox'), aether: build('aether') };

/** What a showcase world's pages say, from its content. */
export const contentFor = (world: ShowcaseWorld): WorldContent => CONTENT[world];
