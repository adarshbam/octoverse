import { veyra } from './veyra';
import { veyraTechnologies } from './veyraTechnologies';
import { placeholderSections, placeholderUsages } from './placeholders';
import type { Project } from '../../../engine/content/projectTypes';

/**
 * Vault OS, hosted by Veyra (spec 7.10). Name, epithet, tagline and the technologies are the
 * storyboard's; the sections, usage notes and the link addresses are flagged placeholders until
 * the owner supplies the real facts. The project screenshot joins with the detail view.
 */
export const veyraProject: Project = {
  id: 'vault-os',
  name: veyra.project,
  tagline: veyra.tagline,
  summary: veyra.summary,
  characterName: veyra.name,
  characterEpithet: veyra.epithet,
  introduction: veyra.introduction,
  sections: placeholderSections,
  links: [
    { id: 'live-demo', label: 'Live Demo', url: 'https://example.com/vault-os', kind: 'live' },
    { id: 'github-repository', label: 'GitHub', url: 'https://github.com/example/vault-os', kind: 'github' },
  ],
  technologyUsages: placeholderUsages(veyraTechnologies),
  primaryTechnologyIds: veyraTechnologies.map(technology => technology.id),
};
