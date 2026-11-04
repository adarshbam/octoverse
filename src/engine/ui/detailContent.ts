import type { Project, ProjectSection, Technology } from '../content/projectTypes';

export interface DetailPage {
  id: string;
  title: string;
  /** The section the page shows; the overview page has none. */
  section?: ProjectSection;
}

const filled = (section: ProjectSection) =>
  Boolean(section.title.trim() && (section.summary?.trim() || section.content?.trim() || section.items?.some(item => item.trim())));

/**
 * The pages the section list offers: the overview first, then every section with something in it,
 * in order. The overview section is the overview page's own text, not a page of its own. Storyboard
 * sections show only while developing.
 */
export function detailPages(project: Project, showPlaceholders: boolean): DetailPage[] {
  const sections = (project.sections ?? []).filter(section => section.id !== 'overview' && filled(section) && (showPlaceholders || !section.placeholder));
  return [{ id: 'overview', title: 'Overview' }, ...sections.map(section => ({ id: section.id, title: section.title, section }))];
}

/** The overview page's text: the overview section's, or else the project's introduction. */
export function overviewText(project: Project, showPlaceholders: boolean) {
  const section = project.sections?.find(item => item.id === 'overview');
  const text = section?.summary?.trim() || section?.content?.trim();
  if (section && text && (showPlaceholders || !section.placeholder)) return { text, placeholder: Boolean(section.placeholder) };
  return { text: project.introduction.join(' '), placeholder: false };
}

/** The key feature cards, from the Features section's items, each written "Title: line". */
export function featureCards(project: Project, showPlaceholders: boolean) {
  const features = project.sections?.find(item => item.id === 'features');
  if (!features || (features.placeholder && !showPlaceholders)) return [];
  return (features.items ?? []).filter(item => item.trim()).map(item => {
    const at = item.indexOf(': ');
    return at < 0 ? { title: item.trim(), text: '' } : { title: item.slice(0, at).trim(), text: item.slice(at + 2).trim() };
  });
}

/** The project's technologies for its chips: its own order first, then any other technology it uses. */
export function detailTechnologies(project: Project, catalog: readonly Technology[]) {
  const byId = new Map(catalog.map(technology => [technology.id, technology]));
  const ids = new Set([...(project.primaryTechnologyIds ?? []), ...(project.technologyUsages ?? []).map(usage => usage.technologyId)]);
  return [...ids].flatMap(id => byId.get(id) ?? []);
}

/** A link's address when it is a web address (http or https); anything else is never opened. */
export function safeHref(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}
