import type { ProjectSection, ProjectTechnologyUsage, Technology } from '../../../engine/content/projectTypes';

// Storyboard copy (Aether's panels 4 and 5) standing in for real project text. Every entry is
// flagged `placeholder: true` (the marker Nox's content uses), so the interface can badge it until
// the owner replaces it.

// Panel 4's text for OpenAI, with the "ooh" face Aether gives it there. No other technology has
// project text yet: none is invented; the interface says so while developing.
const OPENAI_USAGE: Omit<ProjectTechnologyUsage, 'id' | 'technologyId'> = {
  role: 'LLM integration',
  details: ['LLM integration', 'Text / image generation', 'Function calling', 'Prompt engineering'],
  reaction: 'curious',
  placeholder: true,
};

export function placeholderUsages(technologies: readonly Technology[]): ProjectTechnologyUsage[] {
  return technologies.map(technology => ({
    id: `aether-${technology.id}`,
    technologyId: technology.id,
    ...(technology.id === 'openai' ? OPENAI_USAGE : { placeholder: true }),
  }));
}

export const placeholderSections: readonly ProjectSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    summary: 'A playground for experimenting with LLMs, building useful AI tools, and exploring real-world applications. Includes chat, image generation, document analysis and more.',
    placeholder: true,
  },
  {
    id: 'features',
    title: 'Features',
    items: [
      'AI Chat Interface: Multi-model support',
      'Image Generation: Text to image workflows',
      'Document Analysis: PDF & text processing',
      'Experiment Hub: Try new AI features',
    ],
    placeholder: true,
  },
  ...['Tech Stack', 'Architecture', 'Experiments', 'Challenges', 'What I Learned'].map(title => ({
    id: title.toLowerCase().replaceAll(' ', '-'),
    title,
    summary: `Placeholder: ${title} for AI Playground.`,
    placeholder: true,
  })),
];
