import { SHOWCASE } from '../fixtures/showcase';
import { RESERVED_HANDLES } from '../router/routes';
import { CATALOG } from './catalog';
import { PALETTE_IDS, PERSONALITY_IDS, TEMPLATE_IDS, type CreatorDraft, type DraftMediaRef, type DraftProject } from './types';

// The creator's draft (platform spec 7.13): the empty draft, its field rules and the migration of a stored one. Pure; nothing here
// touches storage (storage.ts) or the engine. Validation is inline, per field, and never blocks a save: it only reports.

export const MAX_PROJECTS = 8;
export const MAX_TECHNOLOGIES = 30;
export const MAX_MEDIA = 4;
/** An image of a draft is at most 2 MB (spec 7.13). */
export const MAX_MEDIA_BYTES = 2 * 1024 * 1024;
/** All the images of a draft together are at most 24 MB (the browser's storage is shared; spec 7.13 sets 4 images of 2 MB a project). */
export const MAX_MEDIA_TOTAL_BYTES = 24 * 1024 * 1024;
/** A project's title is at most 80 characters. */
export const MAX_TITLE_LENGTH = 80;
/** A link is at most this long (a longer one is not a link). */
const MAX_URL_LENGTH = 2048;
export const MEDIA_TYPES: readonly DraftMediaRef['type'][] = ['image/png', 'image/jpeg', 'image/webp'];

