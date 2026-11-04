import { nox } from './nox';
import { noxTechnologies } from './noxTechnologies';
import { placeholderSections, placeholderUsages } from './placeholders';
import type { Project } from '../../engine/content/projectTypes';

/**
 * Security Lab, hosted by Nox. Identity, links and screenshot are the owner's
 * supplied facts; sections and usage notes are flagged storyboard placeholders.
 * "View Project" opens the full project view, so the external site is "Live Demo".
 */
export const noxProject: Project = {
  id: 'security-lab',
  name: nox.project,
  tagline: nox.tagline,
  summary: nox.summary,
  characterName: nox.name,
  characterEpithet: nox.epithet,
  introduction: nox.introduction,
  sections: placeholderSections,
  links: [
    { id: 'live-demo', label: 'Live Demo', url: 'https://yourvaultstorage.com/', kind: 'live' },
    { id: 'github-repository', label: 'GitHub', url: 'https://github.com/adarshbam/my-storage', kind: 'github' },
  ],
  media: [{
    id: 'security-lab-homepage',
    type: 'screenshot',
    url: '/images/projects/security-lab-detail.webp',
    previewUrl: '/images/projects/security-lab-preview.webp',
    alt: 'Security Lab project homepage screenshot',
  }],
  technologyUsages: placeholderUsages(noxTechnologies),
  primaryTechnologyIds: noxTechnologies.map(technology => technology.id),
};
