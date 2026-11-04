import type { CreatorDraft } from './types';

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

/**
 * The static sample the creator shows until drafts exist (Task 18): the sample creator octopus of spec 7.10 (Aether, peach) with one
 * placeholder project. Every word is a placeholder, nothing is about a real person; the technologies are ids of the shared list
 * (technologies.ts) that Aether's own content declares. Deeply frozen: a draft is always a copy of this, never this.
 */
export const SAMPLE_DRAFT: CreatorDraft = deepFreeze({
  version: 1,
  octopus: { template: 'aether', palette: 'peach', personality: 'playful', name: 'Your Octopus' },
  profile: { handle: 'your-octopus', tagline: 'A short line about you.', about: '' },
  projects: [
    {
      id: 'sample-project',
      slug: 'sample-project',
      title: 'Sample project',
      tagline: 'A short description of what you built.',
      sections: [],
      links: {},
      technologies: ['react', 'typescript', 'postgresql', 'redis', 'docker'],
      usage: {},
      media: [],
    },
  ],
  updatedAt: '2026-11-03T00:00:00.000Z',
});
