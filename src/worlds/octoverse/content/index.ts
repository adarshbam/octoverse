import type { Project, Technology } from '../../../engine/content/projectTypes';

// The host's content: OctoVerse itself, as P2 introduces it. No technologies and no sections: the
// host has nothing to choose and no detail view (spec 7.4).

const project: Project = {
  id: 'octoverse',
  name: 'OctoVerse',
  tagline: 'Create. Showcase. Belong.',
  characterName: 'OctoVerse',
  characterEpithet: 'Your Host',
  introduction: ['A platform to create your own animated developer portfolio', 'with unique octopus characters, themes and project showcases.'],
};

const technologies: readonly Technology[] = [];

/** The bundle's `content`: the project and its (empty) technology catalogue. */
export const HOST_CONTENT: { project: Project; technologies: readonly Technology[] } = { project, technologies };
