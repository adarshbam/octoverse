import { CATALOG } from './catalog';
import { MAX_TECHNOLOGIES, isHttpsUrl } from './draft';
import type { CreatorDraft, DraftProject, Project, Technology } from './types';

// A draft project as the engine's content (platform spec 7.13): `{ project, technologies }` for one project, ready for
// assembleBundle. Pure, and it never changes the draft or the catalog; it returns new objects (the technologies are the catalog's own
// frozen entries, which nothing can change). It is forgiving by design: whatever the draft holds, the result is content the engine
// accepts (an unknown technology is left out, a link that is not https is not linked), so a draft always previews.

const catalogById: ReadonlyMap<string, Technology> = new Map(CATALOG.map(t => [t.id, t]));
/** The overview shows at most this many technologies as primary (the engine's MAX_PRIMARY_TECHNOLOGIES); the rest go to the tray. */
const MAX_PRIMARY = 15;

/** The scheme a project image's url has until the preview swaps in the browser's object url for the stored blob. */
export const LOCAL_MEDIA_PREFIX = 'local-media:';

/** "the-problem" as "The problem". */
function titleOf(id: string): string {
  const words = id.replace(/[-_]+/g, ' ').trim();
  return words === '' ? 'Section' : words.charAt(0).toUpperCase() + words.slice(1);
}

function paragraphs(about: string): string[] {
  return about.split(/\n+/).map(line => line.trim()).filter(line => line !== '');
}

/**
 * The content of one draft project. `projectId` picks the project; null (or an id the draft does not have) picks the first. A
 * draft with no project gives "Untitled project" with no technologies. `mediaUrls` maps a media id to a url the preview can show
 * (an object url of the stored blob); without one the url is `local-media:<id>`. The octopus's name is the character's name
 * ("Your Octopus" while it is empty); the profile's tagline is the epithet and its about text the intro.
 */
export function draftToContent(draft: CreatorDraft, projectId: string | null, mediaUrls: Readonly<Record<string, string>> = {}): { project: Project; technologies: readonly Technology[] } {
  const chosen: DraftProject | undefined = draft.projects.find(p => p.id === projectId) ?? draft.projects[0];
  const name = draft.octopus.name.trim();
  const characterName = name === '' ? 'Your Octopus' : name;
  const characterEpithet = draft.profile.tagline.trim();
  const about = paragraphs(draft.profile.about);
  const introduction = about.length > 0 ? about : characterEpithet === '' ? [] : [characterEpithet];

  if (!chosen) {
    return { project: { id: 'untitled-project', name: 'Untitled project', characterName, characterEpithet, introduction }, technologies: [] };
  }

  const technologies: Technology[] = [];
  for (const id of chosen.technologies) {
    const tech = catalogById.get(id);
    if (tech && !technologies.includes(tech) && technologies.length < MAX_TECHNOLOGIES) technologies.push(tech);
  }

  const title = chosen.title.trim();
  const tagline = chosen.tagline.trim();
  const links = (
    [
      ['live', 'Live demo', 'live'],
      ['repo', 'Repository', 'github'],
    ] as const
  ).flatMap(([key, label, kind]) => {
    const url = chosen.links[key];
    return url !== undefined && isHttpsUrl(url) ? [{ id: key, label, url, kind }] : [];
  });

  const project: Project = {
    id: /^[a-z0-9-]{1,40}$/.test(chosen.slug) ? chosen.slug : 'project',
    name: title === '' ? 'Untitled project' : title,
    ...(tagline !== '' && { tagline, summary: tagline }),
    characterName,
    characterEpithet,
    introduction,
    sections: chosen.sections.filter(s => s.body.trim() !== '').map(s => ({ id: s.id, title: titleOf(s.id), content: s.body })),
    links,
    media: chosen.media.map(m => ({ id: m.id, type: 'screenshot' as const, url: mediaUrls[m.id] ?? `${LOCAL_MEDIA_PREFIX}${m.id}`, alt: m.name })),
    technologyUsages: technologies.map(t => {
      const note = chosen.usage[t.id]?.trim();
      return { id: `usage-${t.id}`, technologyId: t.id, ...(note ? { summary: note } : {}) };
    }),
    primaryTechnologyIds: technologies.slice(0, MAX_PRIMARY).map(t => t.id),
  };
  return { project, technologies };
}
