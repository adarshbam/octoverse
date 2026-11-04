import { flux } from './flux';
import { fluxTechnologies } from './fluxTechnologies';
import { placeholderSections, placeholderUsages } from './placeholders';
import type { Project } from '../../../engine/content/projectTypes';

/**
 * GitHub Pipeline Engine, hosted by Flux. The name, the epithet and the technologies are the
 * storyboard's; the links are stand-ins and sections and usage notes are flagged storyboard
 * placeholders until the owner supplies the real facts and links (spec 7.10). No screenshots yet.
 * "View Project" opens the full project view, so the external site is "Live Demo".
 */
export const fluxProject: Project = {
  id: 'github-pipeline-engine',
  name: flux.project,
  tagline: flux.tagline,
  summary: flux.summary,
  characterName: flux.name,
  characterEpithet: flux.epithet,
  introduction: flux.introduction,
  sections: placeholderSections,
  links: [
    { id: 'live-demo', label: 'Live Demo', url: 'https://example.com/github-pipeline-engine', kind: 'live' },
    { id: 'github-repository', label: 'GitHub', url: 'https://github.com/', kind: 'github' },
  ],
  technologyUsages: placeholderUsages(fluxTechnologies),
  primaryTechnologyIds: fluxTechnologies.map(technology => technology.id),
};