/** The octopus name (spec 7.13): 1 to 24 of letters, digits, space, `.`, `-` and the apostrophe. */
export const NAME_RE = /^[A-Za-z0-9 .'-]{1,24}$/;
/** The profile handle (spec 7.13, the same pattern the router reads). */
export const HANDLE_RE = /^[a-z][a-z0-9-]{1,23}$/;
/** A project's slug is a route segment (router/routes.ts). */
export const SLUG_RE = /^[a-z0-9-]{1,40}$/;

/**
 * Handles the creator may not take because a showcase portfolio (or the host) already answers at them: `/@nox` is the showcase's. The four showcase handles are read from the
 * showcase fixtures; the host's (`octoverse`) is the one literal, held against the world registry by draft.test.ts. Kept here, not in the
 * router's RESERVED_HANDLES (those are the platform's own paths).
 */
export const SHOWCASE_HANDLES: readonly string[] = [...SHOWCASE.map(profile => profile.handle), 'octoverse'];

/** A value as it is echoed in an issue message: never more than 40 characters, however long a damaged draft makes it. */
const echo = (value: unknown): string => {
  const text = String(value);
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
};

export interface DraftIssue {
  field: string;
  message: string;
}

const CATALOG_IDS: ReadonlySet<string> = new Set(CATALOG.map(t => t.id));

/** A new draft with nothing in it: Aether, Original, Playful, no name, no handle, no projects. Each call returns fresh objects. */
export function emptyDraft(): CreatorDraft {
  return {
    version: 1,
    octopus: { template: 'aether', palette: 'original', personality: 'playful', name: '' },
    profile: { handle: '', tagline: '', about: '' },
    projects: [],
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------------------------
// Reading unknown values (nothing below throws on any input)
// ---------------------------------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const optionalText = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback);

/**
 * THE link rule of the creator (spec 7.13), the one predicate behind validation, the flag under a field and the href: an exact
 * `https://host...` address, parsed, or null. Nothing is trimmed (a value with a space before or after is not a link), the text must
 * itself start with `https://` (any case for the scheme; `https:x.com` and `//x.com` are not links), no whitespace, control character or
 * backslash anywhere, the host is not empty (`https:///x`), no user name or password, at most 2048 characters. The returned URL's `href`
 * is what a link may point to (normalised: lower-case host, punycode), never the raw text.
 */
export function parseHttpsUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\s\\\u0000-\u001f\u007f]/.test(value)) return null;
  if (!/^https:\/\//i.test(value)) return null;
  const authority = value.slice('https://'.length);
  if (authority === '' || /^[/?#]/.test(authority)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.hostname === '') return null;
    return url;
  } catch {
    return null;
  }
}

/** Whether `value` is an https address by the one rule above (a link that is not one is kept but not linked and flagged). */
export const isHttpsUrl = (value: unknown): boolean => parseHttpsUrl(value) !== null;

/** The bytes of every image the draft lists. */
export function mediaBytes(draft: CreatorDraft): number {
  // Defensive: validateDraft calls this on a draft that may be damaged (a null project, media that is not a list).
  let total = 0;
  const projects: unknown = (draft as { projects?: unknown } | null)?.projects;
  if (!Array.isArray(projects)) return 0;
  for (const project of projects) {
    const media: unknown = (project as { media?: unknown } | null)?.media;
    if (!Array.isArray(media)) continue;
    for (const m of media) {
      const size: unknown = (m as { size?: unknown } | null)?.size;
      total += typeof size === 'number' && Number.isFinite(size) ? size : 0;
    }
  }
  return total;
}

// ---------------------------------------------------------------------------------------------
// validateDraft
// ---------------------------------------------------------------------------------------------

function checkProject(raw: unknown, i: number, seen: { ids: Set<string>; slugs: Set<string> }, out: DraftIssue[]) {
  const at = `projects[${i}]`;
  const add = (field: string, message: string) => out.push({ field: `${at}${field}`, message });
  if (!isRecord(raw)) return add('', 'is not a project');
  const { id, slug, links, technologies, usage, media, sections } = raw;

  if (typeof id !== 'string' || id === '') add('.id', 'needs an id');
  else if (seen.ids.has(id)) add('.id', 'is the id of another project');
  else seen.ids.add(id);
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) add('.slug', 'needs a slug of lower case letters, digits and hyphens, 1 to 40 long');
  else if (seen.slugs.has(slug)) add('.slug', 'is the slug of another project');
  else seen.slugs.add(slug);
  for (const key of ['title', 'tagline'] as const) if (typeof raw[key] !== 'string') add(`.${key}`, 'needs text');
  if (typeof raw.title === 'string' && Array.from(raw.title).length > MAX_TITLE_LENGTH) add('.title', `has ${Array.from(raw.title).length} characters; a title is at most ${MAX_TITLE_LENGTH}`);

  if (!Array.isArray(sections)) add('.sections', 'needs a list');
  else
    sections.forEach((section: unknown, s) => {
      if (!isRecord(section) || typeof section.id !== 'string' || typeof section.body !== 'string') add(`.sections[${s}]`, 'needs an id and a body');
    });

  if (!isRecord(links)) add('.links', 'needs live and repo links');
  else
    for (const key of ['live', 'repo'] as const) {
      const link = links[key];
      if (link !== undefined && link !== '' && !isHttpsUrl(link)) add(`.links.${key}`, 'needs an https:// address (a link that is not one is kept but not linked)');
    }

  if (!Array.isArray(technologies)) add('.technologies', 'needs a list');
  else {
    if (technologies.length > MAX_TECHNOLOGIES) add('.technologies', `has ${technologies.length}; a project has at most ${MAX_TECHNOLOGIES} technologies`);
    const chosen = new Set<unknown>();
    technologies.forEach((tech: unknown, t) => {
      if (typeof tech !== 'string' || !CATALOG_IDS.has(tech)) add(`.technologies[${t}]`, `"${echo(tech)}" is not in the technology catalog`);
      else if (chosen.has(tech)) add(`.technologies[${t}]`, `"${echo(tech)}" is listed twice`);
      chosen.add(tech);
    });
  }
  if (!isRecord(usage)) add('.usage', 'needs a usage note per technology');
  else for (const [tech, note] of Object.entries(usage)) if (typeof note !== 'string') add(`.usage.${echo(tech)}`, 'needs text');

  if (!Array.isArray(media)) add('.media', 'needs a list');
  else {
    if (media.length > MAX_MEDIA) add('.media', `has ${media.length}; a project has at most ${MAX_MEDIA} images`);
    media.forEach((m: unknown, k) => {
      if (!isRecord(m) || typeof m.id !== 'string' || typeof m.name !== 'string') return add(`.media[${k}]`, 'is not an image of the draft');
      if (!(MEDIA_TYPES as readonly unknown[]).includes(m.type)) add(`.media[${k}]`, 'needs a PNG, JPEG or WebP image');
      else if (typeof m.size !== 'number' || !Number.isFinite(m.size) || m.size < 0 || m.size > MAX_MEDIA_BYTES) add(`.media[${k}]`, 'needs an image of at most 2 MB');
    });
  }
}

/** Every field of the draft that breaks a rule of spec 7.13, by name. Never throws, whatever it is given (a non-object has issues too). */
export function validateDraft(draft: CreatorDraft): DraftIssue[] {
  const out: DraftIssue[] = [];
  try {
    const add = (field: string, message: string) => out.push({ field, message });
    const d: unknown = draft;
    if (!isRecord(d)) return [{ field: 'draft', message: 'is not a draft' }];
    if (d.version !== 1) add('version', 'needs version 1');

    const { octopus, profile, projects } = d;
    if (!isRecord(octopus)) add('octopus', 'is missing');
    else {
      if (!(TEMPLATE_IDS as readonly unknown[]).includes(octopus.template)) add('octopus.template', 'needs one of the four templates');
      if (!(PALETTE_IDS as readonly unknown[]).includes(octopus.palette)) add('octopus.palette', 'needs one of the nine palettes');
      if (!(PERSONALITY_IDS as readonly unknown[]).includes(octopus.personality)) add('octopus.personality', 'needs one of the four personalities');
      if (typeof octopus.name !== 'string' || !NAME_RE.test(octopus.name) || octopus.name.trim() === '') add('octopus.name', 'needs 1 to 24 letters, numbers, spaces, - . or \' (until then it shows as "Your Octopus")');
    }

    if (!isRecord(profile)) add('profile', 'is missing');
    else {
      const { handle } = profile;
      if (typeof handle !== 'string' || !HANDLE_RE.test(handle)) add('profile.handle', 'needs 2 to 24 lower case letters, numbers or hyphens, starting with a letter');
      else if ((RESERVED_HANDLES as readonly string[]).includes(handle)) add('profile.handle', `"${echo(handle)}" is reserved`);
      else if (SHOWCASE_HANDLES.includes(handle)) add('profile.handle', 'That handle is used by a showcase portfolio');
      for (const key of ['tagline', 'about'] as const) if (typeof profile[key] !== 'string') add(`profile.${key}`, 'needs text');
      if (profile.location !== undefined && typeof profile.location !== 'string') add('profile.location', 'needs text');
      if (profile.link !== undefined && profile.link !== '' && !isHttpsUrl(profile.link)) add('profile.link', 'needs an https:// address');
    }

    if (!Array.isArray(projects)) add('projects', 'needs a list of projects');
    else {
      if (projects.length > MAX_PROJECTS) add('projects', `has ${projects.length}; a draft has at most ${MAX_PROJECTS} projects`);
      const seen = { ids: new Set<string>(), slugs: new Set<string>() };
      projects.forEach((project: unknown, i) => checkProject(project, i, seen, out));
    }
    if (Array.isArray(projects) && mediaBytes(d as unknown as CreatorDraft) > MAX_MEDIA_TOTAL_BYTES) add('media', `has more than ${MAX_MEDIA_TOTAL_BYTES / (1024 * 1024)} MB of images; a draft has at most that`);
    if (typeof d.updatedAt !== 'string') add('updatedAt', 'needs a date');
  } catch {
    out.push({ field: 'draft', message: 'could not be checked' });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// migrateDraft
// ---------------------------------------------------------------------------------------------

function migrateMedia(raw: unknown): DraftMediaRef[] {
  if (!Array.isArray(raw)) return [];
  const out: DraftMediaRef[] = [];
  for (const m of raw as unknown[]) {
    if (!isRecord(m) || typeof m.id !== 'string' || typeof m.name !== 'string' || !(MEDIA_TYPES as readonly unknown[]).includes(m.type)) continue;
    out.push({ id: m.id, name: m.name, type: m.type as DraftMediaRef['type'], size: typeof m.size === 'number' && Number.isFinite(m.size) ? m.size : 0 });
  }
  return out;
}

function migrateProject(raw: unknown): DraftProject | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null;
  const links: DraftProject['links'] = {};
  if (isRecord(raw.links)) {
    if (typeof raw.links.live === 'string') links.live = raw.links.live;
    if (typeof raw.links.repo === 'string') links.repo = raw.links.repo;
  }
  // fromEntries defines own properties, so a key like "__proto__" in a damaged store stays a plain key and never reaches the prototype.
  const notes: [string, string][] = [];
  if (isRecord(raw.usage)) for (const [tech, note] of Object.entries(raw.usage)) if (typeof note === 'string') notes.push([tech, note]);
  const usage: DraftProject['usage'] = Object.fromEntries(notes);
  return {
    id: raw.id,
    slug: text(raw.slug, raw.id),
    title: text(raw.title),
    tagline: text(raw.tagline),
    sections: Array.isArray(raw.sections) ? raw.sections.filter((s): s is { id: string; body: string } => isRecord(s) && typeof s.id === 'string' && typeof s.body === 'string').map(s => ({ id: s.id, body: s.body })) : [],
    links,
    technologies: Array.isArray(raw.technologies) ? raw.technologies.filter((t): t is string => typeof t === 'string') : [],
    usage,
    media: migrateMedia(raw.media),
  };
}

/**
 * A stored value as a draft of the current version (version 1 today). A version-1 object keeps everything well-formed in it and has
 * the rest repaired to a safe type (so the editor cannot crash on a damaged store); anything else (not an object, another version)
 * is the empty draft. Always a new object. Validation is separate: a migrated draft may still have issues.
 */
export function migrateDraft(raw: unknown): CreatorDraft {
  try {
    if (!isRecord(raw) || raw.version !== 1) return emptyDraft();
    const fresh = emptyDraft();
    const octopus = isRecord(raw.octopus) ? raw.octopus : {};
    const profile = isRecord(raw.profile) ? raw.profile : {};
    const location = optionalText(profile.location);
    const link = optionalText(profile.link);
    return {
      version: 1,
      octopus: {
        template: oneOf(octopus.template, TEMPLATE_IDS, fresh.octopus.template),
        palette: oneOf(octopus.palette, PALETTE_IDS, fresh.octopus.palette),
        personality: oneOf(octopus.personality, PERSONALITY_IDS, fresh.octopus.personality),
        name: text(octopus.name),
      },
      profile: { handle: text(profile.handle), tagline: text(profile.tagline), about: text(profile.about), ...(location !== undefined && { location }), ...(link !== undefined && { link }) },
      projects: Array.isArray(raw.projects) ? raw.projects.map(migrateProject).filter((p): p is DraftProject => p !== null) : [],
      updatedAt: text(raw.updatedAt, fresh.updatedAt),
    };
  } catch {
    return emptyDraft();
  }
}
