import { aether } from './aether';
import { aetherTechnologies } from './aetherTechnologies';
import { placeholderSections, placeholderUsages } from './placeholders';
import type { Project, Technology } from '../../../engine/content/projectTypes';

/**
 * AI Playground, hosted by Aether, for any list of technologies (the shipped ten, or the
 * fifteen-technology test set). Everything here is a storyboard placeholder (panels 2, 3 and 5)
 * until the owner supplies the real text: the sections and usage notes are flagged, the two links
 * are example addresses, and the screenshot is panel 5's own, three times for its "1/3" carousel.
 * "View Project" opens the full project view, so the external site is "Live Demo".
 */
export function aetherProjectFor(technologies: readonly Technology[]): Project {
  return {
    id: 'ai-playground',
    name: aether.project,
    tagline: aether.tagline,
    summary: aether.summary,
    characterName: aether.name,
    characterEpithet: aether.epithet,
    introduction: aether.introduction,
    sections: placeholderSections,
    links: [
      { id: 'live-demo', label: 'Live Demo', url: 'https://example.com/ai-playground', kind: 'live' },
      { id: 'github-repository', label: 'GitHub', url: 'https://github.com/example/ai-playground', kind: 'github' },
    ],
    media: [1, 2, 3].map(n => ({
      id: `ai-playground-slide-${n}`,
      type: 'screenshot' as const,
      url: '/aether/ai-playground-screenshot.webp',
      alt: `AI Playground screenshot, placeholder slide ${n} of 3`,
    })),
    technologyUsages: placeholderUsages(technologies),
    primaryTechnologyIds: technologies.map(technology => technology.id),
  };
}

export const aetherProject: Project = aetherProjectFor(aetherTechnologies);
